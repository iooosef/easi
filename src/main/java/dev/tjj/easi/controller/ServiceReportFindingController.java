package dev.tjj.easi.controller;

import dev.tjj.easi.dto.ServiceReportFindingRequest;
import dev.tjj.easi.dto.ServiceReportFindingResponse;
import dev.tjj.easi.service.ServiceReportFindingService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoints for service report finding management.
 * ADMIN, STAFF, and CREW can add, update, and view findings.
 */
@RestController
@RequestMapping("/api/service-report-findings")
public class ServiceReportFindingController {

    private final ServiceReportFindingService findingService;

    public ServiceReportFindingController(ServiceReportFindingService findingService) {
        this.findingService = findingService;
    }

    /** Adds a new service report finding. Restricted to ADMIN, STAFF, and CREW. */
    @PostMapping
    public ResponseEntity<ServiceReportFindingResponse> add(@Valid @RequestBody ServiceReportFindingRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(findingService.add(request));
    }

    /** Updates an existing service report finding by ID. Restricted to ADMIN, STAFF, and CREW. */
    @PutMapping("/{srFindingsNumber}")
    public ResponseEntity<ServiceReportFindingResponse> update(
            @PathVariable Integer srFindingsNumber,
            @Valid @RequestBody ServiceReportFindingRequest request) {
        return ResponseEntity.ok(findingService.update(srFindingsNumber, request));
    }

    /** Returns all service report finding records. Available to ADMIN, STAFF, and CREW. */
    @GetMapping
    public ResponseEntity<List<ServiceReportFindingResponse>> getAll() {
        return ResponseEntity.ok(findingService.getAll());
    }

    /** Returns a single service report finding record by ID. Available to ADMIN, STAFF, and CREW. */
    @GetMapping("/{srFindingsNumber}")
    public ResponseEntity<ServiceReportFindingResponse> getById(@PathVariable Integer srFindingsNumber) {
        return ResponseEntity.ok(findingService.getById(srFindingsNumber));
    }
}
