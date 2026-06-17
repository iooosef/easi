package dev.tjj.easi.controller;

import dev.tjj.easi.dto.EmployeeDocumentRequest;
import dev.tjj.easi.dto.EmployeeDocumentResponse;
import dev.tjj.easi.dto.ProjectDocumentRequest;
import dev.tjj.easi.dto.ProjectDocumentResponse;
import dev.tjj.easi.entity.Employee;
import dev.tjj.easi.entity.EmployeeDocument;
import dev.tjj.easi.service.EmployeeDocumentService;
import dev.tjj.easi.service.ProjectDocumentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST endpoints for employee document management.
 * ADMIN and STAFF can link and remove documents.
 * All authenticated users can view employee document links.
 */
@Tag(name = "Employee Documents", description = "Manage documents linked to a employee")
@RestController
@RequestMapping("/api/employee-documents")
public class EmployeeDocumentController {

    private final EmployeeDocumentService employeeDocumentService;

    public EmployeeDocumentController(EmployeeDocumentService employeeDocumentService) {
        this.employeeDocumentService = employeeDocumentService;
    }

    /** Links an existing document to a employee. Restricted to ADMIN and STAFF. */
    @Operation(summary = "Link a document to a employee",
               description = "Creates a link between an existing document and a employee. Both the employee and document must already exist.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Link created successfully"),
        @ApiResponse(responseCode = "400", description = "Validation failed or missing required fields"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "403", description = "Forbidden — requires ADMIN or STAFF role"),
        @ApiResponse(responseCode = "404", description = "employee or document not found")
    })
    @PostMapping
    public ResponseEntity<EmployeeDocumentResponse> add(@Valid @RequestBody EmployeeDocumentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(employeeDocumentService.add(request));
    }

    /** Removes a employee-document link by ID. Restricted to ADMIN and STAFF. */
    @Operation(summary = "Remove a employee-document link",
               description = "Deletes the link between a employee and a document. The document file itself is not deleted from storage.")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Link removed successfully"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "403", description = "Forbidden — requires ADMIN or STAFF role"),
        @ApiResponse(responseCode = "404", description = "Link not found")
    })
    @DeleteMapping("/{emp_doc_id}")
    public ResponseEntity<Void> delete(
            @Parameter(description = "Employee document link ID", example = "1") @PathVariable Integer employee) {
        employeeDocumentService.delete(employee);
        return ResponseEntity.noContent().build();
    }

    /** Returns employee document links. Filter by employee_id to get documents for a specific employee. */
    @Operation(summary = "List employee document links",
               description = "Returns a page of emplo document links. Pass projNum to filter by project. Without projNum, returns all links.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "List returned successfully"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping
    public ResponseEntity<Page<EmployeeDocumentResponse>> getAll(
            @Parameter(description = "Filter by employee number", example = "1") @RequestParam(required = false) Integer employee,
            Pageable pageable) {
        if (employee != null) return ResponseEntity.ok(employeeDocumentService.getByemployee(employee, pageable));
        return ResponseEntity.ok(employeeDocumentService.getAll(pageable));
    }

    /** Returns a single employee document link by ID. */
    @Operation(summary = "Get employee document link by ID",
               description = "Returns a single employee-document link record including document metadata.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Link found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "404", description = "Link not found")
    })
    @GetMapping("/{emp_doc_id}")
    public ResponseEntity<EmployeeDocumentResponse> getById(
            @Parameter(description = "Employee document link ID", example = "1") @PathVariable Integer emp_doc_id) {
        return ResponseEntity.ok(employeeDocumentService.getById(emp_doc_id));
    }
}
