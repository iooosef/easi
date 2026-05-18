package dev.tjj.easi.service;

import dev.tjj.easi.dto.ProjectRequest;
import dev.tjj.easi.dto.ProjectResponse;
import dev.tjj.easi.entity.Project;
import dev.tjj.easi.entity.ProjectStatus;
import dev.tjj.easi.entity.ProjectType;
import dev.tjj.easi.repository.ProjectRepository;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** Handles project business logic: registration, updates, and retrieval. */
@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final LogService logService;

    public ProjectService(ProjectRepository projectRepository, LogService logService) {
        this.projectRepository = projectRepository;
        this.logService = logService;
    }

    /** Creates and persists a new project record. */
    @Transactional
    public ProjectResponse register(ProjectRequest request) {
        Project project = new Project();
        applyRequest(project, request);
        project.setAddedOn(LocalDateTime.now());
        Project saved = projectRepository.save(project);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "Project", String.valueOf(saved.getProjNum()), "Registered project #" + saved.getProjNum(), null);
        return toResponse(saved);
    }

    /** Updates an existing project's information by project number. */
    @Transactional
    public ProjectResponse update(Integer projNum, ProjectRequest request) {
        Project project = projectRepository.findById(projNum)
                .orElseThrow(() -> new IllegalArgumentException("Project not found."));
        applyRequest(project, request);
        Project saved = projectRepository.save(project);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "Project", String.valueOf(projNum), "Updated project #" + projNum, null);
        return toResponse(saved);
    }

    /** Returns a page of project records. */
    public Page<ProjectResponse> getAll(Pageable pageable) {
        return projectRepository.findAll(pageable).map(this::toResponse);
    }

    /** Returns a single project record by project number. */
    public ProjectResponse getByProjNum(Integer projNum) {
        return projectRepository.findById(projNum)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Project not found."));
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /** Applies and validates request fields onto the project entity. */
    private void applyRequest(Project project, ProjectRequest request) {
        ProjectType type;
        try {
            type = ProjectType.valueOf(request.type().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid project type: " + request.type());
        }

        project.setName(request.name());
        project.setAddress(request.address());
        project.setType(type.name());
        project.setContactName(request.contactName());
        project.setContactNumber(request.contactNumber());
        project.setContactEmail(request.contactEmail());
        project.setInstallationProgress(request.installationProgress());
        project.setWarrantyStatus(request.warrantyStatus());
        project.setWarrantyDate(request.warrantyDate());

        if (request.status() != null) {
            ProjectStatus status;
            try {
                status = ProjectStatus.valueOf(request.status().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Invalid project status: " + request.status());
            }
            project.setStatus(status.name().toLowerCase());
        }
    }

    private ProjectResponse toResponse(Project p) {
        return new ProjectResponse(
                p.getProjNum(),
                p.getName(),
                p.getAddress(),
                p.getType(),
                p.getContactName(),
                p.getContactNumber(),
                p.getContactEmail(),
                p.getInstallationProgress(),
                p.getWarrantyStatus(),
                p.getWarrantyDate(),
                p.getStatus(),
                p.getAddedOn()
        );
    }
}
