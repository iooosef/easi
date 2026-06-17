package dev.tjj.easi.service;

import dev.tjj.easi.dto.VehicleMaintenanceLogDocumentRequest;
import dev.tjj.easi.dto.VehicleMaintenanceLogDocumentResponse;
import dev.tjj.easi.entity.Document;
import dev.tjj.easi.entity.VehicleMaintenanceLog;
import dev.tjj.easi.entity.VehicleMaintenanceLogDocument;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import dev.tjj.easi.repository.DocumentRepository;
import dev.tjj.easi.repository.VehicleMaintenanceLogDocumentRepository;
import dev.tjj.easi.repository.VehicleMaintenanceLogRepository;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

/** Handles Vehicle Maintenance Log document link business logic: creation, deletion, and retrieval. */
@Service
public class VehicleMaintenanceLogDocumentService {

    private final VehicleMaintenanceLogDocumentRepository repository;
    private final VehicleMaintenanceLogRepository maintenanceLogRepository;
    private final DocumentRepository documentRepository;
    private final LogService logService;

    public VehicleMaintenanceLogDocumentService(
            VehicleMaintenanceLogDocumentRepository repository,
            VehicleMaintenanceLogRepository maintenanceLogRepository,
            DocumentRepository documentRepository,
            LogService logService) {

        this.repository = repository;
        this.maintenanceLogRepository = maintenanceLogRepository;
        this.documentRepository = documentRepository;
        this.logService = logService;
    }

    /** Creates and persists a new vehicle maintenance log document record. */
    @Transactional
    public VehicleMaintenanceLogDocumentResponse add(
            VehicleMaintenanceLogDocumentRequest request) {

        VehicleMaintenanceLogDocument entity =
                new VehicleMaintenanceLogDocument();

        applyRequest(entity, request);

        VehicleMaintenanceLogDocument saved =
                repository.save(entity);

        logService.logByEmail(
                getEmail(),
                LogType.AUDIT,
                LogSeverity.INFO,
                "CREATE",
                "VehicleMaintenanceLogDocument",
                String.valueOf(saved.getMntLogDocId()),
                "Attached document to maintenance log #" +
                        saved.getMntLogDocId(),
                null
        );

        return toResponse(saved);
    }

/** Updates an existing vehicle maintenance log document record by ID. */
    @Transactional
    public VehicleMaintenanceLogDocumentResponse update(
            Integer mntLogDocId,
            VehicleMaintenanceLogDocumentRequest request) {

        VehicleMaintenanceLogDocument entity =
                repository.findById(mntLogDocId)
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "Maintenance log document not found."));

        applyRequest(entity, request);

        VehicleMaintenanceLogDocument saved =
                repository.save(entity);

        logService.logByEmail(
                getEmail(),
                LogType.AUDIT,
                LogSeverity.INFO,
                "UPDATE",
                "VehicleMaintenanceLogDocument",
                String.valueOf(mntLogDocId),
                "Updated maintenance log document #" +
                        mntLogDocId,
                null
        );

        return toResponse(saved);
    }

    /** Returns a page of vehicle maintenance log document records. */
    public Page<VehicleMaintenanceLogDocumentResponse> getAll(
            Pageable pageable) {

        return repository.findAll(pageable)
                .map(this::toResponse);
    }
    /** Returns a page of maintenance log document records filtered by
        maintenance log ID. */
    public Page<VehicleMaintenanceLogDocumentResponse>
    getByMaintenanceLogId(Integer mntLogId,
                          Pageable pageable) {

        return repository
                .findByVehicleMaintenanceLogMntLogId(
                        mntLogId,
                        pageable)
                .map(this::toResponse);
    }
    /** Returns a single vehicle maintenance log document record by ID. */
    public VehicleMaintenanceLogDocumentResponse getById(
            Integer mntLogDocId) {

        return repository.findById(mntLogDocId)
                .map(this::toResponse)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Maintenance log document not found."));
    }
    /** Applies request data to the entity and resolves related records. */
    private void applyRequest(
            VehicleMaintenanceLogDocument entity,
            VehicleMaintenanceLogDocumentRequest request) {

        VehicleMaintenanceLog maintenanceLog =
                maintenanceLogRepository
                        .findById(request.mntLogId())
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "Maintenance log not found."));

        Document document =
                documentRepository
                        .findById(request.docuId())
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "Document not found."));

        entity.setVehicleMaintenanceLog(maintenanceLog);
        entity.setDocument(document);
    }
    /** Converts an entity into a response DTO. */
    private VehicleMaintenanceLogDocumentResponse toResponse(
            VehicleMaintenanceLogDocument entity) {

        return new VehicleMaintenanceLogDocumentResponse(
                entity.getMntLogDocId(),
                entity.getVehicleMaintenanceLog().getMntLogId(),
                entity.getDocument().getDocuId(),
                entity.getDocument().getFileName(),
                entity.getDocument().getFileType()
        );
    }

    private String getEmail() {
        Authentication auth =
                SecurityContextHolder.getContext()
                        .getAuthentication();

        return auth != null ? auth.getName() : null;
    }
}