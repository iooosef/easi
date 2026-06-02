package dev.tjj.easi.service;

import dev.tjj.easi.dto.report.PartReportRow;
import dev.tjj.easi.dto.report.PurchaseOrderRow;
import dev.tjj.easi.dto.report.ServiceReportBillingRow;
import dev.tjj.easi.dto.report.ServiceReportSummaryRow;
import dev.tjj.easi.dto.report.VehicleGasLogRow;
import dev.tjj.easi.dto.report.VehicleLogRow;
import dev.tjj.easi.entity.Employee;
import dev.tjj.easi.entity.ServiceReport;
import dev.tjj.easi.repository.EquipmentRepository;
import dev.tjj.easi.repository.PartRepository;
import dev.tjj.easi.repository.PartUsageRepository;
import dev.tjj.easi.repository.PaymentLogRepository;
import dev.tjj.easi.repository.PurchaseOrderRepository;
import dev.tjj.easi.repository.ServiceReportBillingItemRepository;
import dev.tjj.easi.repository.ServiceReportRepository;
import dev.tjj.easi.repository.VehicleGasLogRepository;
import dev.tjj.easi.repository.VehicleLogRepository;
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
    private final VehicleLogRepository vehicleLogRepository;
    private final VehicleGasLogRepository vehicleGasLogRepository;

    public ReportService(ServiceReportRepository serviceReportRepository,
                         ServiceReportBillingItemRepository billingItemRepository,
                         PaymentLogRepository paymentLogRepository,
                         PurchaseOrderRepository purchaseOrderRepository,
                         PartRepository partRepository,
                         PartUsageRepository partUsageRepository,
                         EquipmentRepository equipmentRepository,
                         VehicleLogRepository vehicleLogRepository,
                         VehicleGasLogRepository vehicleGasLogRepository) {
        this.serviceReportRepository = serviceReportRepository;
        this.billingItemRepository = billingItemRepository;
        this.paymentLogRepository = paymentLogRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.partRepository = partRepository;
        this.partUsageRepository = partUsageRepository;
        this.equipmentRepository = equipmentRepository;
        this.vehicleLogRepository = vehicleLogRepository;
        this.vehicleGasLogRepository = vehicleGasLogRepository;
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

    /**
     * Returns one billing summary row per service report within the given date range.
     * Combines billing items (services/labor), parts cost, payments, and computed balance.
     */
    public List<ServiceReportBillingRow> getServiceReportBillingReport(
            LocalDate startDate, LocalDate endDate) {

        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime end = endDate.atTime(23, 59, 59);

        List<ServiceReport> reports = serviceReportRepository.findForSummaryReport(start, end, null);
        if (reports.isEmpty()) return List.of();

        List<Integer> srNumbers = reports.stream()
                .map(ServiceReport::getSrNumber)
                .toList();

        Map<Integer, BigDecimal> billingTotals = billingItemRepository
                .sumTotalBySrNumbers(srNumbers)
                .stream()
                .collect(Collectors.toMap(
                        r -> (Integer) r[0],
                        r -> new BigDecimal(r[1].toString())
                ));

        Map<Integer, BigDecimal> paidTotals = paymentLogRepository
                .sumPaidBySrNumbers(srNumbers)
                .stream()
                .collect(Collectors.toMap(
                        r -> (Integer) r[0],
                        r -> new BigDecimal(r[1].toString())
                ));

        Map<Integer, BigDecimal> partsTotals = partRepository
                .sumTotalCostBySrNumbers(srNumbers)
                .stream()
                .collect(Collectors.toMap(
                        r -> (Integer) r[0],
                        r -> new BigDecimal(r[1].toString())
                ));

        return reports.stream().map(sr -> {
            Integer srNum = sr.getSrNumber();
            LocalDate serviceDate = sr.getServiceSchedule() != null ? sr.getServiceSchedule().getDate() : null;
            BigDecimal billing  = billingTotals.getOrDefault(srNum, BigDecimal.ZERO);
            BigDecimal parts    = partsTotals.getOrDefault(srNum, BigDecimal.ZERO);
            BigDecimal paid     = paidTotals.getOrDefault(srNum, BigDecimal.ZERO);
            BigDecimal subtotal = billing.add(parts);
            BigDecimal balance  = subtotal.subtract(paid);
            return new ServiceReportBillingRow(srNum, serviceDate, billing, parts, subtotal, paid, balance);
        }).toList();
    }

    /**
     * Returns vehicle log rows within the given date range.
     * Pass null for vehicleId to include all vehicles.
     * Distance is null for trips that have not yet ended (odometerEnd is null).
     */
    public List<VehicleLogRow> getVehicleLogReport(LocalDate startDate, LocalDate endDate,
                                                   Integer vehicleId) {
        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime end = endDate.atTime(23, 59, 59);

        List<Object[]> rawRows = vehicleLogRepository.findForReport(start, end, vehicleId);

        return rawRows.stream().map(r -> {
            Integer logId       = ((Number) r[0]).intValue();
            String  model       = (String) r[1];
            String  plate       = (String) r[2];
            Integer odomStart   = r[3] != null ? ((Number) r[3]).intValue() : null;
            Integer odomEnd     = r[4] != null ? ((Number) r[4]).intValue() : null;
            Integer distance    = (odomStart != null && odomEnd != null) ? odomEnd - odomStart : null;
            LocalDateTime addedOn = (LocalDateTime) r[5];
            return new VehicleLogRow(logId, model, plate, odomStart, odomEnd, distance, addedOn);
        }).toList();
    }

    /**
     * Returns vehicle gas log rows within the given date range.
     * Date is sourced from the linked VehicleLog's addedOn timestamp.
     * Pass null for vehicleId to include all vehicles.
     */
    public List<VehicleGasLogRow> getVehicleGasLogReport(LocalDate startDate, LocalDate endDate,
                                                         Integer vehicleId) {
        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime end = endDate.atTime(23, 59, 59);

        List<Object[]> rawRows = vehicleGasLogRepository.findForReport(start, end, vehicleId);

        return rawRows.stream().map(r -> {
            Integer gasLogId      = ((Number) r[0]).intValue();
            String  model         = (String) r[1];
            String  plate         = (String) r[2];
            String  invoiceId     = (String) r[3];
            BigDecimal amount     = r[4] != null ? new BigDecimal(r[4].toString()) : BigDecimal.ZERO;
            LocalDateTime addedOn = (LocalDateTime) r[5];
            return new VehicleGasLogRow(gasLogId, model, plate, invoiceId, amount, addedOn);
        }).toList();
    }
}
