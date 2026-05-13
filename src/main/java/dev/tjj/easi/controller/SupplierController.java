package dev.tjj.easi.controller;

import dev.tjj.easi.dto.SupplierRequest;
import dev.tjj.easi.dto.SupplierResponse;
import dev.tjj.easi.service.SupplierService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoints for supplier management.
 * All operations are restricted to ADMIN, ACCOUNTING, and STAFF.
 */
@RestController
@RequestMapping("/api/suppliers")
public class SupplierController {

    private final SupplierService supplierService;

    public SupplierController(SupplierService supplierService) {
        this.supplierService = supplierService;
    }

    /** Creates a new supplier. Restricted to ADMIN, ACCOUNTING, and STAFF. */
    @PostMapping
    public ResponseEntity<SupplierResponse> create(@Valid @RequestBody SupplierRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(supplierService.create(request));
    }

    /** Updates an existing supplier by ID. Restricted to ADMIN, ACCOUNTING, and STAFF. */
    @PutMapping("/{supplierId}")
    public ResponseEntity<SupplierResponse> update(
            @PathVariable Integer supplierId,
            @Valid @RequestBody SupplierRequest request) {
        return ResponseEntity.ok(supplierService.update(supplierId, request));
    }

    /** Returns all supplier records. Restricted to ADMIN, ACCOUNTING, and STAFF. */
    @GetMapping
    public ResponseEntity<List<SupplierResponse>> getAll() {
        return ResponseEntity.ok(supplierService.getAll());
    }

    /** Returns a single supplier record by ID. Restricted to ADMIN, ACCOUNTING, and STAFF. */
    @GetMapping("/{supplierId}")
    public ResponseEntity<SupplierResponse> getById(@PathVariable Integer supplierId) {
        return ResponseEntity.ok(supplierService.getById(supplierId));
    }
}
