package dev.tjj.easi.controller;

import dev.tjj.easi.dto.EquipmentUsageRequest;
import dev.tjj.easi.dto.EquipmentUsageResponse;
import dev.tjj.easi.dto.EquipmentUsageUpdateRequest;
import dev.tjj.easi.service.EquipmentUsageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST endpoints for logging and managing equipment deployment events.
 * ADMIN and STAFF can log, update, and delete deployments; all staff roles can read.
 */
@Tag(name = "Equipment Usages", description = "Log and manage equipment deployments to service schedules")
@RestController
@RequestMapping("/api/equipment-usages")
public class EquipmentUsageController {

    private final EquipmentUsageService usageService;

    public EquipmentUsageController(EquipmentUsageService usageService) {
        this.usageService = usageService;
    }

    @Operation(
            summary = "Log equipment deployment",
            description = "Records that a piece of equipment has been deployed to a service schedule. " +
                    "Durable equipment is checked for same-date conflicts — a 409 is returned if already deployed that day. " +
                    "Consumables can be logged to multiple schedules on the same date."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Deployment logged successfully"),
            @ApiResponse(responseCode = "400", description = "Validation failed"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated"),
            @ApiResponse(responseCode = "403", description = "Insufficient role"),
            @ApiResponse(responseCode = "404", description = "Equipment or schedule not found"),
            @ApiResponse(responseCode = "409", description = "Durable equipment already deployed on that date")
    })
    @PostMapping
    public ResponseEntity<EquipmentUsageResponse> add(@Valid @RequestBody EquipmentUsageRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(usageService.add(request));
    }

    @Operation(
            summary = "Update an equipment deployment record",
            description = "Updates the target schedule and notes of an existing deployment. " +
                    "Durable conflict is re-checked against the new schedule date."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Updated successfully"),
            @ApiResponse(responseCode = "400", description = "Validation failed"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated"),
            @ApiResponse(responseCode = "403", description = "Insufficient role"),
            @ApiResponse(responseCode = "404", description = "Usage record or schedule not found"),
            @ApiResponse(responseCode = "409", description = "Durable equipment already deployed on that date")
    })
    @PutMapping("/{usageId}")
    public ResponseEntity<EquipmentUsageResponse> update(
            @Parameter(description = "Usage record ID to update", example = "1")
            @PathVariable Integer usageId,
            @Valid @RequestBody EquipmentUsageUpdateRequest request) {
        return ResponseEntity.ok(usageService.update(usageId, request));
    }

    @Operation(
            summary = "Delete an equipment deployment record",
            description = "Removes a deployment log entry. Restricted to ADMIN."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Deleted successfully"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated"),
            @ApiResponse(responseCode = "403", description = "Insufficient role"),
            @ApiResponse(responseCode = "404", description = "Usage record not found")
    })
    @DeleteMapping("/{usageId}")
    public ResponseEntity<Void> delete(
            @Parameter(description = "Usage record ID to delete", example = "1")
            @PathVariable Integer usageId) {
        usageService.delete(usageId);
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "List deployment records by equipment or schedule",
            description = "Returns a paginated list of deployment events. Provide exactly one of equipmentId or schedId."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "List returned successfully"),
            @ApiResponse(responseCode = "400", description = "Neither or both filter params supplied"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated"),
            @ApiResponse(responseCode = "403", description = "Insufficient role"),
            @ApiResponse(responseCode = "404", description = "Equipment or schedule not found")
    })
    @GetMapping
    public ResponseEntity<Page<EquipmentUsageResponse>> getUsages(
            @Parameter(description = "Equipment ID to filter by", example = "1")
            @RequestParam(required = false) Integer equipmentId,
            @Parameter(description = "Service schedule ID to filter by", example = "3")
            @RequestParam(required = false) Integer schedId,
            Pageable pageable) {
        if (equipmentId != null) {
            return ResponseEntity.ok(usageService.getByEquipment(equipmentId, pageable));
        }
        if (schedId != null) {
            return ResponseEntity.ok(usageService.getBySchedule(schedId, pageable));
        }
        return ResponseEntity.badRequest().build();
    }
}
