package dev.tjj.easi.service;

import dev.tjj.easi.dto.ServiceReportFindingRequest;
import dev.tjj.easi.dto.ServiceReportFindingResponse;
import dev.tjj.easi.entity.AirConditioningUnit;
import dev.tjj.easi.entity.ServiceReport;
import dev.tjj.easi.entity.ServiceReportFinding;
import dev.tjj.easi.repository.AirConditioningUnitRepository;
import dev.tjj.easi.repository.ServiceReportFindingRepository;
import dev.tjj.easi.repository.ServiceReportRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** Handles service report finding business logic: creation, updates, and retrieval. */
@Service
public class ServiceReportFindingService {

    private final ServiceReportFindingRepository findingRepository;
    private final ServiceReportRepository serviceReportRepository;
    private final AirConditioningUnitRepository acUnitRepository;

    public ServiceReportFindingService(ServiceReportFindingRepository findingRepository,
                                       ServiceReportRepository serviceReportRepository,
                                       AirConditioningUnitRepository acUnitRepository) {
        this.findingRepository = findingRepository;
        this.serviceReportRepository = serviceReportRepository;
        this.acUnitRepository = acUnitRepository;
    }

    /** Creates and persists a new service report finding record. */
    @Transactional
    public ServiceReportFindingResponse add(ServiceReportFindingRequest request) {
        ServiceReportFinding finding = new ServiceReportFinding();
        applyRequest(finding, request);
        finding.setAddedOn(LocalDateTime.now());
        return toResponse(findingRepository.save(finding));
    }

    /** Updates an existing service report finding record by ID. */
    @Transactional
    public ServiceReportFindingResponse update(Integer srFindingsNumber, ServiceReportFindingRequest request) {
        ServiceReportFinding finding = findingRepository.findById(srFindingsNumber)
                .orElseThrow(() -> new IllegalArgumentException("Service report finding not found."));
        applyRequest(finding, request);
        return toResponse(findingRepository.save(finding));
    }

    /** Returns all service report finding records. */
    public List<ServiceReportFindingResponse> getAll() {
        return findingRepository.findAll().stream().map(this::toResponse).toList();
    }

    /** Returns a single service report finding record by ID. */
    public ServiceReportFindingResponse getById(Integer srFindingsNumber) {
        return findingRepository.findById(srFindingsNumber)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Service report finding not found."));
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
