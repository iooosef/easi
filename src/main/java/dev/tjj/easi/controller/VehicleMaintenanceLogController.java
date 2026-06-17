package dev.tjj.easi.controller;

import dev.tjj.easi.dto.VehicleMaintenanceLogRequest;
import dev.tjj.easi.dto.VehicleMaintenanceLogResponse;
import dev.tjj.easi.service.VehicleMaintenanceLogService;
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

@RestController
@RequestMapping("/api/vehicle-maintenance-logs")
public class VehicleMaintenanceLogController {

    private final VehicleMaintenanceLogService maintenanceLogService;

    public VehicleMaintenanceLogController(VehicleMaintenanceLogService maintenanceLogService) {
        this.maintenanceLogService = maintenanceLogService;
    }

    /** Adds a new vehicle maintenance log.  */
    @PostMapping
    public ResponseEntity<VehicleMaintenanceLogResponse> add(@Valid @RequestBody VehicleMaintenanceLogRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(maintenanceLogService.add(request));
    }

    /** Updates an existing vehicle maintenance log by ID. */
    @PutMapping("/{mntLogId}")
    public ResponseEntity<VehicleMaintenanceLogResponse> update(
            @PathVariable Integer mntLogId, 
            @Valid @RequestBody VehicleMaintenanceLogRequest request) {
        return ResponseEntity.ok(maintenanceLogService.update(mntLogId, request));
    }

    /** Returns a page of vehicle maintenance log records. */
    @GetMapping
    public ResponseEntity<Page<VehicleMaintenanceLogResponse>> getAll(Pageable pageable) {
        return ResponseEntity.ok(maintenanceLogService.getAll(pageable));
    }

    /** Returns a page of vehicle maintenance log records, optionally filtered by vehicle log ID.*/

    @GetMapping
    public ResponseEntity<Page<VehicleMaintenanceLogResponse>> getAll(
            @RequestParam(required = false) Integer vehicleLogId,
            Pageable pageable) {
        if (vehicleLogId != null) {
            return ResponseEntity.ok(maintenanceLogService.getByVehicleLogId(vehicleLogId, pageable));
        }
        return ResponseEntity.ok(maintenanceLogService.getAll(pageable));
    }
    /** Returns a single vehicle maintenance log record by ID. */
    @GetMapping("/{mntLogId}")
    public ResponseEntity<VehicleMaintenanceLogResponse> getById(@PathVariable Integer mntLogId) {
        return ResponseEntity.ok(maintenanceLogService.getById(mntLogId));
    }
}