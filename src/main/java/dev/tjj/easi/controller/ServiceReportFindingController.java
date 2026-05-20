package dev.tjj.easi.controller;

import dev.tjj.easi.dto.ServiceReportFindingRequest;
import dev.tjj.easi.dto.ServiceReportFindingResponse;
import dev.tjj.easi.service.ServiceReportFindingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST endpoints for service report finding management.
 * ADMIN, STAFF, and CREW can add, update, and view findings.
 */
@Tag(name = "Service Report Findings", description = "Manage findings linked to service reports")
@RestController
@RequestMapping("/api/service-report-findings")
public class ServiceReportFindingController {

    private final ServiceReportFindingService findingService;

    public ServiceReportFindingController(ServiceReportFindingService findingService) {
        this.findingService = findingService;
    }

    /** Adds a new service report finding. Restricted to ADMIN, STAFF, and CREW. */
    @Operation(summary = "Add a service report finding",
               description = "Creates a new finding record linked to a service report and AC unit.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Finding created"),
        @ApiResponse(responseCode = "400", description = "Validation error"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "404", description = "Service report or AC unit not found"),
    })
    @PostMapping
    public ResponseEntity<ServiceReportFindingResponse> add(@Valid @RequestBody ServiceReportFindingRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(findingService.add(request));
    }

    /** Updates an existing service report finding by ID. Restricted to ADMIN, STAFF, and CREW. */
    @Operation(summary = "Update a service report finding",
               description = "Updates an existing finding record identified by its primary key.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Finding updated"),
        @ApiResponse(responseCode = "400", description = "Validation error"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "404", description = "Finding not found"),
    })
    @PutMapping("/{srFindingsNumber}")
    public ResponseEntity<ServiceReportFindingResponse> update(
            @Parameter(description = "Finding primary key", example = "1") @PathVariable Integer srFindingsNumber,
            @Valid @RequestBody ServiceReportFindingRequest request) {
        return ResponseEntity.ok(findingService.update(srFindingsNumber, request));
    }

    /** Returns a page of service report finding records. Available to ADMIN, STAFF, and CREW. */
    @Operation(summary = "List service report findings",
               description = "Returns a paginated list of findings, optionally filtered by service report number.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Page of findings returned"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
    })
    @GetMapping
    public ResponseEntity<Page<ServiceReportFindingResponse>> getAll(
            @Parameter(description = "Filter by service report number", example = "1")
            @RequestParam(required = false) Integer srNumber,
            Pageable pageable) {
        return ResponseEntity.ok(findingService.getAll(srNumber, pageable));
    }

    /** Returns a single service report finding record by ID. Available to ADMIN, STAFF, and CREW. */
    @Operation(summary = "Get a service report finding by ID",
               description = "Returns a single finding record identified by its primary key.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Finding found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "404", description = "Finding not found"),
    })
    @GetMapping("/{srFindingsNumber}")
    public ResponseEntity<ServiceReportFindingResponse> getById(
            @Parameter(description = "Finding primary key", example = "1") @PathVariable Integer srFindingsNumber) {
        return ResponseEntity.ok(findingService.getById(srFindingsNumber));
    }
}
