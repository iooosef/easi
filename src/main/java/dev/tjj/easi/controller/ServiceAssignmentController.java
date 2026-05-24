package dev.tjj.easi.controller;

import dev.tjj.easi.dto.ServiceAssignmentRequest;
import dev.tjj.easi.dto.ServiceAssignmentResponse;
import dev.tjj.easi.service.ServiceAssignmentService;
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

import java.util.List;

/**
 * REST endpoints for service assignment management.
 * ADMIN and STAFF can add, update, and delete assignments.
 * ADMIN, STAFF, HR, and CREW can view assignments.
 */
@Tag(name = "Service Assignments", description = "Manage crew assignments to service schedules")
@RestController
@RequestMapping("/api/service-assignments")
public class ServiceAssignmentController {

    private final ServiceAssignmentService assignmentService;

    public ServiceAssignmentController(ServiceAssignmentService assignmentService) {
        this.assignmentService = assignmentService;
    }

    /** Adds a new service assignment. Restricted to ADMIN and STAFF. */
    @Operation(summary = "Create a service assignment", description = "Assigns a crew employee to a service schedule. Restricted to ADMIN and STAFF.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Assignment created"),
        @ApiResponse(responseCode = "400", description = "Validation error"),
        @ApiResponse(responseCode = "404", description = "Employee or schedule not found"),
    })
    @PostMapping
    public ResponseEntity<ServiceAssignmentResponse> add(@Valid @RequestBody ServiceAssignmentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(assignmentService.add(request));
    }

    /** Updates an existing service assignment by ID. Restricted to ADMIN and STAFF. */
    @Operation(summary = "Update a service assignment", description = "Replaces the employee or schedule linked to an existing assignment. Restricted to ADMIN and STAFF.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Assignment updated"),
        @ApiResponse(responseCode = "400", description = "Validation error"),
        @ApiResponse(responseCode = "404", description = "Assignment, employee, or schedule not found"),
    })
    @PutMapping("/{servAssgnId}")
    public ResponseEntity<ServiceAssignmentResponse> update(
            @Parameter(description = "Assignment ID", example = "1") @PathVariable Integer servAssgnId,
            @Valid @RequestBody ServiceAssignmentRequest request) {
        return ResponseEntity.ok(assignmentService.update(servAssgnId, request));
    }

    /** Deletes a service assignment by ID. Restricted to ADMIN and STAFF. */
    @Operation(summary = "Delete a service assignment", description = "Permanently removes a crew assignment from a schedule. Restricted to ADMIN and STAFF.")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Assignment deleted"),
        @ApiResponse(responseCode = "404", description = "Assignment not found"),
    })
    @DeleteMapping("/{servAssgnId}")
    public ResponseEntity<Void> delete(
            @Parameter(description = "Assignment ID", example = "1") @PathVariable Integer servAssgnId) {
        assignmentService.delete(servAssgnId);
        return ResponseEntity.noContent().build();
    }

    /** Returns a page of service assignment records. Available to ADMIN, STAFF, HR, and CREW. */
    @Operation(summary = "List all service assignments", description = "Returns a paginated list of all service assignments.")
    @ApiResponses({ @ApiResponse(responseCode = "200", description = "Page of assignments returned") })
    @GetMapping
    public ResponseEntity<Page<ServiceAssignmentResponse>> getAll(Pageable pageable) {
        return ResponseEntity.ok(assignmentService.getAll(pageable));
    }

    /** Returns all assignments for a specific schedule. Available to ADMIN, STAFF, HR, and CREW. */
    @Operation(summary = "Get assignments by schedule", description = "Returns all crew assignments linked to the given schedule ID.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "List of assignments returned"),
        @ApiResponse(responseCode = "404", description = "Schedule not found"),
    })
    @GetMapping("/schedule/{schedId}")
    public ResponseEntity<List<ServiceAssignmentResponse>> getBySchedule(
            @Parameter(description = "Schedule ID", example = "1") @PathVariable Integer schedId) {
        return ResponseEntity.ok(assignmentService.getBySchedule(schedId));
    }

    /** Returns a single service assignment record by ID. Available to ADMIN, STAFF, HR, and CREW. */
    @Operation(summary = "Get assignment by ID", description = "Returns a single service assignment record.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Assignment returned"),
        @ApiResponse(responseCode = "404", description = "Assignment not found"),
    })
    @GetMapping("/{servAssgnId}")
    public ResponseEntity<ServiceAssignmentResponse> getById(
            @Parameter(description = "Assignment ID", example = "1") @PathVariable Integer servAssgnId) {
        return ResponseEntity.ok(assignmentService.getById(servAssgnId));
    }
}
