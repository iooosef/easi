package dev.tjj.easi.service;

import dev.tjj.easi.dto.VehicleGasLogRequest;
import dev.tjj.easi.dto.VehicleGasLogResponse;
import dev.tjj.easi.entity.VehicleGasLog;
import dev.tjj.easi.entity.VehicleLog;
import dev.tjj.easi.repository.VehicleGasLogRepository;
import dev.tjj.easi.repository.VehicleLogRepository;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

/** Handles vehicle gas log business logic: creation, updates, and retrieval. */
@Service
public class VehicleGasLogService {

    private final VehicleGasLogRepository gasLogRepository;
    private final VehicleLogRepository vehicleLogRepository;
    private final LogService logService;

    public VehicleGasLogService(VehicleGasLogRepository gasLogRepository,
                                 VehicleLogRepository vehicleLogRepository,
                                 LogService logService) {
        this.gasLogRepository = gasLogRepository;
        this.vehicleLogRepository = vehicleLogRepository;
        this.logService = logService;
    }

    /** Creates and persists a new vehicle gas log record. */
    @Transactional
    public VehicleGasLogResponse add(VehicleGasLogRequest request) {
        VehicleGasLog gasLog = new VehicleGasLog();
        applyRequest(gasLog, request);
        VehicleGasLog saved = gasLogRepository.save(gasLog);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "VehicleGasLog", String.valueOf(saved.getGasLogId()), "Created vehicle gas log #" + saved.getGasLogId(), null);
        return toResponse(saved);
    }

    /** Updates an existing vehicle gas log record by ID. */
    @Transactional
    public VehicleGasLogResponse update(Integer gasLogId, VehicleGasLogRequest request) {
        VehicleGasLog gasLog = gasLogRepository.findById(gasLogId)
                .orElseThrow(() -> new IllegalArgumentException("Vehicle gas log not found."));
        applyRequest(gasLog, request);
        VehicleGasLog saved = gasLogRepository.save(gasLog);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "VehicleGasLog", String.valueOf(gasLogId), "Updated vehicle gas log #" + gasLogId, null);
        return toResponse(saved);
    }

    /** Returns a page of vehicle gas log records. */
    public Page<VehicleGasLogResponse> getAll(Pageable pageable) {
        return gasLogRepository.findAll(pageable).map(this::toResponse);
    }

    /** Returns a page of gas log records filtered by vehicle log ID. */
    public Page<VehicleGasLogResponse> getByVehicleLogId(Integer vehicleLogId, Pageable pageable) {
        return gasLogRepository.findByVehicleLogVehicleLogId(vehicleLogId, pageable).map(this::toResponse);
    }

    /** Returns a single vehicle gas log record by ID. */
    public VehicleGasLogResponse getById(Integer gasLogId) {
        return gasLogRepository.findById(gasLogId)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Vehicle gas log not found."));
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /** Applies request fields onto the vehicle gas log entity. */
    private void applyRequest(VehicleGasLog gasLog, VehicleGasLogRequest request) {
        VehicleLog vehicleLog = vehicleLogRepository.findById(request.vehicleLogId())
                .orElseThrow(() -> new IllegalArgumentException("Vehicle log not found."));
        gasLog.setVehicleLog(vehicleLog);
        gasLog.setAmount(request.amount());
        gasLog.setInvoiceId(request.invoiceId());
    }

    private VehicleGasLogResponse toResponse(VehicleGasLog g) {
        return new VehicleGasLogResponse(
                g.getGasLogId(),
                g.getVehicleLog().getVehicleLogId(),
                g.getAmount(),
                g.getInvoiceId()
        );
    }
}
