package dev.tjj.easi.service;

import dev.tjj.easi.dto.ProjectRequest;
import dev.tjj.easi.dto.ProjectResponse;
import dev.tjj.easi.entity.Project;
import dev.tjj.easi.entity.ProjectStatus;
import dev.tjj.easi.entity.ProjectType;
import dev.tjj.easi.repository.ProjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** Handles project business logic: registration, updates, and retrieval. */
@Service
public class ProjectService {

    private final ProjectRepository projectRepository;

    public ProjectService(ProjectRepository projectRepository) {
        this.projectRepository = projectRepository;
    }

    /** Creates and persists a new project record. */
    @Transactional
    public ProjectResponse register(ProjectRequest request) {
        Project project = new Project();
        applyRequest(project, request);
        project.setAddedOn(LocalDateTime.now());
        return toResponse(projectRepository.save(project));
    }

    /** Updates an existing project's information by project number. */
    @Transactional
    public ProjectResponse update(Integer projNum, ProjectRequest request) {
        Project project = projectRepository.findById(projNum)
                .orElseThrow(() -> new IllegalArgumentException("Project not found."));
        applyRequest(project, request);
        return toResponse(projectRepository.save(project));
    }

    /** Returns all project records. */
    public List<ProjectResponse> getAll() {
        return projectRepository.findAll().stream().map(this::toResponse).toList();
    }

    /** Returns a single project record by project number. */
    public ProjectResponse getByProjNum(Integer projNum) {
        return projectRepository.findById(projNum)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Project not found."));
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
