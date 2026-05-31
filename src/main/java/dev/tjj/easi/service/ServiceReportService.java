package dev.tjj.easi.service;

import dev.tjj.easi.dto.ServiceReportRequest;
import dev.tjj.easi.dto.ServiceReportResponse;
import dev.tjj.easi.entity.*;
import dev.tjj.easi.repository.*;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Handles service report business logic: creation, updates, and retrieval. */
@Service
public class ServiceReportService {

    private final ServiceReportRepository serviceReportRepository;
    private final ProjectRepository projectRepository;
    private final EmployeeRepository employeeRepository;
    private final ServiceScheduleRepository serviceScheduleRepository;
    private final DocumentRepository documentRepository;
    private final ServiceReportBillingItemRepository billingItemRepository;
    private final PaymentLogRepository paymentLogRepository;
    private final LogService logService;

    public ServiceReportService(ServiceReportRepository serviceReportRepository,
                                ProjectRepository projectRepository,
                                EmployeeRepository employeeRepository,
                                ServiceScheduleRepository serviceScheduleRepository,
                                DocumentRepository documentRepository,
                                ServiceReportBillingItemRepository billingItemRepository,
                                PaymentLogRepository paymentLogRepository,
                                LogService logService) {
        this.serviceReportRepository = serviceReportRepository;
        this.projectRepository = projectRepository;
        this.employeeRepository = employeeRepository;
        this.serviceScheduleRepository = serviceScheduleRepository;
        this.documentRepository = documentRepository;
        this.billingItemRepository = billingItemRepository;
        this.paymentLogRepository = paymentLogRepository;
        this.logService = logService;
    }

