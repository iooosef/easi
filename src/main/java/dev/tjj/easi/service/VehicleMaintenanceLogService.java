package dev.tjj.easi.service;

import dev.tjj.easi.dto.VehicleMaintenanceLogRequest;
import dev.tjj.easi.dto.VehicleMaintenanceLogResponse;
import dev.tjj.easi.entity.VehicleMaintenanceLog;
import dev.tjj.easi.entity.VehicleLog;
import dev.tjj.easi.repository.VehicleMaintenanceLogRepository;
import dev.tjj.easi.repository.VehicleLogRepository;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VehicleMaintenanceLogService {

    private final VehicleMaintenanceLogRepository maintenanceLogRepository;
    private final VehicleLogRepository vehicleLogRepository;
    private final LogService logService;

    public VehicleMaintenanceLogService(VehicleMaintenanceLogRepository maintenanceLogRepository,
                                       VehicleLogRepository vehicleLogRepository,
                                       LogService logService) {
        this.maintenanceLogRepository = maintenanceLogRepository;
        this.vehicleLogRepository = vehicleLogRepository;
        this.logService = logService;
    }

    /** Creates and persists a new vehicle maintenance log record. */
    @Transactional
    public VehicleMaintenanceLogResponse add(VehicleMaintenanceLogRequest request) {
        VehicleMaintenanceLog mntLog = new VehicleMaintenanceLog();
        applyRequest(mntLog, request);
        VehicleMaintenanceLog saved = maintenanceLogRepository.save(mntLog);
        
        // Linking action to LogService for auditing logs
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, 
            "CREATE", "VehicleMaintenanceLog", String.valueOf(saved.getMntLogId()), 
            "Created vehicle maintenance log #" + saved.getMntLogId(), null);
            
        return toResponse(saved);
    }

    /** Updates an existing vehicle maintenance log record by ID. */
    @Transactional
    public VehicleMaintenanceLogResponse update(Integer mntLogId, VehicleMaintenanceLogRequest request) {
        VehicleMaintenanceLog mntLog = maintenanceLogRepository.findById(mntLogId)
            .orElseThrow(() -> new IllegalArgumentException("Vehicle maintenance log not found."));
        applyRequest(mntLog, request);
        VehicleMaintenanceLog saved = maintenanceLogRepository.save(mntLog);
        
        // Linking update to LogService for auditing logs
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, 
            "UPDATE", "VehicleMaintenanceLog", String.valueOf(mntLogId), 
            "Updated vehicle maintenance log #" + mntLogId, null);
            
        return toResponse(saved);
    }

    /** Returns a page of vehicle maintenance log records. */
    public Page<VehicleMaintenanceLogResponse> getAll(Pageable pageable) {
        return maintenanceLogRepository.findAll(pageable).map(this::toResponse);
    }

    /** Returns a page of gas log records filtered by vehicle log ID. */
    public Page<VehicleMaintenanceLogResponse> getByVehicleLogId(Integer vehicleLogId, Pageable pageable) {
        return maintenanceLogRepository.findByVehicleLogVehicleLogId(vehicleLogId, pageable).map(this::toResponse);
    }

    /** Returns a single vehicle maintenance log record by ID. */
    public VehicleMaintenanceLogResponse getById(Integer mntLogId) {
        return maintenanceLogRepository.findById(mntLogId)
            .map(this::toResponse)
            .orElseThrow(() -> new IllegalArgumentException("Vehicle maintenance log not found."));
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    private void applyRequest(VehicleMaintenanceLog mntLog, VehicleMaintenanceLogRequest request) {
        VehicleLog vehicleLog = vehicleLogRepository.findById(request.vehicleLogId())
            .orElseThrow(() -> new IllegalArgumentException("Vehicle log not found."));
            
        mntLog.setVehicleLog(vehicleLog);
        mntLog.setAmount(request.amount());
        mntLog.setInvoiceId(request.invoiceId());
        mntLog.setMntType(request.mntType());

    }

    private VehicleMaintenanceLogResponse toResponse(VehicleMaintenanceLog mntLog) {
        return new VehicleMaintenanceLogResponse(
            mntLog.getMntLogId(),
            mntLog.getVehicleLog().getVehicleLogId(),
            mntLog.getAmount(),
            mntLog.getInvoiceId(),
            mntLog.getMntType()
        );
    }
}