package dev.tjj.easi.controller;

import dev.tjj.easi.dto.PurchaseOrderRequest;
import dev.tjj.easi.dto.PurchaseOrderResponse;
import dev.tjj.easi.service.PurchaseOrderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST endpoints for purchase order management.
 * ADMIN, ACCOUNTING, and STAFF can add, update, and view purchase orders.
 */
@RestController
@RequestMapping("/api/purchase-orders")
public class PurchaseOrderController {

    private final PurchaseOrderService purchaseOrderService;

    public PurchaseOrderController(PurchaseOrderService purchaseOrderService) {
        this.purchaseOrderService = purchaseOrderService;
    }

    /** Adds a new purchase order. Restricted to ADMIN, ACCOUNTING, and STAFF. */
    @PostMapping
    public ResponseEntity<PurchaseOrderResponse> add(@Valid @RequestBody PurchaseOrderRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(purchaseOrderService.add(request));
    }

    /** Updates an existing purchase order by PO number. Restricted to ADMIN, ACCOUNTING, and STAFF. */
    @PutMapping("/{poNum}")
    public ResponseEntity<PurchaseOrderResponse> update(
            @PathVariable String poNum,
            @Valid @RequestBody PurchaseOrderRequest request) {
        return ResponseEntity.ok(purchaseOrderService.update(poNum, request));
    }

    /** Returns a page of purchase order records. Available to ADMIN, ACCOUNTING, and STAFF. */
    @GetMapping
    public ResponseEntity<Page<PurchaseOrderResponse>> getAll(Pageable pageable) {
        return ResponseEntity.ok(purchaseOrderService.getAll(pageable));
    }

    /** Returns a single purchase order record by PO number. Available to ADMIN, ACCOUNTING, and STAFF. */
    @GetMapping("/{poNum}")
    public ResponseEntity<PurchaseOrderResponse> getById(@PathVariable String poNum) {
        return ResponseEntity.ok(purchaseOrderService.getById(poNum));
    }
}
