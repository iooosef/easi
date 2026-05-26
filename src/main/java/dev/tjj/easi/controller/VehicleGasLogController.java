package dev.tjj.easi.controller;

import dev.tjj.easi.dto.VehicleGasLogRequest;
import dev.tjj.easi.dto.VehicleGasLogResponse;
import dev.tjj.easi.service.VehicleGasLogService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST endpoints for vehicle gas log management.
 * ADMIN, CREW, and STAFF can add, update, and view vehicle gas logs.
 */
@RestController
@RequestMapping("/api/vehicle-gas-logs")
public class VehicleGasLogController {

    private final VehicleGasLogService gasLogService;

    public VehicleGasLogController(VehicleGasLogService gasLogService) {
        this.gasLogService = gasLogService;
    }

    /** Adds a new vehicle gas log. Restricted to ADMIN, CREW, and STAFF. */
    @PostMapping
    public ResponseEntity<VehicleGasLogResponse> add(@Valid @RequestBody VehicleGasLogRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(gasLogService.add(request));
    }

    /** Updates an existing vehicle gas log by ID. Restricted to ADMIN, CREW, and STAFF. */
    @PutMapping("/{gasLogId}")
    public ResponseEntity<VehicleGasLogResponse> update(
            @PathVariable Integer gasLogId,
            @Valid @RequestBody VehicleGasLogRequest request) {
        return ResponseEntity.ok(gasLogService.update(gasLogId, request));
    }

    /** Returns a page of vehicle gas log records, optionally filtered by vehicle log ID. Available to ADMIN, CREW, and STAFF. */
    @GetMapping
    public ResponseEntity<Page<VehicleGasLogResponse>> getAll(
            @RequestParam(required = false) Integer vehicleLogId,
            Pageable pageable) {
        if (vehicleLogId != null) {
            return ResponseEntity.ok(gasLogService.getByVehicleLogId(vehicleLogId, pageable));
        }
        return ResponseEntity.ok(gasLogService.getAll(pageable));
    }

    /** Returns a single vehicle gas log record by ID. Available to ADMIN, CREW, and STAFF. */
    @GetMapping("/{gasLogId}")
    public ResponseEntity<VehicleGasLogResponse> getById(@PathVariable Integer gasLogId) {
        return ResponseEntity.ok(gasLogService.getById(gasLogId));
    }
}
