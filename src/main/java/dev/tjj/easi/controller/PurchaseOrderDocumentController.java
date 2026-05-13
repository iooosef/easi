package dev.tjj.easi.controller;

import dev.tjj.easi.dto.PurchaseOrderDocumentRequest;
import dev.tjj.easi.dto.PurchaseOrderDocumentResponse;
import dev.tjj.easi.service.PurchaseOrderDocumentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoints for purchase order document management.
 * ADMIN, ACCOUNTING, and STAFF can add, update, and view purchase order documents.
 */
@RestController
@RequestMapping("/api/purchase-order-documents")
public class PurchaseOrderDocumentController {

    private final PurchaseOrderDocumentService poDocumentService;

    public PurchaseOrderDocumentController(PurchaseOrderDocumentService poDocumentService) {
        this.poDocumentService = poDocumentService;
    }

    /** Adds a new purchase order document. Restricted to ADMIN, ACCOUNTING, and STAFF. */
    @PostMapping
    public ResponseEntity<PurchaseOrderDocumentResponse> add(@Valid @RequestBody PurchaseOrderDocumentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(poDocumentService.add(request));
    }

    /** Updates an existing purchase order document by ID. Restricted to ADMIN, ACCOUNTING, and STAFF. */
    @PutMapping("/{poDocNum}")
    public ResponseEntity<PurchaseOrderDocumentResponse> update(
            @PathVariable Integer poDocNum,
            @Valid @RequestBody PurchaseOrderDocumentRequest request) {
        return ResponseEntity.ok(poDocumentService.update(poDocNum, request));
    }

    /** Returns all purchase order document records. Available to ADMIN, ACCOUNTING, and STAFF. */
    @GetMapping
    public ResponseEntity<List<PurchaseOrderDocumentResponse>> getAll() {
        return ResponseEntity.ok(poDocumentService.getAll());
    }

    /** Returns a single purchase order document record by ID. Available to ADMIN, ACCOUNTING, and STAFF. */
    @GetMapping("/{poDocNum}")
    public ResponseEntity<PurchaseOrderDocumentResponse> getById(@PathVariable Integer poDocNum) {
        return ResponseEntity.ok(poDocumentService.getById(poDocNum));
    }
}
