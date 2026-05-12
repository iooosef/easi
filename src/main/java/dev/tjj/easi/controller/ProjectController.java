package dev.tjj.easi.controller;

import dev.tjj.easi.dto.ProjectRequest;
import dev.tjj.easi.dto.ProjectResponse;
import dev.tjj.easi.service.ProjectService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoints for project management.
 * ADMIN and STAFF can register and update projects.
 * All authenticated users can view projects.
 */
@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    /** Registers a new project. Restricted to ADMIN and STAFF. */
    @PostMapping
    public ResponseEntity<ProjectResponse> register(@Valid @RequestBody ProjectRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(projectService.register(request));
    }

    /** Updates an existing project by project number. Restricted to ADMIN and STAFF. */
    @PutMapping("/{projNum}")
    public ResponseEntity<ProjectResponse> update(
            @PathVariable Integer projNum,
            @Valid @RequestBody ProjectRequest request) {
        return ResponseEntity.ok(projectService.update(projNum, request));
    }

    /** Returns all project records. Available to all authenticated users. */
    @GetMapping
    public ResponseEntity<List<ProjectResponse>> getAll() {
        return ResponseEntity.ok(projectService.getAll());
    }

    /** Returns a single project record by project number. Available to all authenticated users. */
    @GetMapping("/{projNum}")
    public ResponseEntity<ProjectResponse> getByProjNum(@PathVariable Integer projNum) {
        return ResponseEntity.ok(projectService.getByProjNum(projNum));
    }
}
