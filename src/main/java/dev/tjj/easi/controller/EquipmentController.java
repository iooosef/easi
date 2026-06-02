package dev.tjj.easi.controller;

import dev.tjj.easi.dto.EquipmentRequest;
import dev.tjj.easi.dto.EquipmentResponse;
import dev.tjj.easi.service.EquipmentService;
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
 * REST endpoints for managing equipment records.
 * ADMIN and STAFF can create, update, and delete; all authenticated staff roles can read.
 */
@Tag(name = "Equipment", description = "Manage durable and consumable equipment used in service operations")
@RestController
@RequestMapping("/api/equipment")
public class EquipmentController {

    private final EquipmentService equipmentService;

    public EquipmentController(EquipmentService equipmentService) {
        this.equipmentService = equipmentService;
    }

    @Operation(
            summary = "Add a new equipment record",
            description = "Creates an equipment record. Type must be 'durable' or 'consumable'. Stock defaults to 1; set higher for bulk consumables."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Equipment created successfully"),
            @ApiResponse(responseCode = "400", description = "Validation failed"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated"),
            @ApiResponse(responseCode = "403", description = "Insufficient role"),
            @ApiResponse(responseCode = "404", description = "Referenced PO not found")
    })
    @PostMapping
    public ResponseEntity<EquipmentResponse> add(@Valid @RequestBody EquipmentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(equipmentService.add(request));
    }

    @Operation(
            summary = "Update an equipment record",
            description = "Replaces all mutable fields of the equipment record. The PO link can be cleared by passing null for poNum."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Updated successfully"),
            @ApiResponse(responseCode = "400", description = "Validation failed"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated"),
            @ApiResponse(responseCode = "403", description = "Insufficient role"),
            @ApiResponse(responseCode = "404", description = "Equipment or PO not found")
    })
    @PutMapping("/{equipmentId}")
    public ResponseEntity<EquipmentResponse> update(
            @Parameter(description = "Equipment ID to update", example = "1")
            @PathVariable Integer equipmentId,
            @Valid @RequestBody EquipmentRequest request) {
        return ResponseEntity.ok(equipmentService.update(equipmentId, request));
    }

    @Operation(
            summary = "Delete an equipment record",
            description = "Removes the equipment record. Restricted to ADMIN."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Deleted successfully"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated"),
            @ApiResponse(responseCode = "403", description = "Insufficient role"),
            @ApiResponse(responseCode = "404", description = "Equipment not found")
    })
    @DeleteMapping("/{equipmentId}")
    public ResponseEntity<Void> delete(
            @Parameter(description = "Equipment ID to delete", example = "1")
            @PathVariable Integer equipmentId) {
        equipmentService.delete(equipmentId);
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "Get equipment by ID",
            description = "Returns a single equipment record."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Equipment found"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated"),
            @ApiResponse(responseCode = "403", description = "Insufficient role"),
            @ApiResponse(responseCode = "404", description = "Equipment not found")
    })
    @GetMapping("/{equipmentId}")
    public ResponseEntity<EquipmentResponse> getById(
            @Parameter(description = "Equipment ID", example = "1")
            @PathVariable Integer equipmentId) {
        return ResponseEntity.ok(equipmentService.getById(equipmentId));
    }

    @Operation(
            summary = "Search equipment",
            description = "Returns a paginated list of equipment records. Optionally filter by keyword (name/model), type, and status."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "List returned successfully"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated"),
            @ApiResponse(responseCode = "403", description = "Insufficient role")
    })
    @GetMapping
    public ResponseEntity<Page<EquipmentResponse>> search(
            @Parameter(description = "Search keyword against name or model", example = "pump")
            @RequestParam(required = false) String search,
            @Parameter(description = "Filter by type: durable or consumable", example = "durable")
            @RequestParam(required = false) String type,
            @Parameter(description = "Filter by status: active, under_maintenance, retired, depleted", example = "active")
            @RequestParam(required = false) String status,
            @Parameter(description = "Filter by PO number — returns equipment linked to this PO", example = "PO-2025-001")
            @RequestParam(required = false) String poNum,
            Pageable pageable) {
        return ResponseEntity.ok(equipmentService.search(search, type, status, poNum, pageable));
    }
}
