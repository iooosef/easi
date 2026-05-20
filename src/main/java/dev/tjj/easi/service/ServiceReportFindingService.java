package dev.tjj.easi.service;

import dev.tjj.easi.dto.ServiceReportFindingRequest;
import dev.tjj.easi.dto.ServiceReportFindingResponse;
import dev.tjj.easi.entity.AirConditioningUnit;
import dev.tjj.easi.entity.ServiceReport;
import dev.tjj.easi.entity.ServiceReportFinding;
import dev.tjj.easi.repository.AirConditioningUnitRepository;
import dev.tjj.easi.repository.ServiceReportFindingRepository;
import dev.tjj.easi.repository.ServiceReportRepository;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** Handles service report finding business logic: creation, updates, and retrieval. */
@Service
public class ServiceReportFindingService {

    private final ServiceReportFindingRepository findingRepository;
    private final ServiceReportRepository serviceReportRepository;
    private final AirConditioningUnitRepository acUnitRepository;
    private final LogService logService;

    public ServiceReportFindingService(ServiceReportFindingRepository findingRepository,
                                       ServiceReportRepository serviceReportRepository,
                                       AirConditioningUnitRepository acUnitRepository,
                                       LogService logService) {
        this.findingRepository = findingRepository;
        this.serviceReportRepository = serviceReportRepository;
        this.acUnitRepository = acUnitRepository;
        this.logService = logService;
    }

    /** Creates and persists a new service report finding record. */
    @Transactional
    public ServiceReportFindingResponse add(ServiceReportFindingRequest request) {
        ServiceReportFinding finding = new ServiceReportFinding();
        applyRequest(finding, request);
        finding.setAddedOn(LocalDateTime.now());
        ServiceReportFinding saved = findingRepository.save(finding);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "ServiceReportFinding", String.valueOf(saved.getSrFindingsNumber()), "Created service report finding #" + saved.getSrFindingsNumber(), null);
        return toResponse(saved);
    }

    /** Updates an existing service report finding record by ID. */
    @Transactional
    public ServiceReportFindingResponse update(Integer srFindingsNumber, ServiceReportFindingRequest request) {
        ServiceReportFinding finding = findingRepository.findById(srFindingsNumber)
                .orElseThrow(() -> new IllegalArgumentException("Service report finding not found."));
        applyRequest(finding, request);
        ServiceReportFinding saved = findingRepository.save(finding);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "ServiceReportFinding", String.valueOf(srFindingsNumber), "Updated service report finding #" + srFindingsNumber, null);
        return toResponse(saved);
    }

    /** Returns a page of service report finding records, optionally filtered by service report number. */
    public Page<ServiceReportFindingResponse> getAll(Integer srNumber, Pageable pageable) {
        if (srNumber != null) {
            return findingRepository.findByServiceReportSrNumber(srNumber, pageable).map(this::toResponse);
        }
        return findingRepository.findAll(pageable).map(this::toResponse);
    }

    /** Returns a single service report finding record by ID. */
    public ServiceReportFindingResponse getById(Integer srFindingsNumber) {
        return findingRepository.findById(srFindingsNumber)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Service report finding not found."));
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /** Applies request fields onto the service report finding entity. */
    private void applyRequest(ServiceReportFinding finding, ServiceReportFindingRequest request) {
        ServiceReport serviceReport = serviceReportRepository.findById(request.srNumber())
                .orElseThrow(() -> new IllegalArgumentException("Service report not found."));
        AirConditioningUnit acUnit = acUnitRepository.findById(request.acNum())
                .orElseThrow(() -> new IllegalArgumentException("AC unit not found."));

        finding.setServiceReport(serviceReport);
        finding.setFindingType(request.findingType());
        finding.setPartModel(request.partModel());
        finding.setAirConditioningUnit(acUnit);
        finding.setRemarks(request.remarks());
    }

    private ServiceReportFindingResponse toResponse(ServiceReportFinding f) {
        return new ServiceReportFindingResponse(
                f.getSrFindingsNumber(),
                f.getServiceReport().getSrNumber(),
                f.getFindingType(),
                f.getPartModel(),
                f.getAirConditioningUnit().getAcNum(),
                f.getRemarks(),
                f.getAddedOn()
        );
    }
}
