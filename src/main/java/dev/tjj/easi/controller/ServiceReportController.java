package dev.tjj.easi.controller;

import dev.tjj.easi.dto.ServiceReportDocumentRequest;
import dev.tjj.easi.dto.ServiceReportRequest;
import dev.tjj.easi.dto.ServiceReportResponse;
import dev.tjj.easi.service.ServiceReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST endpoints for service report management.
 * ADMIN and STAFF can add and update reports.
 * ADMIN, STAFF, and CREW can view reports.
 */
@Tag(name = "Service Reports", description = "Manage project service reports")
@RestController
@RequestMapping("/api/service-reports")
public class ServiceReportController {

    private final ServiceReportService serviceReportService;

    public ServiceReportController(ServiceReportService serviceReportService) {
        this.serviceReportService = serviceReportService;
    }

    /** Adds a new service report. Restricted to ADMIN and STAFF. */
    @Operation(summary = "Create a service report", description = "Creates a new service report for a project. Requires ADMIN or STAFF role.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Service report created"),
        @ApiResponse(responseCode = "400", description = "Validation failed"),
        @ApiResponse(responseCode = "403", description = "Forbidden")
    })
    @PostMapping
    public ResponseEntity<ServiceReportResponse> add(@Valid @RequestBody ServiceReportRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(serviceReportService.add(request));
    }

    /** Updates an existing service report by ID. Restricted to ADMIN and STAFF. */
    @Operation(summary = "Update a service report", description = "Updates all fields of an existing service report by SR number.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Service report updated"),
        @ApiResponse(responseCode = "400", description = "Validation failed"),
        @ApiResponse(responseCode = "403", description = "Forbidden"),
        @ApiResponse(responseCode = "404", description = "Service report not found")
    })
    @PutMapping("/{srNumber}")
    public ResponseEntity<ServiceReportResponse> update(
            @Parameter(description = "Service report number", example = "1") @PathVariable Integer srNumber,
            @Valid @RequestBody ServiceReportRequest request) {
        return ResponseEntity.ok(serviceReportService.update(srNumber, request));
    }

    /**
     * Links or unlinks a document on a service report.
     * Pass null docuId to unlink the current document.
     */
    @Operation(summary = "Set document on service report",
               description = "Links a document to a service report by docuId. A service report can have at most one document. Pass null to remove the current document.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Document linked/unlinked"),
        @ApiResponse(responseCode = "403", description = "Forbidden"),
        @ApiResponse(responseCode = "404", description = "Service report or document not found")
    })
    @PatchMapping("/{srNumber}/document")
    public ResponseEntity<ServiceReportResponse> updateDocument(
            @Parameter(description = "Service report number", example = "1") @PathVariable Integer srNumber,
            @RequestBody ServiceReportDocumentRequest request) {
        return ResponseEntity.ok(serviceReportService.updateDocument(srNumber, request.docuId()));
    }

    /** Returns a page of service report records. Available to ADMIN, STAFF, and CREW. */
    @Operation(summary = "List service reports", description = "Returns a paginated list of service reports, optionally filtered by project number.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Reports returned"),
        @ApiResponse(responseCode = "403", description = "Forbidden")
    })
    @GetMapping
    public ResponseEntity<Page<ServiceReportResponse>> getAll(
            @Parameter(description = "Filter by project number") @RequestParam(required = false) Integer projNum,
            Pageable pageable) {
        return ResponseEntity.ok(serviceReportService.getAll(projNum, pageable));
    }

    /** Returns a single service report record by ID. Available to ADMIN, STAFF, and CREW. */
    @Operation(summary = "Get service report by ID", description = "Returns a single service report record by SR number.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Service report found"),
        @ApiResponse(responseCode = "404", description = "Service report not found")
    })
    @GetMapping("/{srNumber}")
    public ResponseEntity<ServiceReportResponse> getById(
            @Parameter(description = "Service report number", example = "1") @PathVariable Integer srNumber) {
        return ResponseEntity.ok(serviceReportService.getById(srNumber));
    }
}
