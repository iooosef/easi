package dev.tjj.easi.service;

import dev.tjj.easi.dto.PaymentLogRequest;
import dev.tjj.easi.dto.PaymentLogResponse;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import dev.tjj.easi.entity.PaymentLog;
import dev.tjj.easi.entity.ServiceReport;
import dev.tjj.easi.repository.PaymentLogRepository;
import dev.tjj.easi.repository.PartUsageRepository;
import dev.tjj.easi.repository.ServiceReportBillingItemRepository;
import dev.tjj.easi.repository.ServiceReportRepository;
import dev.tjj.easi.repository.ServiceScheduleRepository;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** Handles CRUD operations for payment logs tied to service reports. */
@Service
public class PaymentLogService {

    private final PaymentLogRepository paymentLogRepository;
    private final ServiceReportRepository serviceReportRepository;
    private final ServiceReportBillingItemRepository billingItemRepository;
    private final PartUsageRepository partUsageRepository;
    private final ServiceScheduleRepository serviceScheduleRepository;
    private final LogService logService;

    public PaymentLogService(PaymentLogRepository paymentLogRepository,
                             ServiceReportRepository serviceReportRepository,
                             ServiceReportBillingItemRepository billingItemRepository,
                             PartUsageRepository partUsageRepository,
                             ServiceScheduleRepository serviceScheduleRepository,
                             LogService logService) {
        this.paymentLogRepository = paymentLogRepository;
        this.serviceReportRepository = serviceReportRepository;
        this.billingItemRepository = billingItemRepository;
        this.partUsageRepository = partUsageRepository;
        this.serviceScheduleRepository = serviceScheduleRepository;
        this.logService = logService;
    }

    /** Records a new payment against a service report. */
    @Transactional
    public PaymentLogResponse add(PaymentLogRequest request) {
        ServiceReport sr = serviceReportRepository.findById(request.srNumber())
                .orElseThrow(() -> new IllegalArgumentException("Service report not found."));
        PaymentLog log = new PaymentLog();
        applyRequest(log, request, sr);
        log.setAddedOn(LocalDateTime.now());
        PaymentLog saved = paymentLogRepository.save(log);
        syncScheduleStatus(sr);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE",
                "PaymentLog", String.valueOf(saved.getLogId()),
                "Recorded payment of " + saved.getAmount() + " for service report #" + sr.getSrNumber(), null);
        return toResponse(saved);
    }

    /** Updates an existing payment log entry. */
    @Transactional
    public PaymentLogResponse update(Integer logId, PaymentLogRequest request) {
        PaymentLog log = paymentLogRepository.findById(logId)
                .orElseThrow(() -> new IllegalArgumentException("Payment log not found."));
        ServiceReport sr = serviceReportRepository.findById(request.srNumber())
                .orElseThrow(() -> new IllegalArgumentException("Service report not found."));
        applyRequest(log, request, sr);
        PaymentLog saved = paymentLogRepository.save(log);
        syncScheduleStatus(sr);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE",
                "PaymentLog", String.valueOf(logId),
                "Updated payment log #" + logId + " for service report #" + sr.getSrNumber(), null);
        return toResponse(saved);
    }

    /** Deletes a payment log entry by ID. */
    @Transactional
    public void delete(Integer logId) {
        PaymentLog log = paymentLogRepository.findById(logId)
                .orElseThrow(() -> new IllegalArgumentException("Payment log not found."));
        ServiceReport sr = log.getServiceReport();
        paymentLogRepository.delete(log);
        syncScheduleStatus(sr);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "DELETE",
                "PaymentLog", String.valueOf(logId),
                "Deleted payment log #" + logId + " from service report #" + sr.getSrNumber(), null);
    }

    /** Returns all payment logs for a given service report, ordered by receipt date ascending. */
    public List<PaymentLogResponse> getBySrNumber(Integer srNumber) {
        return paymentLogRepository
                .findByServiceReport_SrNumber(srNumber, Sort.by("receiptDate").ascending())
                .stream().map(this::toResponse).toList();
    }

    /** Returns a single payment log by ID. */
    public PaymentLogResponse getById(Integer logId) {
        return paymentLogRepository.findById(logId)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Payment log not found."));
    }

    /** Syncs the linked schedule status based on current payment state.
     *  Sets "completed" when fully paid; reverts to "pending" otherwise. */
    private void syncScheduleStatus(ServiceReport sr) {
        BigDecimal billed = billingItemRepository.sumTotalBySrNumber(sr.getSrNumber())
                .add(partUsageRepository.sumTotalCostBySrNumber(sr.getSrNumber()));
        BigDecimal paid = paymentLogRepository.sumPaidBySrNumber(sr.getSrNumber());
        var schedule = sr.getServiceSchedule();
        String newStatus = ServiceReportService.deriveStatus(billed, paid).equals("paid") ? "completed" : "pending";
        if (!newStatus.equals(schedule.getStatus())) {
            schedule.setStatus(newStatus);
            serviceScheduleRepository.save(schedule);
        }
    }

    private void applyRequest(PaymentLog log, PaymentLogRequest request, ServiceReport sr) {
        log.setServiceReport(sr);
        log.setAmount(request.amount());
        log.setPaymentMethod(request.paymentMethod());
        log.setReceiptDate(request.receiptDate());
        log.setReceiptNumber(request.receiptNumber());
        log.setPaidBy(request.paidBy());
        log.setNotes(request.notes());
    }

    private PaymentLogResponse toResponse(PaymentLog log) {
        return new PaymentLogResponse(
                log.getLogId(),
                log.getServiceReport().getSrNumber(),
                log.getAmount(),
                log.getPaymentMethod(),
                log.getReceiptDate(),
                log.getReceiptNumber(),
                log.getPaidBy(),
                log.getNotes(),
                log.getAddedOn()
        );
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }
}
