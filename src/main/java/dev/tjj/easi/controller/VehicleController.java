package dev.tjj.easi.controller;

import dev.tjj.easi.dto.VehicleRequest;
import dev.tjj.easi.dto.VehicleResponse;
import dev.tjj.easi.service.VehicleService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoints for vehicle management.
 * ADMIN and STAFF can create and update vehicles.
 * ADMIN, STAFF, and CREW can read vehicles.
 */
@RestController
@RequestMapping("/api/vehicles")
public class VehicleController {

    private final VehicleService vehicleService;

    public VehicleController(VehicleService vehicleService) {
        this.vehicleService = vehicleService;
    }

    /** Registers a new vehicle. Restricted to ADMIN and STAFF. */
    @PostMapping
    public ResponseEntity<VehicleResponse> register(@Valid @RequestBody VehicleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(vehicleService.register(request));
    }

    /** Updates an existing vehicle by ID. Restricted to ADMIN and STAFF. */
    @PutMapping("/{vehiclesId}")
    public ResponseEntity<VehicleResponse> update(
            @PathVariable Integer vehiclesId,
            @Valid @RequestBody VehicleRequest request) {
        return ResponseEntity.ok(vehicleService.update(vehiclesId, request));
    }

    /** Returns all vehicle records. Available to ADMIN, STAFF, and CREW. */
    @GetMapping
    public ResponseEntity<List<VehicleResponse>> getAll() {
        return ResponseEntity.ok(vehicleService.getAll());
    }

    /** Returns a single vehicle record by ID. Available to ADMIN, STAFF, and CREW. */
    @GetMapping("/{vehiclesId}")
    public ResponseEntity<VehicleResponse> getById(@PathVariable Integer vehiclesId) {
        return ResponseEntity.ok(vehicleService.getById(vehiclesId));
    }
}
