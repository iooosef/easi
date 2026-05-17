package dev.tjj.easi.controller;

import dev.tjj.easi.dto.PartRequest;
import dev.tjj.easi.dto.PartResponse;
import dev.tjj.easi.service.PartService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST endpoints for part management.
 * ADMIN, ACCOUNTING, and STAFF can add, update, and view parts.
 */
@RestController
@RequestMapping("/api/parts")
public class PartController {

    private final PartService partService;

    public PartController(PartService partService) {
        this.partService = partService;
    }

    /** Adds a new part. Restricted to ADMIN, ACCOUNTING, and STAFF. */
    @PostMapping
    public ResponseEntity<PartResponse> add(@Valid @RequestBody PartRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(partService.add(request));
    }

    /** Updates an existing part by ID. Restricted to ADMIN, ACCOUNTING, and STAFF. */
    @PutMapping("/{partId}")
    public ResponseEntity<PartResponse> update(
            @PathVariable Integer partId,
            @Valid @RequestBody PartRequest request) {
        return ResponseEntity.ok(partService.update(partId, request));
    }

    /** Returns a page of part records. Available to ADMIN, ACCOUNTING, and STAFF. */
    @GetMapping
    public ResponseEntity<Page<PartResponse>> getAll(Pageable pageable) {
        return ResponseEntity.ok(partService.getAll(pageable));
    }

    /** Returns a single part record by ID. Available to ADMIN, ACCOUNTING, and STAFF. */
    @GetMapping("/{partId}")
    public ResponseEntity<PartResponse> getById(@PathVariable Integer partId) {
        return ResponseEntity.ok(partService.getById(partId));
    }
}
