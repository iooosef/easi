package dev.tjj.easi.service;

import dev.tjj.easi.dto.AirConditioningUnitRequest;
import dev.tjj.easi.dto.AirConditioningUnitResponse;
import dev.tjj.easi.entity.AirConditioningUnit;
import dev.tjj.easi.entity.Project;
import dev.tjj.easi.repository.AirConditioningUnitRepository;
import dev.tjj.easi.repository.ProjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** Handles air conditioning unit business logic: registration, updates, and retrieval. */
@Service
public class AirConditioningUnitService {

    private final AirConditioningUnitRepository acRepository;
    private final ProjectRepository projectRepository;

    public AirConditioningUnitService(AirConditioningUnitRepository acRepository,
                                      ProjectRepository projectRepository) {
        this.acRepository = acRepository;
        this.projectRepository = projectRepository;
    }

    /** Creates and persists a new air conditioning unit record. */
    @Transactional
    public AirConditioningUnitResponse add(AirConditioningUnitRequest request) {
        Project project = projectRepository.findById(request.projNum())
                .orElseThrow(() -> new IllegalArgumentException("Project not found."));
        AirConditioningUnit unit = new AirConditioningUnit();
        applyRequest(unit, request, project);
        unit.setAddedOn(LocalDateTime.now());
        return toResponse(acRepository.save(unit));
    }

    /** Updates an existing air conditioning unit record by ID. */
    @Transactional
    public AirConditioningUnitResponse update(Integer acNum, AirConditioningUnitRequest request) {
        AirConditioningUnit unit = acRepository.findById(acNum)
                .orElseThrow(() -> new IllegalArgumentException("Air conditioning unit not found."));
        Project project = projectRepository.findById(request.projNum())
                .orElseThrow(() -> new IllegalArgumentException("Project not found."));
        applyRequest(unit, request, project);
        return toResponse(acRepository.save(unit));
    }

    /** Returns a page of air conditioning unit records. */
    public Page<AirConditioningUnitResponse> getAll(Pageable pageable) {
        return acRepository.findAll(pageable).map(this::toResponse);
    }

    /** Returns a single air conditioning unit record by ID. */
    public AirConditioningUnitResponse getById(Integer acNum) {
        return acRepository.findById(acNum)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Air conditioning unit not found."));
    }

    /** Applies request fields onto the air conditioning unit entity. */
    private void applyRequest(AirConditioningUnit unit, AirConditioningUnitRequest request, Project project) {
        unit.setBrand(request.brand());
        unit.setModel(request.model());
        unit.setSerialNum(request.serialNum());
        unit.setProject(project);
        if (request.status() != null && !request.status().isBlank()) {
            unit.setStatus(request.status());
        }
    }

    private AirConditioningUnitResponse toResponse(AirConditioningUnit u) {
        return new AirConditioningUnitResponse(
                u.getAcNum(),
                u.getBrand(),
                u.getModel(),
                u.getSerialNum(),
                u.getProject().getProjNum(),
                u.getStatus(),
                u.getAddedOn()
        );
    }
}
