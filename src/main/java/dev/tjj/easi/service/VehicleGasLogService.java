package dev.tjj.easi.service;

import dev.tjj.easi.dto.VehicleGasLogRequest;
import dev.tjj.easi.dto.VehicleGasLogResponse;
import dev.tjj.easi.entity.Document;
import dev.tjj.easi.entity.VehicleGasLog;
import dev.tjj.easi.entity.VehicleLog;
import dev.tjj.easi.repository.DocumentRepository;
import dev.tjj.easi.repository.VehicleGasLogRepository;
import dev.tjj.easi.repository.VehicleLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

/** Handles vehicle gas log business logic: creation, updates, and retrieval. */
@Service
public class VehicleGasLogService {

    private final VehicleGasLogRepository gasLogRepository;
    private final VehicleLogRepository vehicleLogRepository;
    private final DocumentRepository documentRepository;

    public VehicleGasLogService(VehicleGasLogRepository gasLogRepository,
                                 VehicleLogRepository vehicleLogRepository,
                                 DocumentRepository documentRepository) {
        this.gasLogRepository = gasLogRepository;
        this.vehicleLogRepository = vehicleLogRepository;
        this.documentRepository = documentRepository;
    }

    /** Creates and persists a new vehicle gas log record. */
    @Transactional
    public VehicleGasLogResponse add(VehicleGasLogRequest request) {
        VehicleGasLog gasLog = new VehicleGasLog();
        applyRequest(gasLog, request);
        return toResponse(gasLogRepository.save(gasLog));
    }

    /** Updates an existing vehicle gas log record by ID. */
    @Transactional
    public VehicleGasLogResponse update(Integer gasLogId, VehicleGasLogRequest request) {
        VehicleGasLog gasLog = gasLogRepository.findById(gasLogId)
                .orElseThrow(() -> new IllegalArgumentException("Vehicle gas log not found."));
        applyRequest(gasLog, request);
        return toResponse(gasLogRepository.save(gasLog));
    }

    /** Returns a page of vehicle gas log records. */
    public Page<VehicleGasLogResponse> getAll(Pageable pageable) {
        return gasLogRepository.findAll(pageable).map(this::toResponse);
    }

    /** Returns a single vehicle gas log record by ID. */
    public VehicleGasLogResponse getById(Integer gasLogId) {
        return gasLogRepository.findById(gasLogId)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Vehicle gas log not found."));
    }

    /** Applies request fields onto the vehicle gas log entity. */
    private void applyRequest(VehicleGasLog gasLog, VehicleGasLogRequest request) {
        VehicleLog vehicleLog = vehicleLogRepository.findById(request.vehicleLogId())
                .orElseThrow(() -> new IllegalArgumentException("Vehicle log not found."));
        gasLog.setVehicleLog(vehicleLog);
        gasLog.setAmount(request.amount());
        gasLog.setInvoiceId(request.invoiceId());

        if (request.docuId() != null) {
            Document document = documentRepository.findById(request.docuId())
                    .orElseThrow(() -> new IllegalArgumentException("Document not found."));
            gasLog.setDocument(document);
        } else {
            gasLog.setDocument(null);
        }
    }

    private VehicleGasLogResponse toResponse(VehicleGasLog g) {
        return new VehicleGasLogResponse(
                g.getGasLogId(),
                g.getVehicleLog().getVehicleLogId(),
                g.getAmount(),
                g.getInvoiceId(),
                g.getDocument() != null ? g.getDocument().getDocuId() : null
        );
    }
}
