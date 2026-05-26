package dev.tjj.easi.service;

import dev.tjj.easi.dto.ProjectDocumentRequest;
import dev.tjj.easi.dto.ProjectDocumentResponse;
import dev.tjj.easi.entity.Document;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import dev.tjj.easi.entity.Project;
import dev.tjj.easi.entity.ProjectDocument;
import dev.tjj.easi.repository.DocumentRepository;
import dev.tjj.easi.repository.ProjectDocumentRepository;
import dev.tjj.easi.repository.ProjectRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Handles project document link business logic: creation, deletion, and retrieval. */
@Service
public class ProjectDocumentService {

    private final ProjectDocumentRepository projectDocumentRepository;
    private final ProjectRepository projectRepository;
    private final DocumentRepository documentRepository;
    private final LogService logService;

    public ProjectDocumentService(ProjectDocumentRepository projectDocumentRepository,
                                  ProjectRepository projectRepository,
                                  DocumentRepository documentRepository,
                                  LogService logService) {
        this.projectDocumentRepository = projectDocumentRepository;
        this.projectRepository = projectRepository;
        this.documentRepository = documentRepository;
        this.logService = logService;
    }

    /** Links a document to a project and persists the relationship. */
    @Transactional
    public ProjectDocumentResponse add(ProjectDocumentRequest request) {
        Project project = projectRepository.findById(request.projNum())
                .orElseThrow(() -> new IllegalArgumentException("Project not found."));
        Document document = documentRepository.findById(request.docuId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found."));

        ProjectDocument pd = new ProjectDocument();
        pd.setProject(project);
        pd.setDocument(document);

        ProjectDocument saved = projectDocumentRepository.save(pd);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "ProjectDocument",
                String.valueOf(saved.getProjDocId()),
                "Linked document #" + request.docuId() + " to project #" + request.projNum(), null);
        return toResponse(saved);
    }

    /** Removes a project-document link by its ID. The document file itself is not deleted. */
    @Transactional
    public void delete(Integer projDocId) {
        ProjectDocument pd = projectDocumentRepository.findById(projDocId)
                .orElseThrow(() -> new IllegalArgumentException("Project document link not found."));
        projectDocumentRepository.delete(pd);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "DELETE", "ProjectDocument",
                String.valueOf(projDocId), "Removed project document link #" + projDocId, null);
    }

    /** Returns a page of document links filtered by project number. */
    public Page<ProjectDocumentResponse> getByProjNum(Integer projNum, Pageable pageable) {
        return projectDocumentRepository.findByProject_ProjNum(projNum, pageable).map(this::toResponse);
    }

    /** Returns all project document links. */
    public Page<ProjectDocumentResponse> getAll(Pageable pageable) {
        return projectDocumentRepository.findAll(pageable).map(this::toResponse);
    }

    /** Returns a single project document link by ID. */
    public ProjectDocumentResponse getById(Integer projDocId) {
        return projectDocumentRepository.findById(projDocId)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Project document link not found."));
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    private ProjectDocumentResponse toResponse(ProjectDocument pd) {
        Document d = pd.getDocument();
        return new ProjectDocumentResponse(
                pd.getProjDocId(),
                pd.getProject().getProjNum(),
                d.getDocuId(),
                d.getFileName(),
                d.getFileType(),
                d.getDescription(),
                d.getAddedOn()
        );
    }
}
