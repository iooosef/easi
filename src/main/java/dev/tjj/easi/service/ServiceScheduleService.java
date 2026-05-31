package dev.tjj.easi.service;

import dev.tjj.easi.dto.ServiceScheduleRequest;
import dev.tjj.easi.dto.ServiceScheduleResponse;
import dev.tjj.easi.entity.Project;
import dev.tjj.easi.entity.ServiceSchedule;
import dev.tjj.easi.repository.ProjectRepository;
import dev.tjj.easi.repository.ServiceScheduleRepository;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Handles service schedule business logic: creation, updates, and retrieval. */
@Service
public class ServiceScheduleService {

    private final ServiceScheduleRepository serviceScheduleRepository;
    private final ProjectRepository projectRepository;
    private final LogService logService;

    public ServiceScheduleService(ServiceScheduleRepository serviceScheduleRepository,
                                  ProjectRepository projectRepository,
                                  LogService logService) {
        this.serviceScheduleRepository = serviceScheduleRepository;
        this.projectRepository = projectRepository;
        this.logService = logService;
    }

    /** Creates and persists a new service schedule record. */
    @Transactional
    public ServiceScheduleResponse add(ServiceScheduleRequest request) {
        Project project = projectRepository.findById(request.projNum())
                .orElseThrow(() -> new IllegalArgumentException("Project not found."));
        if (serviceScheduleRepository.existsByProjectProjNumAndDate(request.projNum(), request.date())) {
            throw new IllegalArgumentException("This project already has a schedule on the selected date.");
        }
        ServiceSchedule schedule = new ServiceSchedule();
        applyRequest(schedule, request, project);
        schedule.setAddedOn(LocalDateTime.now());
        ServiceSchedule saved = serviceScheduleRepository.save(schedule);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "ServiceSchedule", String.valueOf(saved.getSchedId()), "Created service schedule #" + saved.getSchedId(), null);
        return toResponse(saved);
    }

    /** Updates an existing service schedule by ID. */
    @Transactional
    public ServiceScheduleResponse update(Integer schedId, ServiceScheduleRequest request) {
        ServiceSchedule schedule = serviceScheduleRepository.findById(schedId)
                .orElseThrow(() -> new IllegalArgumentException("Service schedule not found."));
        Project project = projectRepository.findById(request.projNum())
                .orElseThrow(() -> new IllegalArgumentException("Project not found."));
        applyRequest(schedule, request, project);
        ServiceSchedule saved = serviceScheduleRepository.save(schedule);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "ServiceSchedule", String.valueOf(schedId), "Updated service schedule #" + schedId, null);
        return toResponse(saved);
    }

    /**
     * Returns a filtered, paginated page of service schedule records.
     * Optionally excludes completed and cancelled schedules when hideFinished is true.
     * Optionally filters by purpose or project name when search is provided.
     */
    /**
     * Returns a filtered, paginated page of service schedule records.
     * Optionally excludes completed and cancelled schedules when hideFinished is true.
     * Optionally filters by purpose or project name when search is provided.
     * Optionally restricts results to a single project when projNum is provided.
     */
    /** Returns a filtered, paginated page of service schedule records. */
    public Page<ServiceScheduleResponse> getAll(Pageable pageable, boolean hideFinished, boolean withoutReport, String search, Integer projNum) {
        String q = (search != null && !search.isBlank()) ? search : "";
        if (hideFinished && withoutReport) {
            return serviceScheduleRepository.findFilteredHideFinishedWithoutReport(q, projNum, pageable).map(this::toResponse);
        }
        if (hideFinished) {
            return serviceScheduleRepository.findFilteredHideFinished(q, projNum, pageable).map(this::toResponse);
        }
        if (withoutReport) {
            return serviceScheduleRepository.findFilteredWithoutReport(q, projNum, pageable).map(this::toResponse);
        }
        return serviceScheduleRepository.findFiltered(q, projNum, pageable).map(this::toResponse);
    }

    /** Returns all schedules within the given date range for calendar display, optionally scoped to a project. */
    public List<ServiceScheduleResponse> getForCalendar(LocalDate dateFrom, LocalDate dateTo, Integer projNum) {
        return serviceScheduleRepository.findForCalendar(dateFrom, dateTo, projNum)
                .stream().map(this::toResponse).toList();
    }

    /** Returns a single service schedule record by ID. */
    public ServiceScheduleResponse getById(Integer schedId) {
        return serviceScheduleRepository.findById(schedId)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Service schedule not found."));
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
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
