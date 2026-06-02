package dev.tjj.easi.controller;

import dev.tjj.easi.dto.VehicleLogRequest;
import dev.tjj.easi.dto.VehicleLogResponse;
import dev.tjj.easi.service.VehicleLogService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST endpoints for vehicle log management.
 * ADMIN, CREW, and STAFF can add, update, and view vehicle logs.
 */
@RestController
@RequestMapping("/api/vehicle-logs")
public class VehicleLogController {

    private final VehicleLogService vehicleLogService;

    public VehicleLogController(VehicleLogService vehicleLogService) {
        this.vehicleLogService = vehicleLogService;
    }

    /** Adds a new vehicle log. Restricted to ADMIN, CREW, and STAFF. */
    @PostMapping
    public ResponseEntity<VehicleLogResponse> add(@Valid @RequestBody VehicleLogRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(vehicleLogService.add(request));
    }

    /** Updates an existing vehicle log by ID. Restricted to ADMIN, CREW, and STAFF. */
    @PutMapping("/{vehicleLogId}")
    public ResponseEntity<VehicleLogResponse> update(
            @PathVariable Integer vehicleLogId,
            @Valid @RequestBody VehicleLogRequest request) {
        return ResponseEntity.ok(vehicleLogService.update(vehicleLogId, request));
    }

    /** Returns a page of vehicle log records, optionally filtered by vehiclesId or schedId. Available to ADMIN, CREW, and STAFF. */
    @GetMapping
    public ResponseEntity<Page<VehicleLogResponse>> getAll(
            @RequestParam(required = false) Integer vehiclesId,
            @RequestParam(required = false) Integer schedId,
            Pageable pageable) {
        return ResponseEntity.ok(vehicleLogService.getAll(vehiclesId, schedId, pageable));
    }

    /** Returns a single vehicle log record by ID. Available to ADMIN, CREW, and STAFF. */
    @GetMapping("/{vehicleLogId}")
    public ResponseEntity<VehicleLogResponse> getById(@PathVariable Integer vehicleLogId) {
        return ResponseEntity.ok(vehicleLogService.getById(vehicleLogId));
    }

    /**
     * Returns the most recent vehicle log with no end odometer for the given vehicle.
     * Returns 204 No Content when no incomplete log exists.
     */
    @GetMapping("/latest-incomplete")
    public ResponseEntity<VehicleLogResponse> getLatestIncomplete(@RequestParam Integer vehiclesId) {
        return vehicleLogService.getLatestIncomplete(vehiclesId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }
}
