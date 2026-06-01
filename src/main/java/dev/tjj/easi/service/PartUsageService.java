package dev.tjj.easi.service;

import dev.tjj.easi.dto.PartUsageRequest;
import dev.tjj.easi.dto.PartUsageResponse;
import dev.tjj.easi.dto.PartUsageUpdateRequest;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import dev.tjj.easi.entity.Part;
import dev.tjj.easi.entity.PartUsage;
import dev.tjj.easi.entity.ServiceReport;
import dev.tjj.easi.repository.PartRepository;
import dev.tjj.easi.repository.PartUsageRepository;
import dev.tjj.easi.repository.ServiceReportRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** Handles recording, retrieval, and deletion of part usage events. */
@Service
public class PartUsageService {

    private final PartUsageRepository partUsageRepository;
    private final PartRepository partRepository;
    private final ServiceReportRepository serviceReportRepository;
    private final LogService logService;

    public PartUsageService(PartUsageRepository partUsageRepository,
                            PartRepository partRepository,
                            ServiceReportRepository serviceReportRepository,
                            LogService logService) {
        this.partUsageRepository = partUsageRepository;
        this.partRepository = partRepository;
        this.serviceReportRepository = serviceReportRepository;
        this.logService = logService;
    }

    /**
     * Records a part usage event. Validates that the requested qty does not exceed
     * the available quantity (quantityOrdered minus all prior usage).
     */
    @Transactional
    public PartUsageResponse add(PartUsageRequest request) {
        Part part = partRepository.findById(request.partId())
                .orElseThrow(() -> new IllegalArgumentException("Part not found."));

        ServiceReport sr = null;
        if (request.srNumber() != null) {
            sr = serviceReportRepository.findById(request.srNumber())
                    .orElseThrow(() -> new IllegalArgumentException("Service report not found."));
        }

        int totalUsed = partUsageRepository.sumQtyUsedByPartId(part.getPartId());
        int available = part.getQuantityOrdered() - totalUsed;
        if (request.qtyUsed() > available) {
            throw new IllegalArgumentException(
                    "Quantity used (" + request.qtyUsed() + ") exceeds available stock (" + available + ").");
        }

        PartUsage usage = new PartUsage();
        usage.setPart(part);
        usage.setServiceReport(sr);
        usage.setQtyUsed(request.qtyUsed());
        usage.setNotes(request.notes());
        usage.setUsedOn(LocalDateTime.now());

        PartUsage saved = partUsageRepository.save(usage);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE",
                "PartUsage", String.valueOf(saved.getUsageId()),
                "Logged usage of " + request.qtyUsed() + "x part #" + part.getPartId()
                        + (sr != null ? " for SR #" + sr.getSrNumber() : " (no SR)"), null);

        return toResponse(saved);
    }

    /**
     * Updates an existing usage record. Validates that the new qty does not exceed
     * available stock, adding the record's current qty back before checking.
     */
    @Transactional
    public PartUsageResponse update(Integer usageId, PartUsageUpdateRequest request) {
        PartUsage usage = partUsageRepository.findById(usageId)
                .orElseThrow(() -> new IllegalArgumentException("Usage record not found."));

        Part part = usage.getPart();
        int totalUsed = partUsageRepository.sumQtyUsedByPartId(part.getPartId());
        int available = part.getQuantityOrdered() - totalUsed + usage.getQtyUsed();
        if (request.qtyUsed() > available) {
            throw new IllegalArgumentException(
                    "Quantity used (" + request.qtyUsed() + ") exceeds available stock (" + available + ").");
        }

        ServiceReport sr = null;
        if (request.srNumber() != null) {
            sr = serviceReportRepository.findById(request.srNumber())
                    .orElseThrow(() -> new IllegalArgumentException("Service report not found."));
        }

        usage.setServiceReport(sr);
        usage.setQtyUsed(request.qtyUsed());
        usage.setNotes(request.notes());

        PartUsage saved = partUsageRepository.save(usage);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE",
                "PartUsage", String.valueOf(usageId),
                "Updated usage record #" + usageId + " for part #" + part.getPartId(), null);

        return toResponse(saved);
    }

    /** Returns a paginated list of usage records for the given part. */
    public Page<PartUsageResponse> getByPart(Integer partId, Pageable pageable) {
        if (!partRepository.existsById(partId)) {
            throw new IllegalArgumentException("Part not found.");
        }
        return partUsageRepository.findByPart_PartId(partId, pageable).map(this::toResponse);
    }

    /** Returns a paginated list of usage records linked to the given service report. */
    public Page<PartUsageResponse> getBySr(Integer srNumber, Pageable pageable) {
        if (!serviceReportRepository.existsById(srNumber)) {
            throw new IllegalArgumentException("Service report not found.");
        }
        return partUsageRepository.findByServiceReport_SrNumber(srNumber, pageable).map(this::toResponse);
    }

    /** Deletes a usage record by ID. */
    @Transactional
    public void delete(Integer usageId) {
        PartUsage usage = partUsageRepository.findById(usageId)
                .orElseThrow(() -> new IllegalArgumentException("Usage record not found."));
        partUsageRepository.delete(usage);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "DELETE",
                "PartUsage", String.valueOf(usageId),
                "Deleted usage record #" + usageId, null);
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    private PartUsageResponse toResponse(PartUsage u) {
        return new PartUsageResponse(
                u.getUsageId(),
                u.getPart().getPartId(),
                u.getPart().getName(),
                u.getPart().getUnitPrice(),
                u.getServiceReport() != null ? u.getServiceReport().getSrNumber() : null,
                u.getQtyUsed(),
                u.getNotes(),
                u.getUsedOn()
        );
    }
}