    /** Creates and persists a new service report record. */
    @Transactional
    public ServiceReportResponse add(ServiceReportRequest request) {
        ServiceReport report = new ServiceReport();
        applyRequest(report, request);
        report.setAddedOn(LocalDateTime.now());
        ServiceReport saved = serviceReportRepository.save(report);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "ServiceReport", String.valueOf(saved.getSrNumber()), "Created service report #" + saved.getSrNumber(), null);
        return toResponse(saved);
    }

    /** Updates an existing service report record by ID. */
    @Transactional
    public ServiceReportResponse update(Integer srNumber, ServiceReportRequest request) {
        ServiceReport report = serviceReportRepository.findById(srNumber)
                .orElseThrow(() -> new IllegalArgumentException("Service report not found."));
        applyRequest(report, request);
        ServiceReport saved = serviceReportRepository.save(report);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "ServiceReport", String.valueOf(srNumber), "Updated service report #" + srNumber, null);
        return toResponse(saved);
    }

    /** Returns a page of service report records, optionally filtered by project number and payment statuses. */
    public Page<ServiceReportResponse> getAll(Integer projNum, List<String> statuses, Pageable pageable) {
        boolean noFilter = statuses == null || statuses.isEmpty();
        boolean wantUnpaid  = !noFilter && statuses.contains("unpaid");
        boolean wantPartial = !noFilter && statuses.contains("partial");
        boolean wantPaid    = !noFilter && statuses.contains("paid");
        Page<ServiceReport> page = serviceReportRepository.findAllFiltered(
                projNum, noFilter, wantUnpaid, wantPartial, wantPaid, pageable);

        List<Integer> srNums = page.getContent().stream().map(ServiceReport::getSrNumber).toList();
        if (srNums.isEmpty()) return page.map(sr -> toResponse(sr, BigDecimal.ZERO, BigDecimal.ZERO));

        Map<Integer, BigDecimal> billedMap = billingItemRepository.sumTotalBySrNumbers(srNums)
                .stream().collect(Collectors.toMap(
                        row -> (Integer) row[0],
                        row -> new BigDecimal(row[1].toString())));

        Map<Integer, BigDecimal> paidMap = paymentLogRepository.sumPaidBySrNumbers(srNums)
                .stream().collect(Collectors.toMap(
                        row -> (Integer) row[0],
                        row -> new BigDecimal(row[1].toString())));

        return page.map(sr -> toResponse(sr,
                billedMap.getOrDefault(sr.getSrNumber(), BigDecimal.ZERO),
                paidMap.getOrDefault(sr.getSrNumber(), BigDecimal.ZERO)));
    }

    /** Links or unlinks a document on an existing service report. */
    @Transactional
    public ServiceReportResponse updateDocument(Integer srNumber, Integer docuId) {
        ServiceReport report = serviceReportRepository.findById(srNumber)
                .orElseThrow(() -> new IllegalArgumentException("Service report not found."));

        if (docuId != null) {
            Document document = documentRepository.findById(docuId)
                    .orElseThrow(() -> new IllegalArgumentException("Document not found."));
            report.setDocument(document);
        } else {
            report.setDocument(null);
        }

        ServiceReport saved = serviceReportRepository.save(report);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "ServiceReport",
                String.valueOf(srNumber), "Updated document link for service report #" + srNumber, null);
        return toResponse(saved);
    }

    /** Returns a single service report record by ID. */
    public ServiceReportResponse getById(Integer srNumber) {
        return serviceReportRepository.findById(srNumber)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Service report not found."));
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /** Applies request fields onto the service report entity. */
    private void applyRequest(ServiceReport report, ServiceReportRequest request) {
        Project project = projectRepository.findById(request.projNum())
                .orElseThrow(() -> new IllegalArgumentException("Project not found."));
        ServiceSchedule schedule = serviceScheduleRepository.findById(request.schedId())
                .orElseThrow(() -> new IllegalArgumentException("Service schedule not found."));

        report.setProject(project);
        report.setComplaint(request.complaint());
        report.setWorkDone(request.workDone());
        report.setLocation(request.location());
        report.setServiceSchedule(schedule);

        if (request.engineerEmployeeId() != null) {
            Employee engineer = employeeRepository.findById(request.engineerEmployeeId())
                    .orElseThrow(() -> new IllegalArgumentException("Engineer employee not found."));
            report.setEngineerEmployee(engineer);
        } else {
            report.setEngineerEmployee(null);
        }

        if (request.docuId() != null) {
            Document document = documentRepository.findById(request.docuId())
                    .orElseThrow(() -> new IllegalArgumentException("Document not found."));
            report.setDocument(document);
        } else {
            report.setDocument(null);
        }

    }

    /** Computes payment status from live billing and payment totals for a single SR. */
    private ServiceReportResponse toResponse(ServiceReport r) {
        BigDecimal billed = billingItemRepository.sumTotalBySrNumber(r.getSrNumber());
        BigDecimal paid = paymentLogRepository.sumPaidBySrNumber(r.getSrNumber());
        return toResponse(r, billed, paid);
    }

    /** Builds the response DTO using precomputed billing and payment totals. */
    private ServiceReportResponse toResponse(ServiceReport r, BigDecimal billed, BigDecimal paid) {
        return new ServiceReportResponse(
                r.getSrNumber(),
                r.getProject().getProjNum(),
                r.getProject().getName(),
                r.getComplaint(),
                r.getWorkDone(),
                r.getEngineerEmployee() != null ? r.getEngineerEmployee().getEmployeeId() : null,
                r.getLocation(),
                r.getServiceSchedule().getSchedId(),
                r.getServiceSchedule().getDate(),
                r.getDocument() != null ? r.getDocument().getDocuId() : null,
                deriveStatus(billed, paid),
                billed,
                paid,
                r.getAddedOn()
        );
    }

    /** Derives payment status from billed and paid totals. */
    static String deriveStatus(BigDecimal billed, BigDecimal paid) {
        if (paid == null || paid.compareTo(BigDecimal.ZERO) == 0) return "unpaid";
        if (billed != null && billed.compareTo(BigDecimal.ZERO) > 0
                && paid.compareTo(billed) >= 0) return "paid";
        return "partial";
    }
}
