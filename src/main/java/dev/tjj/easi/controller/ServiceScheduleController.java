package dev.tjj.easi.controller;

import dev.tjj.easi.dto.ServiceScheduleRequest;
import dev.tjj.easi.dto.ServiceScheduleResponse;
import dev.tjj.easi.service.ServiceScheduleService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * REST endpoints for service schedule management.
 * ADMIN and STAFF can add and update schedules.
 * All authenticated users can view schedules.
 */
@RestController
@RequestMapping("/api/service-schedules")
public class ServiceScheduleController {

    private final ServiceScheduleService serviceScheduleService;

    public ServiceScheduleController(ServiceScheduleService serviceScheduleService) {
        this.serviceScheduleService = serviceScheduleService;
    }

    /** Adds a new service schedule. Restricted to ADMIN and STAFF. */
    @PostMapping
    public ResponseEntity<ServiceScheduleResponse> add(@Valid @RequestBody ServiceScheduleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(serviceScheduleService.add(request));
    }

    /** Updates an existing service schedule by ID. Restricted to ADMIN and STAFF. */
    @PutMapping("/{schedId}")
    public ResponseEntity<ServiceScheduleResponse> update(
            @PathVariable Integer schedId,
            @Valid @RequestBody ServiceScheduleRequest request) {
        return ResponseEntity.ok(serviceScheduleService.update(schedId, request));
    }

    /** Returns a filtered, paginated page of service schedule records. */
    @GetMapping
    public ResponseEntity<Page<ServiceScheduleResponse>> getAll(
            Pageable pageable,
            @RequestParam(defaultValue = "false") boolean hideFinished,
            @RequestParam(defaultValue = "false") boolean withoutReport,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Integer projNum) {
        return ResponseEntity.ok(serviceScheduleService.getAll(pageable, hideFinished, withoutReport, search, projNum));
    }

    /** Returns all schedules within the given date range for calendar display, optionally scoped to a project. */
    @GetMapping("/calendar")
    public ResponseEntity<List<ServiceScheduleResponse>> getForCalendar(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(required = false) Integer projNum) {
        return ResponseEntity.ok(serviceScheduleService.getForCalendar(dateFrom, dateTo, projNum));
    }

    /** Returns a single service schedule record by ID. */
    @GetMapping("/{schedId}")
    public ResponseEntity<ServiceScheduleResponse> getById(@PathVariable Integer schedId) {
        return ResponseEntity.ok(serviceScheduleService.getById(schedId));
    }
}
