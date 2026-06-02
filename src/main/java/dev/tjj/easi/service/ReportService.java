package dev.tjj.easi.service;

import dev.tjj.easi.dto.report.PartReportRow;
import dev.tjj.easi.dto.report.PurchaseOrderRow;
import dev.tjj.easi.dto.report.ServiceReportSummaryRow;
import dev.tjj.easi.entity.Employee;
import dev.tjj.easi.entity.ServiceReport;
import dev.tjj.easi.repository.EquipmentRepository;
import dev.tjj.easi.repository.PartRepository;
import dev.tjj.easi.repository.PartUsageRepository;
import dev.tjj.easi.repository.PaymentLogRepository;
import dev.tjj.easi.repository.PurchaseOrderRepository;
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
    private final PaymentLogRepository paymentLogRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final PartRepository partRepository;
    private final PartUsageRepository partUsageRepository;
    private final EquipmentRepository equipmentRepository;

    public ReportService(ServiceReportRepository serviceReportRepository,
                         ServiceReportBillingItemRepository billingItemRepository,
                         PaymentLogRepository paymentLogRepository,
                         PurchaseOrderRepository purchaseOrderRepository,
                         PartRepository partRepository,
                         PartUsageRepository partUsageRepository,
                         EquipmentRepository equipmentRepository) {
        this.serviceReportRepository = serviceReportRepository;
        this.billingItemRepository = billingItemRepository;
        this.paymentLogRepository = paymentLogRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.partRepository = partRepository;
        this.partUsageRepository = partUsageRepository;
        this.equipmentRepository = equipmentRepository;
    }

    /**
     * Returns service report rows within the given date range.
     * Status is computed from payment logs and filtered post-query.
     * Blank or null optional filters are ignored (treated as "no filter").
     */
    public List<ServiceReportSummaryRow> getServiceReportSummary(
            LocalDate startDate, LocalDate endDate,
            Integer projNum, String status) {

        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime end = endDate.atTime(23, 59, 59);

        String normalizedStatus = (status == null || status.isBlank()) ? null : status;

        List<ServiceReport> reports = serviceReportRepository.findForSummaryReport(
                start, end, projNum);

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

        Map<Integer, BigDecimal> paidTotals = paymentLogRepository
                .sumPaidBySrNumbers(srNumbers)
                .stream()
                .collect(Collectors.toMap(
                        row -> (Integer) row[0],
                        row -> new BigDecimal(row[1].toString())
                ));

        return reports.stream()
                .map(sr -> toRow(sr, billingTotals, paidTotals))
                .filter(row -> normalizedStatus == null || normalizedStatus.equals(row.status()))
                .toList();
    }

    /** Maps a ServiceReport entity and its billing/payment totals to a flat summary row. */
    private ServiceReportSummaryRow toRow(ServiceReport sr,
                                          Map<Integer, BigDecimal> billingTotals,
                                          Map<Integer, BigDecimal> paidTotals) {
        Employee eng = sr.getEngineerEmployee();
        String engineerName = eng != null
                ? (eng.getFirstName() + " " + eng.getLastName()).strip()
                : null;

        BigDecimal billed = billingTotals.getOrDefault(sr.getSrNumber(), BigDecimal.ZERO);
        BigDecimal paid = paidTotals.getOrDefault(sr.getSrNumber(), BigDecimal.ZERO);

        return new ServiceReportSummaryRow(
                sr.getSrNumber(),
                sr.getServiceSchedule().getProject().getProjNum(),
                sr.getServiceSchedule().getProject().getName(),
                sr.getComplaint(),
                sr.getWorkDone(),
                engineerName,
                sr.getLocation(),
                sr.getServiceSchedule().getDate(),
                ServiceReportService.deriveStatus(billed, paid),
                sr.getAddedOn(),
                billed,
                paid
        );
    }

    /**
     * Returns purchase order rows within the given date range.
     * Type is determined by whether the PO has linked parts or equipment.
     * Total is sum of (qty × unitPrice) for parts POs, or sum of acquisition costs for equipment POs.
     */
    public List<PurchaseOrderRow> getPurchaseOrderReport(LocalDate startDate, LocalDate endDate) {
        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime end = endDate.atTime(23, 59, 59);

        List<Object[]> rawRows = purchaseOrderRepository.findForReport(start, end);
        if (rawRows.isEmpty()) return List.of();

        List<String> poNums = rawRows.stream()
                .map(r -> (String) r[0])
                .toList();

        Map<String, BigDecimal> partsTotals = partRepository.sumTotalByPoNums(poNums)
                .stream()
                .collect(Collectors.toMap(
                        r -> (String) r[0],
                        r -> new BigDecimal(r[1].toString())
                ));

        Map<String, BigDecimal> equipTotals = equipmentRepository.sumCostByPoNums(poNums)
                .stream()
                .collect(Collectors.toMap(
                        r -> (String) r[0],
                        r -> new BigDecimal(r[1].toString())
                ));

        return rawRows.stream().map(r -> {
            String poNum          = (String) r[0];
            Integer srNumber      = r[1] != null ? ((Number) r[1]).intValue() : null;
            String projectName    = (String) r[2];
            String terms          = (String) r[3];
            LocalDateTime addedOn = (LocalDateTime) r[4];

            BigDecimal partsTotal = partsTotals.getOrDefault(poNum, BigDecimal.ZERO);
            BigDecimal equipTotal = equipTotals.getOrDefault(poNum, BigDecimal.ZERO);

            String type;
            BigDecimal total;
            if (partsTotal.compareTo(BigDecimal.ZERO) > 0) {
                type = "parts";
                total = partsTotal;
            } else if (equipTotal.compareTo(BigDecimal.ZERO) > 0) {
                type = "equipment";
                total = equipTotal;
            } else {
                // Fallback: infer from SR linkage (parts POs have an SR; equipment POs do not)
                type = srNumber != null ? "parts" : "equipment";
                total = BigDecimal.ZERO;
            }

            return new PurchaseOrderRow(poNum, srNumber, projectName, terms, type, total, addedOn);
        }).toList();
    }

    /**
     * Returns part rows within the given date range, filtered by parts.added_on.
     * quantityUsed is the total consumed across all service reports, regardless of date.
     */
    public List<PartReportRow> getPartsReport(LocalDate startDate, LocalDate endDate) {
        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime end = endDate.atTime(23, 59, 59);

        List<Object[]> rawRows = partRepository.findForReport(start, end);
        if (rawRows.isEmpty()) return List.of();

        List<Integer> partIds = rawRows.stream()
                .map(r -> ((Number) r[0]).intValue())
                .toList();

        Map<Integer, Integer> usedMap = partUsageRepository.sumQtyUsedByPartIds(partIds)
                .stream()
                .collect(Collectors.toMap(
                        r -> ((Number) r[0]).intValue(),
                        r -> ((Number) r[1]).intValue()
                ));

        return rawRows.stream().map(r -> {
            Integer partId        = ((Number) r[0]).intValue();
            String  name          = (String) r[1];
            String  supplierName  = (String) r[2];
            Integer qtyOrdered    = ((Number) r[3]).intValue();
            String  qtyType       = (String) r[4];
            BigDecimal unitPrice  = r[5] != null ? new BigDecimal(r[5].toString()) : BigDecimal.ZERO;
            String  status        = (String) r[6];
            Integer qtyUsed       = usedMap.getOrDefault(partId, 0);
            BigDecimal total      = unitPrice.multiply(BigDecimal.valueOf(qtyOrdered));

            return new PartReportRow(partId, name, supplierName, qtyOrdered, qtyType,
                    qtyUsed, unitPrice, total, status);
        }).toList();
    }
}
