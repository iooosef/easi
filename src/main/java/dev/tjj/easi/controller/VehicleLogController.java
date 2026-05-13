package dev.tjj.easi.controller;

import dev.tjj.easi.dto.VehicleLogRequest;
import dev.tjj.easi.dto.VehicleLogResponse;
import dev.tjj.easi.service.VehicleLogService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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

    /** Returns all vehicle log records. Available to ADMIN, CREW, and STAFF. */
    @GetMapping
    public ResponseEntity<List<VehicleLogResponse>> getAll() {
        return ResponseEntity.ok(vehicleLogService.getAll());
    }

    /** Returns a single vehicle log record by ID. Available to ADMIN, CREW, and STAFF. */
    @GetMapping("/{vehicleLogId}")
    public ResponseEntity<VehicleLogResponse> getById(@PathVariable Integer vehicleLogId) {
        return ResponseEntity.ok(vehicleLogService.getById(vehicleLogId));
    }
}
