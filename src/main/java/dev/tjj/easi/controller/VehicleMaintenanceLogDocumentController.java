package dev.tjj.easi.controller;

import dev.tjj.easi.dto.VehicleMaintenanceLogDocumentRequest;
import dev.tjj.easi.dto.VehicleMaintenanceLogDocumentResponse;
import dev.tjj.easi.service.VehicleMaintenanceLogDocumentService;

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

@RestController
@RequestMapping("/api/vehicle-maintenance-log-documents")
public class VehicleMaintenanceLogDocumentController {

    private final VehicleMaintenanceLogDocumentService service;

    public VehicleMaintenanceLogDocumentController(
            VehicleMaintenanceLogDocumentService service) {

        this.service = service;
    }

    /** Adds a new vehicle maintenance log document record. */
    @PostMapping
    public ResponseEntity<VehicleMaintenanceLogDocumentResponse> add(
            @Valid @RequestBody
            VehicleMaintenanceLogDocumentRequest request) {

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.add(request));
    }

    /** Updates an existing vehicle maintenance log document record by ID. */
    @PutMapping("/{mntLogDocId}")
    public ResponseEntity<VehicleMaintenanceLogDocumentResponse> update(
            @PathVariable Integer mntLogDocId,
            @Valid @RequestBody
            VehicleMaintenanceLogDocumentRequest request) {

        return ResponseEntity.ok(
                service.update(mntLogDocId, request));
    }
    /** Returns a page of vehicle maintenance log document records,
        optionally filtered by maintenance log ID. */
    @GetMapping
    public ResponseEntity<Page<VehicleMaintenanceLogDocumentResponse>>
    getAll(
            @RequestParam(required = false)
            Integer mntLogId,
            Pageable pageable) {

        if (mntLogId != null) {
            return ResponseEntity.ok(
                    service.getByMaintenanceLogId(
                            mntLogId,
                            pageable));
        }

        return ResponseEntity.ok(
                service.getAll(pageable));
    }
    /** Returns a single vehicle maintenance log document record by ID. */
    @GetMapping("/{mntLogDocId}")
    public ResponseEntity<VehicleMaintenanceLogDocumentResponse>
    getById(@PathVariable Integer mntLogDocId) {

        return ResponseEntity.ok(
                service.getById(mntLogDocId));
    }
}