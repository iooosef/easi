package dev.tjj.easi.controller;

import dev.tjj.easi.dto.EmployeeRequest;
import dev.tjj.easi.dto.EmployeeResponse;
import dev.tjj.easi.service.EmployeeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoints for employee record management.
 * ADMIN and HR can register, update, and view any employee.
 * All other authenticated users can only view their own record.
 */
@RestController
@RequestMapping("/api/employees")
public class EmployeeController {

    private final EmployeeService employeeService;

    public EmployeeController(EmployeeService employeeService) {
        this.employeeService = employeeService;
    }

    /** Registers a new employee record. Restricted to ADMIN and HR. */
    @PostMapping
    public ResponseEntity<EmployeeResponse> register(@Valid @RequestBody EmployeeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(employeeService.register(request));
    }

    /** Updates an existing employee's information. Restricted to ADMIN and HR. */
    @PutMapping("/{id}")
    public ResponseEntity<EmployeeResponse> update(
            @PathVariable Integer id,
            @Valid @RequestBody EmployeeRequest request) {
        return ResponseEntity.ok(employeeService.update(id, request));
    }

    /** Returns all employee records as a list. Restricted to ADMIN and HR. */
    @GetMapping
    public ResponseEntity<List<EmployeeResponse>> getAll() {
        return ResponseEntity.ok(employeeService.getAll());
    }

    /** Returns a single employee record by ID. Restricted to ADMIN and HR. */
    @GetMapping("/{id}")
    public ResponseEntity<EmployeeResponse> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(employeeService.getById(id));
    }

    /** Returns the employee record of the currently authenticated user. */
    @GetMapping("/me")
    public ResponseEntity<EmployeeResponse> getMe(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(employeeService.getByCurrentUser(userDetails.getUsername()));
    }
}
