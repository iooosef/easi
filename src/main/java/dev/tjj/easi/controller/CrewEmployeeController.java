package dev.tjj.easi.controller;

import dev.tjj.easi.dto.EmployeeResponse;
import dev.tjj.easi.service.EmployeeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Provides a picker endpoint for listing CREW employees.
 * Accessible to all authenticated users so any role can open the crew assignment modal.
 */
@Tag(name = "Crew Employees", description = "Picker endpoint for CREW-role employees")
@RestController
@RequestMapping("/api/crew-employees")
public class CrewEmployeeController {

    private final EmployeeService employeeService;

    public CrewEmployeeController(EmployeeService employeeService) {
        this.employeeService = employeeService;
    }

    /** Returns a paginated list of employees with the CREW role. */
    @Operation(summary = "List CREW employees", description = "Returns employees whose linked user account has the CREW role. Used to populate crew assignment pickers.")
    @ApiResponses({ @ApiResponse(responseCode = "200", description = "Page of CREW employees returned") })
    @GetMapping
    public ResponseEntity<Page<EmployeeResponse>> getAll(Pageable pageable) {
        return ResponseEntity.ok(employeeService.getByRole("CREW", pageable));
    }
}
