package dev.tjj.easi.service;

import dev.tjj.easi.dto.ServiceAssignmentRequest;
import dev.tjj.easi.dto.ServiceAssignmentResponse;
import dev.tjj.easi.entity.Employee;
import dev.tjj.easi.entity.ServiceAssignment;
import dev.tjj.easi.entity.ServiceSchedule;
import dev.tjj.easi.repository.EmployeeRepository;
import dev.tjj.easi.repository.ServiceAssignmentRepository;
import dev.tjj.easi.repository.ServiceScheduleRepository;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** Handles service assignment business logic: creation, updates, and retrieval. */
@Service
public class ServiceAssignmentService {

    private final ServiceAssignmentRepository assignmentRepository;
    private final EmployeeRepository employeeRepository;
    private final ServiceScheduleRepository serviceScheduleRepository;

    public ServiceAssignmentService(ServiceAssignmentRepository assignmentRepository,
                                    EmployeeRepository employeeRepository,
                                    ServiceScheduleRepository serviceScheduleRepository) {
        this.assignmentRepository = assignmentRepository;
        this.employeeRepository = employeeRepository;
        this.serviceScheduleRepository = serviceScheduleRepository;
    }

    /** Creates and persists a new service assignment record. */
    @Transactional
    public ServiceAssignmentResponse add(ServiceAssignmentRequest request) {
        ServiceAssignment assignment = new ServiceAssignment();
        applyRequest(assignment, request);
        assignment.setAddedOn(LocalDateTime.now());
        return toResponse(assignmentRepository.save(assignment));
    }

    /** Updates an existing service assignment record by ID. */
    @Transactional
    public ServiceAssignmentResponse update(Integer servAssgnId, ServiceAssignmentRequest request) {
        ServiceAssignment assignment = assignmentRepository.findById(servAssgnId)
                .orElseThrow(() -> new IllegalArgumentException("Service assignment not found."));
        applyRequest(assignment, request);
        return toResponse(assignmentRepository.save(assignment));
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
                a.getServiceSchedule().getSchedId(),
                a.getAddedOn()
        );
    }
}
