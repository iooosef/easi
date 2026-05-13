package dev.tjj.easi.service;

import dev.tjj.easi.dto.ServiceScheduleRequest;
import dev.tjj.easi.dto.ServiceScheduleResponse;
import dev.tjj.easi.entity.Project;
import dev.tjj.easi.entity.ServiceSchedule;
import dev.tjj.easi.repository.ProjectRepository;
import dev.tjj.easi.repository.ServiceScheduleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** Handles service schedule business logic: creation, updates, and retrieval. */
@Service
public class ServiceScheduleService {

    private final ServiceScheduleRepository serviceScheduleRepository;
    private final ProjectRepository projectRepository;

    public ServiceScheduleService(ServiceScheduleRepository serviceScheduleRepository,
                                  ProjectRepository projectRepository) {
        this.serviceScheduleRepository = serviceScheduleRepository;
        this.projectRepository = projectRepository;
    }

    /** Creates and persists a new service schedule record. */
    @Transactional
    public ServiceScheduleResponse add(ServiceScheduleRequest request) {
        Project project = projectRepository.findById(request.projNum())
                .orElseThrow(() -> new IllegalArgumentException("Project not found."));
        ServiceSchedule schedule = new ServiceSchedule();
        applyRequest(schedule, request, project);
        schedule.setAddedOn(LocalDateTime.now());
        return toResponse(serviceScheduleRepository.save(schedule));
    }

    /** Updates an existing service schedule by ID. */
    @Transactional
    public ServiceScheduleResponse update(Integer schedId, ServiceScheduleRequest request) {
        ServiceSchedule schedule = serviceScheduleRepository.findById(schedId)
                .orElseThrow(() -> new IllegalArgumentException("Service schedule not found."));
        Project project = projectRepository.findById(request.projNum())
                .orElseThrow(() -> new IllegalArgumentException("Project not found."));
        applyRequest(schedule, request, project);
        return toResponse(serviceScheduleRepository.save(schedule));
    }

    /** Returns all service schedule records. */
    public List<ServiceScheduleResponse> getAll() {
        return serviceScheduleRepository.findAll().stream().map(this::toResponse).toList();
    }

    /** Returns a single service schedule record by ID. */
    public ServiceScheduleResponse getById(Integer schedId) {
        return serviceScheduleRepository.findById(schedId)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Service schedule not found."));
    }

    /** Applies request fields onto the service schedule entity. */
    private void applyRequest(ServiceSchedule schedule, ServiceScheduleRequest request, Project project) {
        schedule.setProject(project);
        schedule.setPurpose(request.purpose());
        schedule.setDate(request.date());
        if (request.status() != null && !request.status().isBlank()) {
            schedule.setStatus(request.status());
        }
    }

    private ServiceScheduleResponse toResponse(ServiceSchedule s) {
        return new ServiceScheduleResponse(
                s.getSchedId(),
                s.getProject().getProjNum(),
                s.getPurpose(),
                s.getDate(),
                s.getStatus(),
                s.getAddedOn()
        );
    }
}
