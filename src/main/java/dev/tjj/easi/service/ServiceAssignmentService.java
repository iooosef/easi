package dev.tjj.easi.service;

import dev.tjj.easi.dto.ServiceAssignmentRequest;
import dev.tjj.easi.dto.ServiceAssignmentResponse;
import dev.tjj.easi.entity.Employee;
import dev.tjj.easi.entity.ServiceAssignment;
import dev.tjj.easi.entity.ServiceSchedule;
import dev.tjj.easi.repository.EmployeeRepository;
import dev.tjj.easi.repository.ServiceAssignmentRepository;
import dev.tjj.easi.repository.ServiceScheduleRepository;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** Handles service assignment business logic: creation, updates, and retrieval. */
@Service
public class ServiceAssignmentService {

    private final ServiceAssignmentRepository assignmentRepository;
    private final EmployeeRepository employeeRepository;
    private final ServiceScheduleRepository serviceScheduleRepository;
    private final LogService logService;

    public ServiceAssignmentService(ServiceAssignmentRepository assignmentRepository,
                                    EmployeeRepository employeeRepository,
                                    ServiceScheduleRepository serviceScheduleRepository,
                                    LogService logService) {
        this.assignmentRepository = assignmentRepository;
        this.employeeRepository = employeeRepository;
        this.serviceScheduleRepository = serviceScheduleRepository;
        this.logService = logService;
    }

    /** Creates and persists a new service assignment record. */
    @Transactional
    public ServiceAssignmentResponse add(ServiceAssignmentRequest request) {
        Employee employee = employeeRepository.findById(request.employeeId())
                .orElseThrow(() -> new IllegalArgumentException("Employee not found."));
        ServiceSchedule schedule = serviceScheduleRepository.findById(request.schedId())
                .orElseThrow(() -> new IllegalArgumentException("Service schedule not found."));
        if (assignmentRepository.existsByEmployeeEmployeeIdAndServiceScheduleDate(request.employeeId(), schedule.getDate())) {
            throw new IllegalArgumentException(
                    "Employee " + employee.getFirstName() + " " + employee.getLastName()
                    + " is already assigned to another schedule on " + schedule.getDate() + ".");
        }
        ServiceAssignment assignment = new ServiceAssignment();
        assignment.setEmployee(employee);
        assignment.setServiceSchedule(schedule);
        assignment.setAddedOn(LocalDateTime.now());
        ServiceAssignment saved = assignmentRepository.save(assignment);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "ServiceAssignment", String.valueOf(saved.getServAssgnId()), "Created service assignment #" + saved.getServAssgnId(), null);
        return toResponse(saved);
    }

    /** Updates an existing service assignment record by ID. */
    @Transactional
    public ServiceAssignmentResponse update(Integer servAssgnId, ServiceAssignmentRequest request) {
        ServiceAssignment assignment = assignmentRepository.findById(servAssgnId)
                .orElseThrow(() -> new IllegalArgumentException("Service assignment not found."));
        applyRequest(assignment, request);
        ServiceAssignment saved = assignmentRepository.save(assignment);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "ServiceAssignment", String.valueOf(servAssgnId), "Updated service assignment #" + servAssgnId, null);
        return toResponse(saved);
    }

    /** Returns a page of service assignment records. */
    public Page<ServiceAssignmentResponse> getAll(Pageable pageable) {
        return assignmentRepository.findAll(pageable).map(this::toResponse);
    }

    /** Returns a single service assignment record by ID. */
    public ServiceAssignmentResponse getById(Integer servAssgnId) {
        return assignmentRepository.findById(servAssgnId)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Service assignment not found."));
    }

    /** Returns all assignments for a given schedule. */
    public List<ServiceAssignmentResponse> getBySchedule(Integer schedId) {
        return assignmentRepository.findByServiceScheduleSchedId(schedId).stream()
                .map(this::toResponse)
                .toList();
    }

    /** Deletes a service assignment record by ID. */
    @Transactional
    public void delete(Integer servAssgnId) {
        ServiceAssignment assignment = assignmentRepository.findById(servAssgnId)
                .orElseThrow(() -> new IllegalArgumentException("Service assignment not found."));
        assignmentRepository.delete(assignment);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "DELETE", "ServiceAssignment",
                String.valueOf(servAssgnId), "Deleted service assignment #" + servAssgnId, null);
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /** Applies request fields onto the service assignment entity. */
    private void applyRequest(ServiceAssignment assignment, ServiceAssignmentRequest request) {
        Employee employee = employeeRepository.findById(request.employeeId())
                .orElseThrow(() -> new IllegalArgumentException("Employee not found."));
        ServiceSchedule schedule = serviceScheduleRepository.findById(request.schedId())
                .orElseThrow(() -> new IllegalArgumentException("Service schedule not found."));
        assignment.setEmployee(employee);
        assignment.setServiceSchedule(schedule);
    }

    private ServiceAssignmentResponse toResponse(ServiceAssignment a) {
        return new ServiceAssignmentResponse(
                a.getServAssgnId(),
                a.getEmployee().getEmployeeId(),
                a.getEmployee().getFirstName(),
                a.getEmployee().getLastName(),
                a.getEmployee().getPosition(),
                a.getServiceSchedule().getSchedId(),
                a.getAddedOn()
        );
    }
}
