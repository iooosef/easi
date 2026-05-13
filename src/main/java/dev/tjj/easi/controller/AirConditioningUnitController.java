package dev.tjj.easi.controller;

import dev.tjj.easi.dto.AirConditioningUnitRequest;
import dev.tjj.easi.dto.AirConditioningUnitResponse;
import dev.tjj.easi.service.AirConditioningUnitService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoints for air conditioning unit management.
 * ADMIN and STAFF can add and update units.
 * All authenticated users can view units.
 */
@RestController
@RequestMapping("/api/ac-units")
public class AirConditioningUnitController {

    private final AirConditioningUnitService acService;

    public AirConditioningUnitController(AirConditioningUnitService acService) {
        this.acService = acService;
    }

    /** Registers a new air conditioning unit. Restricted to ADMIN and STAFF. */
    @PostMapping
    public ResponseEntity<AirConditioningUnitResponse> add(@Valid @RequestBody AirConditioningUnitRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(acService.add(request));
    }

    /** Updates an existing air conditioning unit by ID. Restricted to ADMIN and STAFF. */
    @PutMapping("/{acNum}")
    public ResponseEntity<AirConditioningUnitResponse> update(
            @PathVariable Integer acNum,
            @Valid @RequestBody AirConditioningUnitRequest request) {
        return ResponseEntity.ok(acService.update(acNum, request));
    }

    /** Returns all air conditioning unit records. */
    @GetMapping
    public ResponseEntity<List<AirConditioningUnitResponse>> getAll() {
        return ResponseEntity.ok(acService.getAll());
    }

    /** Returns a single air conditioning unit record by ID. */
    @GetMapping("/{acNum}")
    public ResponseEntity<AirConditioningUnitResponse> getById(@PathVariable Integer acNum) {
        return ResponseEntity.ok(acService.getById(acNum));
    }
}
