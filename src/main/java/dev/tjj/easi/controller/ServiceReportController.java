package dev.tjj.easi.controller;

import dev.tjj.easi.dto.ServiceReportRequest;
import dev.tjj.easi.dto.ServiceReportResponse;
import dev.tjj.easi.service.ServiceReportService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoints for service report management.
 * ADMIN and STAFF can add and update reports.
 * ADMIN, STAFF, and CREW can view reports.
 */
@RestController
@RequestMapping("/api/service-reports")
public class ServiceReportController {

    private final ServiceReportService serviceReportService;

    public ServiceReportController(ServiceReportService serviceReportService) {
        this.serviceReportService = serviceReportService;
    }

    /** Adds a new service report. Restricted to ADMIN and STAFF. */
    @PostMapping
    public ResponseEntity<ServiceReportResponse> add(@Valid @RequestBody ServiceReportRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(serviceReportService.add(request));
    }

    /** Updates an existing service report by ID. Restricted to ADMIN and STAFF. */
    @PutMapping("/{srNumber}")
    public ResponseEntity<ServiceReportResponse> update(
            @PathVariable Integer srNumber,
            @Valid @RequestBody ServiceReportRequest request) {
        return ResponseEntity.ok(serviceReportService.update(srNumber, request));
    }

    /** Returns all service report records. Available to ADMIN, STAFF, and CREW. */
    @GetMapping
    public ResponseEntity<List<ServiceReportResponse>> getAll() {
        return ResponseEntity.ok(serviceReportService.getAll());
    }

    /** Returns a single service report record by ID. Available to ADMIN, STAFF, and CREW. */
    @GetMapping("/{srNumber}")
    public ResponseEntity<ServiceReportResponse> getById(@PathVariable Integer srNumber) {
        return ResponseEntity.ok(serviceReportService.getById(srNumber));
    }
}
