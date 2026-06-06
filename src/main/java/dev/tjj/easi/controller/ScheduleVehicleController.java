package dev.tjj.easi.controller;

import dev.tjj.easi.dto.ScheduleVehicleRequest;
import dev.tjj.easi.dto.ScheduleVehicleResponse;
import dev.tjj.easi.service.ScheduleVehicleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoints for managing vehicle assignments to service schedules.
 * ADMIN and STAFF can assign and remove vehicles; all authenticated users can view.
 */
@Tag(name = "Schedule Vehicles", description = "Manage vehicle assignments to service schedules")
@RestController
@RequestMapping("/api/schedule-vehicles")
public class ScheduleVehicleController {

    private final ScheduleVehicleService scheduleVehicleService;

    public ScheduleVehicleController(ScheduleVehicleService scheduleVehicleService) {
        this.scheduleVehicleService = scheduleVehicleService;
    }

    /** Assigns a vehicle to a service schedule. Restricted to ADMIN and STAFF. */
    @Operation(summary = "Assign vehicle to a schedule",
               description = "Links a vehicle to a service schedule. The same vehicle cannot be assigned to the same schedule more than once, but can appear on multiple schedules on the same day.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Vehicle assigned"),
        @ApiResponse(responseCode = "400", description = "Validation error or duplicate assignment"),
        @ApiResponse(responseCode = "404", description = "Vehicle or schedule not found"),
    })
    @PostMapping
    public ResponseEntity<ScheduleVehicleResponse> add(@Valid @RequestBody ScheduleVehicleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(scheduleVehicleService.add(request));
    }

    /** Returns all vehicle assignments for a specific schedule. */
    @Operation(summary = "Get vehicles by schedule",
               description = "Returns all vehicle assignments linked to the given schedule ID.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "List of vehicle assignments returned"),
    })
    @GetMapping("/schedule/{schedId}")
    public ResponseEntity<List<ScheduleVehicleResponse>> getBySchedule(
            @Parameter(description = "Schedule ID", example = "1") @PathVariable Integer schedId) {
        return ResponseEntity.ok(scheduleVehicleService.getBySchedule(schedId));
    }

    /** Removes a vehicle assignment by ID. Restricted to ADMIN and STAFF. */
    @Operation(summary = "Remove vehicle assignment",
               description = "Permanently removes a vehicle assignment from a schedule.")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Assignment removed"),
        @ApiResponse(responseCode = "404", description = "Assignment not found"),
    })
    @DeleteMapping("/{schedVehicleId}")
    public ResponseEntity<Void> delete(
            @Parameter(description = "Schedule vehicle assignment ID", example = "1") @PathVariable Integer schedVehicleId) {
        scheduleVehicleService.delete(schedVehicleId);
        return ResponseEntity.noContent().build();
    }
}
