package dev.tjj.easi.controller;

import dev.tjj.easi.dto.report.PartReportRow;
import dev.tjj.easi.dto.report.PurchaseOrderRow;
import dev.tjj.easi.dto.report.ServiceReportSummaryRow;
import dev.tjj.easi.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * REST endpoints for generating filtered summary reports.
 * All endpoints are read-only. Accessible to ADMIN, ACCOUNTING, and STAFF.
 */
@Tag(name = "Reports", description = "Generate filtered summary reports")
@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    /** Returns a flat list of service report rows for the given date range and optional filters. */
    @Operation(
            summary = "Generate service report summary",
            description = "Returns all service reports recorded within the date range. " +
                    "Optionally filter by project or payment status. " +
                    "Each row includes the total billed amount from linked billing items."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Report rows returned"),
            @ApiResponse(responseCode = "400", description = "Missing or invalid date parameters"),
            @ApiResponse(responseCode = "403", description = "Forbidden")
    })
    @GetMapping("/service-report-summary")
    public ResponseEntity<List<ServiceReportSummaryRow>> getServiceReportSummary(
            @Parameter(description = "Start date (inclusive)", example = "2025-01-01")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,

            @Parameter(description = "End date (inclusive)", example = "2025-12-31")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,

            @Parameter(description = "Filter by project number", example = "5")
            @RequestParam(required = false) Integer projNum,

            @Parameter(description = "Filter by payment status", example = "unpaid")
            @RequestParam(required = false) String status) {

        return ResponseEntity.ok(reportService.getServiceReportSummary(
                startDate, endDate, projNum, status));
    }

    /** Returns a flat list of purchase order rows for the given date range. */
    @Operation(
            summary = "Generate purchase orders report",
            description = "Returns all purchase orders created within the date range. " +
                    "Each row includes the PO number, linked SR number, project name, type (parts or equipment), " +
                    "and the computed total cost of all items in the PO."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Report rows returned"),
            @ApiResponse(responseCode = "400", description = "Missing or invalid date parameters"),
            @ApiResponse(responseCode = "403", description = "Forbidden")
    })
    @GetMapping("/purchase-orders")
    public ResponseEntity<List<PurchaseOrderRow>> getPurchaseOrderReport(
            @Parameter(description = "Start date (inclusive)", example = "2025-01-01")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,

            @Parameter(description = "End date (inclusive)", example = "2025-12-31")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        return ResponseEntity.ok(reportService.getPurchaseOrderReport(startDate, endDate));
    }

    /** Returns a flat list of part rows for the given date range. */
    @Operation(
            summary = "Generate parts report",
            description = "Returns all parts added within the date range. " +
                    "Each row includes the part details, supplier name, quantity ordered, " +
                    "total quantity used across all service reports, unit price, and computed total cost."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Report rows returned"),
            @ApiResponse(responseCode = "400", description = "Missing or invalid date parameters"),
            @ApiResponse(responseCode = "403", description = "Forbidden")
    })
    @GetMapping("/parts")
    public ResponseEntity<List<PartReportRow>> getPartsReport(
            @Parameter(description = "Start date (inclusive)", example = "2025-01-01")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,

            @Parameter(description = "End date (inclusive)", example = "2025-12-31")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        return ResponseEntity.ok(reportService.getPartsReport(startDate, endDate));
    }
}
