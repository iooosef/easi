package dev.tjj.easi.controller;

import dev.tjj.easi.dto.PurchaseOrderDeliveryContactRequest;
import dev.tjj.easi.dto.PurchaseOrderDeliveryContactResponse;
import dev.tjj.easi.service.PurchaseOrderDeliveryContactService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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

    /** Returns all purchase order delivery contact records. Available to ADMIN, ACCOUNTING, and STAFF. */
    @GetMapping
    public ResponseEntity<List<PurchaseOrderDeliveryContactResponse>> getAll() {
        return ResponseEntity.ok(contactService.getAll());
    }

    /** Returns a single purchase order delivery contact record by ID. Available to ADMIN, ACCOUNTING, and STAFF. */
    @GetMapping("/{poContactNum}")
    public ResponseEntity<PurchaseOrderDeliveryContactResponse> getById(@PathVariable Integer poContactNum) {
        return ResponseEntity.ok(contactService.getById(poContactNum));
    }
}
