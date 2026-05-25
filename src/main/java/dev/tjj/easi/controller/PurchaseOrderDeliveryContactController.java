package dev.tjj.easi.controller;

import dev.tjj.easi.dto.PurchaseOrderDeliveryContactRequest;
import dev.tjj.easi.dto.PurchaseOrderDeliveryContactResponse;
import dev.tjj.easi.service.PurchaseOrderDeliveryContactService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST endpoints for purchase order delivery contact management.
 * ADMIN, ACCOUNTING, and STAFF can add, update, and view delivery contacts.
 */
@RestController
@RequestMapping("/api/purchase-order-delivery-contacts")
public class PurchaseOrderDeliveryContactController {

    private final PurchaseOrderDeliveryContactService contactService;

    public PurchaseOrderDeliveryContactController(PurchaseOrderDeliveryContactService contactService) {
        this.contactService = contactService;
    }

    /** Adds a new purchase order delivery contact. Restricted to ADMIN, ACCOUNTING, and STAFF. */
    @PostMapping
    public ResponseEntity<PurchaseOrderDeliveryContactResponse> add(@Valid @RequestBody PurchaseOrderDeliveryContactRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(contactService.add(request));
    }

    /** Updates an existing purchase order delivery contact by ID. Restricted to ADMIN, ACCOUNTING, and STAFF. */
    @PutMapping("/{poContactNum}")
    public ResponseEntity<PurchaseOrderDeliveryContactResponse> update(
            @PathVariable Integer poContactNum,
            @Valid @RequestBody PurchaseOrderDeliveryContactRequest request) {
        return ResponseEntity.ok(contactService.update(poContactNum, request));
    }

    /** Returns a page of purchase order delivery contact records, optionally filtered by poNum. Available to ADMIN, ACCOUNTING, and STAFF. */
    @GetMapping
    public ResponseEntity<Page<PurchaseOrderDeliveryContactResponse>> getAll(
            @RequestParam(required = false) String poNum,
            Pageable pageable) {
        return ResponseEntity.ok(contactService.getAll(poNum, pageable));
    }

    /** Returns a single purchase order delivery contact record by ID. Available to ADMIN, ACCOUNTING, and STAFF. */
    @GetMapping("/{poContactNum}")
    public ResponseEntity<PurchaseOrderDeliveryContactResponse> getById(@PathVariable Integer poContactNum) {
        return ResponseEntity.ok(contactService.getById(poContactNum));
    }

    /** Deletes a purchase order delivery contact by ID. Restricted to ADMIN, ACCOUNTING, and STAFF. */
    @DeleteMapping("/{poContactNum}")
    public ResponseEntity<Void> delete(@PathVariable Integer poContactNum) {
        contactService.delete(poContactNum);
        return ResponseEntity.noContent().build();
    }
}
