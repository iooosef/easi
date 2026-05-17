package dev.tjj.easi.controller;

import dev.tjj.easi.dto.ServiceAssignmentRequest;
import dev.tjj.easi.dto.ServiceAssignmentResponse;
import dev.tjj.easi.service.ServiceAssignmentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST endpoints for service assignment management.
 * ADMIN and STAFF can add and update assignments.
 * ADMIN, STAFF, HR, and CREW can view assignments.
 */
@RestController
@RequestMapping("/api/service-assignments")
public class ServiceAssignmentController {

    private final ServiceAssignmentService assignmentService;

    public ServiceAssignmentController(ServiceAssignmentService assignmentService) {
        this.assignmentService = assignmentService;
    }

    /** Adds a new service assignment. Restricted to ADMIN and STAFF. */
    @PostMapping
    public ResponseEntity<ServiceAssignmentResponse> add(@Valid @RequestBody ServiceAssignmentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(assignmentService.add(request));
    }

    /** Updates an existing service assignment by ID. Restricted to ADMIN and STAFF. */
    @PutMapping("/{servAssgnId}")
    public ResponseEntity<ServiceAssignmentResponse> update(
            @PathVariable Integer servAssgnId,
            @Valid @RequestBody ServiceAssignmentRequest request) {
        return ResponseEntity.ok(assignmentService.update(servAssgnId, request));
    }

    /** Returns a page of service assignment records. Available to ADMIN, STAFF, HR, and CREW. */
    @GetMapping
    public ResponseEntity<Page<ServiceAssignmentResponse>> getAll(Pageable pageable) {
        return ResponseEntity.ok(assignmentService.getAll(pageable));
    }

    /** Returns a single service assignment record by ID. Available to ADMIN, STAFF, HR, and CREW. */
    @GetMapping("/{servAssgnId}")
    public ResponseEntity<ServiceAssignmentResponse> getById(@PathVariable Integer servAssgnId) {
        return ResponseEntity.ok(assignmentService.getById(servAssgnId));
    }
}
