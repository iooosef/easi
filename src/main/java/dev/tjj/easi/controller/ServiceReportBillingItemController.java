package dev.tjj.easi.controller;

import dev.tjj.easi.dto.ServiceReportBillingItemRequest;
import dev.tjj.easi.dto.ServiceReportBillingItemResponse;
import dev.tjj.easi.service.ServiceReportBillingItemService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST endpoints for service report billing item management.
 * ADMIN and ACCOUNTING can add and update billing items.
 * ADMIN, ACCOUNTING, STAFF, and CREW can view billing items.
 */
@RestController
@RequestMapping("/api/service-report-billing-items")
public class ServiceReportBillingItemController {

    private final ServiceReportBillingItemService billingItemService;

    public ServiceReportBillingItemController(ServiceReportBillingItemService billingItemService) {
        this.billingItemService = billingItemService;
    }

    /** Adds a new service report billing item. Restricted to ADMIN and ACCOUNTING. */
    @PostMapping
    public ResponseEntity<ServiceReportBillingItemResponse> add(@Valid @RequestBody ServiceReportBillingItemRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(billingItemService.add(request));
    }

    /** Updates an existing service report billing item by ID. Restricted to ADMIN and ACCOUNTING. */
    @PutMapping("/{srBillingNum}")
    public ResponseEntity<ServiceReportBillingItemResponse> update(
            @PathVariable Integer srBillingNum,
            @Valid @RequestBody ServiceReportBillingItemRequest request) {
        return ResponseEntity.ok(billingItemService.update(srBillingNum, request));
    }

    /** Returns a page of service report billing item records. Available to ADMIN, ACCOUNTING, STAFF, and CREW. */
    @GetMapping
    public ResponseEntity<Page<ServiceReportBillingItemResponse>> getAll(Pageable pageable) {
        return ResponseEntity.ok(billingItemService.getAll(pageable));
    }

    /** Returns a single service report billing item record by ID. Available to ADMIN, ACCOUNTING, STAFF, and CREW. */
    @GetMapping("/{srBillingNum}")
    public ResponseEntity<ServiceReportBillingItemResponse> getById(@PathVariable Integer srBillingNum) {
        return ResponseEntity.ok(billingItemService.getById(srBillingNum));
    }
}
