package dev.tjj.easi.controller;

import dev.tjj.easi.dto.VehicleMaintenanceLogRequest;
import dev.tjj.easi.dto.VehicleMaintenanceLogResponse;
import dev.tjj.easi.service.VehicleMaintenanceLogService;
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
 * REST endpoints for vehicle maintenance log management.
 * ADMIN, CREW, and STAFF can add, update, and view vehicle maintenance logs.
 */
@Tag(name = "Vehicle Maintenance Logs", description = "Manage vehicle maintenance log records")
@RestController
@RequestMapping("/api/vehicle-maintenance-logs")
public class VehicleMaintenanceLogController {

    private final VehicleMaintenanceLogService maintenanceLogService;

    public VehicleMaintenanceLogController(VehicleMaintenanceLogService maintenanceLogService) {
        this.maintenanceLogService = maintenanceLogService;
    }

    /** Adds a new vehicle maintenance log. */
    @Operation(summary = "Add a vehicle maintenance log",
               description = "Creates a new maintenance log entry linked to an existing vehicle log.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Maintenance log created successfully"),
        @ApiResponse(responseCode = "400", description = "Validation failed or missing required fields"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "403", description = "Forbidden — requires ADMIN, CREW, or STAFF role"),
        @ApiResponse(responseCode = "404", description = "Vehicle log not found")
    })
    @PostMapping
    public ResponseEntity<VehicleMaintenanceLogResponse> add(@Valid @RequestBody VehicleMaintenanceLogRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(maintenanceLogService.add(request));
    }

    /** Updates an existing vehicle maintenance log by ID. */
    @Operation(summary = "Update a vehicle maintenance log",
               description = "Updates the fields of an existing maintenance log record identified by its ID.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Maintenance log updated successfully"),
        @ApiResponse(responseCode = "400", description = "Validation failed or missing required fields"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "403", description = "Forbidden — requires ADMIN, CREW, or STAFF role"),
        @ApiResponse(responseCode = "404", description = "Maintenance log or vehicle log not found")
    })
    @PutMapping("/{mntLogId}")
    public ResponseEntity<VehicleMaintenanceLogResponse> update(
            @Parameter(description = "Maintenance log ID", example = "1") @PathVariable Integer mntLogId,
            @Valid @RequestBody VehicleMaintenanceLogRequest request) {
        return ResponseEntity.ok(maintenanceLogService.update(mntLogId, request));
    }

    /** Returns a page of vehicle maintenance log records, optionally filtered by vehicle log ID. */
    @Operation(summary = "List vehicle maintenance logs",
               description = "Returns a page of maintenance log records. Pass vehicleLogId to filter by vehicle log.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "List returned successfully"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping
    public ResponseEntity<Page<VehicleMaintenanceLogResponse>> getAll(
            @Parameter(description = "Filter by vehicle log ID", example = "1") @RequestParam(required = false) Integer vehicleLogId,
            Pageable pageable) {
        if (vehicleLogId != null) {
            return ResponseEntity.ok(maintenanceLogService.getByVehicleLogId(vehicleLogId, pageable));
        }
        return ResponseEntity.ok(maintenanceLogService.getAll(pageable));
    }

    /** Returns a single vehicle maintenance log record by ID. */
    @Operation(summary = "Get vehicle maintenance log by ID",
               description = "Returns a single maintenance log record including its amount, invoice, and type.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Maintenance log found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "404", description = "Maintenance log not found")
    })
    @GetMapping("/{mntLogId}")
    public ResponseEntity<VehicleMaintenanceLogResponse> getById(
            @Parameter(description = "Maintenance log ID", example = "1") @PathVariable Integer mntLogId) {
        return ResponseEntity.ok(maintenanceLogService.getById(mntLogId));
    }
}