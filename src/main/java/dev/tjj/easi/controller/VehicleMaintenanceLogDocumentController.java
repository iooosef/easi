package dev.tjj.easi.controller;

import dev.tjj.easi.dto.VehicleMaintenanceLogDocumentRequest;
import dev.tjj.easi.dto.VehicleMaintenanceLogDocumentResponse;
import dev.tjj.easi.service.VehicleMaintenanceLogDocumentService;
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

/**
 * REST endpoints for vehicle maintenance log document management.
 * ADMIN and STAFF can link and remove documents.
 * All authenticated users can view the linked documents.
 */
@Tag(name = "Vehicle Maintenance Log Documents", description = "Manage documents linked to vehicle maintenance logs")
@RestController
@RequestMapping("/api/vehicle-maintenance-log-documents")
public class VehicleMaintenanceLogDocumentController {

    private final VehicleMaintenanceLogDocumentService service;

    public VehicleMaintenanceLogDocumentController(VehicleMaintenanceLogDocumentService service) {
        this.service = service;
    }

    /** Links a document to a vehicle maintenance log. */
    @Operation(summary = "Link a document to a maintenance log",
               description = "Creates a link between an existing document and a vehicle maintenance log. Both must already exist.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Link created successfully"),
        @ApiResponse(responseCode = "400", description = "Validation failed or missing required fields"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "403", description = "Forbidden — requires ADMIN or STAFF role"),
        @ApiResponse(responseCode = "404", description = "Maintenance log or document not found")
    })
    @PostMapping
    public ResponseEntity<VehicleMaintenanceLogDocumentResponse> add(
            @Valid @RequestBody VehicleMaintenanceLogDocumentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.add(request));
    }

    /** Updates an existing vehicle maintenance log document link by ID. */
    @Operation(summary = "Update a maintenance log document link",
               description = "Replaces the document or maintenance log reference of an existing link record.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Link updated successfully"),
        @ApiResponse(responseCode = "400", description = "Validation failed or missing required fields"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "403", description = "Forbidden — requires ADMIN or STAFF role"),
        @ApiResponse(responseCode = "404", description = "Link, maintenance log, or document not found")
    })
    @PutMapping("/{mntLogDocId}")
    public ResponseEntity<VehicleMaintenanceLogDocumentResponse> update(
            @Parameter(description = "Maintenance log document link ID", example = "1") @PathVariable Integer mntLogDocId,
            @Valid @RequestBody VehicleMaintenanceLogDocumentRequest request) {
        return ResponseEntity.ok(service.update(mntLogDocId, request));
    }

    /** Returns a page of vehicle maintenance log document links, optionally filtered by maintenance log ID. */
    @Operation(summary = "List maintenance log document links",
               description = "Returns a page of document links. Pass mntLogId to filter by maintenance log.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "List returned successfully"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping
    public ResponseEntity<Page<VehicleMaintenanceLogDocumentResponse>> getAll(
            @Parameter(description = "Filter by maintenance log ID", example = "1") @RequestParam(required = false) Integer mntLogId,
            Pageable pageable) {
        if (mntLogId != null) {
            return ResponseEntity.ok(service.getByMaintenanceLogId(mntLogId, pageable));
        }
        return ResponseEntity.ok(service.getAll(pageable));
    }

    /** Removes a vehicle maintenance log document link by ID. */
    @Operation(summary = "Remove a maintenance log document link",
               description = "Deletes the link between a document and a maintenance log. The document record itself is not deleted.")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Link removed successfully"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "403", description = "Forbidden — requires ADMIN or STAFF role"),
        @ApiResponse(responseCode = "404", description = "Link not found")
    })
    @DeleteMapping("/{mntLogDocId}")
    public ResponseEntity<Void> delete(
            @Parameter(description = "Maintenance log document link ID", example = "1") @PathVariable Integer mntLogDocId) {
        service.delete(mntLogDocId);
        return ResponseEntity.noContent().build();
    }

    /** Returns a single vehicle maintenance log document link by ID. */
    @Operation(summary = "Get maintenance log document link by ID",
               description = "Returns a single document link record including document metadata.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Link found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "404", description = "Link not found")
    })
    @GetMapping("/{mntLogDocId}")
    public ResponseEntity<VehicleMaintenanceLogDocumentResponse> getById(
            @Parameter(description = "Maintenance log document link ID", example = "1") @PathVariable Integer mntLogDocId) {
        return ResponseEntity.ok(service.getById(mntLogDocId));
    }
}