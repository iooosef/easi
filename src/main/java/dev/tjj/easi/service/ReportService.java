package dev.tjj.easi.service;

import dev.tjj.easi.dto.report.ServiceReportSummaryRow;
import dev.tjj.easi.entity.Employee;
import dev.tjj.easi.entity.ServiceReport;
import dev.tjj.easi.repository.ServiceReportBillingItemRepository;
import dev.tjj.easi.repository.ServiceReportRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Assembles data for all generated reports. Read-only — no audit logging. */
@Service
public class ReportService {

    private final ServiceReportRepository serviceReportRepository;
    private final ServiceReportBillingItemRepository billingItemRepository;

    public ReportService(ServiceReportRepository serviceReportRepository,
                         ServiceReportBillingItemRepository billingItemRepository) {
        this.serviceReportRepository = serviceReportRepository;
        this.billingItemRepository = billingItemRepository;
    }

    /**
     * Returns service report rows within the given date range.
     * Blank or null optional filters are ignored (treated as "no filter").
     */
    public List<ServiceReportSummaryRow> getServiceReportSummary(
            LocalDate startDate, LocalDate endDate,
            Integer projNum, String status, String paymentMethod) {

        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime end = endDate.atTime(23, 59, 59);

        String normalizedStatus = (status == null || status.isBlank()) ? null : status;
        String normalizedPaymentMethod = (paymentMethod == null || paymentMethod.isBlank()) ? null : paymentMethod;

        List<ServiceReport> reports = serviceReportRepository.findForSummaryReport(
                start, end, projNum, normalizedStatus, normalizedPaymentMethod);

        if (reports.isEmpty()) return List.of();

        List<Integer> srNumbers = reports.stream()
                .map(ServiceReport::getSrNumber)
                .toList();

        Map<Integer, BigDecimal> billingTotals = billingItemRepository
                .sumTotalBySrNumbers(srNumbers)
                .stream()
                .collect(Collectors.toMap(
                        row -> (Integer) row[0],
                        row -> new BigDecimal(row[1].toString())
                ));

        return reports.stream()
                .map(sr -> toRow(sr, billingTotals))
                .toList();
    }

    /** Maps a ServiceReport entity and its billing total to a flat summary row. */
    private ServiceReportSummaryRow toRow(ServiceReport sr, Map<Integer, BigDecimal> billingTotals) {
        Employee eng = sr.getEngineerEmployee();
        String engineerName = eng != null
                ? (eng.getFirstName() + " " + eng.getLastName()).strip()
                : null;

        return new ServiceReportSummaryRow(
                sr.getSrNumber(),
                sr.getProject().getProjNum(),
                sr.getProject().getName(),
                sr.getComplaint(),
                sr.getWorkDone(),
                engineerName,
                sr.getLocation(),
                sr.getServiceSchedule().getDate(),
                sr.getPaymentMethod(),
                sr.getReceiptReceiveDate(),
                sr.getStatus(),
                sr.getAddedOn(),
                billingTotals.getOrDefault(sr.getSrNumber(), BigDecimal.ZERO)
        );
    }
}
