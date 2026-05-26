package dev.tjj.easi.controller;

import dev.tjj.easi.dto.ProjectDocumentRequest;
import dev.tjj.easi.dto.ProjectDocumentResponse;
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
 * REST endpoints for project document management.
 * ADMIN and STAFF can link and remove documents.
 * All authenticated users can view project document links.
 */
@Tag(name = "Project Documents", description = "Manage documents linked to a project")
@RestController
@RequestMapping("/api/project-documents")
public class ProjectDocumentController {

    private final ProjectDocumentService projectDocumentService;

    public ProjectDocumentController(ProjectDocumentService projectDocumentService) {
        this.projectDocumentService = projectDocumentService;
    }

    /** Links an existing document to a project. Restricted to ADMIN and STAFF. */
    @Operation(summary = "Link a document to a project",
               description = "Creates a link between an existing document and a project. Both the project and document must already exist.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Link created successfully"),
        @ApiResponse(responseCode = "400", description = "Validation failed or missing required fields"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "403", description = "Forbidden — requires ADMIN or STAFF role"),
        @ApiResponse(responseCode = "404", description = "Project or document not found")
    })
    @PostMapping
    public ResponseEntity<ProjectDocumentResponse> add(@Valid @RequestBody ProjectDocumentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(projectDocumentService.add(request));
    }

    /** Removes a project-document link by ID. Restricted to ADMIN and STAFF. */
    @Operation(summary = "Remove a project-document link",
               description = "Deletes the link between a project and a document. The document file itself is not deleted from storage.")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Link removed successfully"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "403", description = "Forbidden — requires ADMIN or STAFF role"),
        @ApiResponse(responseCode = "404", description = "Link not found")
    })
    @DeleteMapping("/{projDocId}")
    public ResponseEntity<Void> delete(
            @Parameter(description = "Project document link ID", example = "1") @PathVariable Integer projDocId) {
        projectDocumentService.delete(projDocId);
        return ResponseEntity.noContent().build();
    }

    /** Returns project document links. Filter by projNum to get documents for a specific project. */
    @Operation(summary = "List project document links",
               description = "Returns a page of project document links. Pass projNum to filter by project. Without projNum, returns all links.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "List returned successfully"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping
    public ResponseEntity<Page<ProjectDocumentResponse>> getAll(
            @Parameter(description = "Filter by project number", example = "1") @RequestParam(required = false) Integer projNum,
            Pageable pageable) {
        if (projNum != null) return ResponseEntity.ok(projectDocumentService.getByProjNum(projNum, pageable));
        return ResponseEntity.ok(projectDocumentService.getAll(pageable));
    }

    /** Returns a single project document link by ID. */
    @Operation(summary = "Get project document link by ID",
               description = "Returns a single project-document link record including document metadata.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Link found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "404", description = "Link not found")
    })
    @GetMapping("/{projDocId}")
    public ResponseEntity<ProjectDocumentResponse> getById(
            @Parameter(description = "Project document link ID", example = "1") @PathVariable Integer projDocId) {
        return ResponseEntity.ok(projectDocumentService.getById(projDocId));
    }
}
