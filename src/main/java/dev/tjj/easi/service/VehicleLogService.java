package dev.tjj.easi.service;

import dev.tjj.easi.dto.VehicleLogRequest;
import dev.tjj.easi.dto.VehicleLogResponse;
import dev.tjj.easi.entity.Employee;
import dev.tjj.easi.entity.Project;
import dev.tjj.easi.entity.Vehicle;
import dev.tjj.easi.entity.VehicleLog;
import dev.tjj.easi.repository.EmployeeRepository;
import dev.tjj.easi.repository.ProjectRepository;
import dev.tjj.easi.repository.VehicleLogRepository;
import dev.tjj.easi.repository.VehicleRepository;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** Handles vehicle log business logic: creation, updates, and retrieval. */
@Service
public class VehicleLogService {

    private final VehicleLogRepository vehicleLogRepository;
    private final VehicleRepository vehicleRepository;
    private final ProjectRepository projectRepository;
    private final EmployeeRepository employeeRepository;

    public VehicleLogService(VehicleLogRepository vehicleLogRepository,
                              VehicleRepository vehicleRepository,
                              ProjectRepository projectRepository,
                              EmployeeRepository employeeRepository) {
        this.vehicleLogRepository = vehicleLogRepository;
        this.vehicleRepository = vehicleRepository;
        this.projectRepository = projectRepository;
        this.employeeRepository = employeeRepository;
    }

    /** Creates and persists a new vehicle log record. */
    @Transactional
    public VehicleLogResponse add(VehicleLogRequest request) {
        VehicleLog log = new VehicleLog();
        applyRequest(log, request);
        log.setAddedOn(LocalDateTime.now());
        return toResponse(vehicleLogRepository.save(log));
    }

    /** Updates an existing vehicle log record by ID. */
    @Transactional
    public VehicleLogResponse update(Integer vehicleLogId, VehicleLogRequest request) {
        VehicleLog log = vehicleLogRepository.findById(vehicleLogId)
                .orElseThrow(() -> new IllegalArgumentException("Vehicle log not found."));
        applyRequest(log, request);
        return toResponse(vehicleLogRepository.save(log));
    }

    /** Returns a page of vehicle log records. */
    public Page<VehicleLogResponse> getAll(Pageable pageable) {
        return vehicleLogRepository.findAll(pageable).map(this::toResponse);
    }

    /** Returns a single vehicle log record by ID. */
    public VehicleLogResponse getById(Integer vehicleLogId) {
        return vehicleLogRepository.findById(vehicleLogId)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Vehicle log not found."));
    }

    /** Applies request fields onto the vehicle log entity. */
    private void applyRequest(VehicleLog log, VehicleLogRequest request) {
        Vehicle vehicle = vehicleRepository.findById(request.vehiclesId())
                .orElseThrow(() -> new IllegalArgumentException("Vehicle not found."));
        Project project = projectRepository.findById(request.projNum())
                .orElseThrow(() -> new IllegalArgumentException("Project not found."));
        Employee driver = employeeRepository.findById(request.driverEmployeeId())
                .orElseThrow(() -> new IllegalArgumentException("Driver employee not found."));

        log.setVehicle(vehicle);
        log.setPurpose(request.purpose());
        log.setProject(project);
        log.setDestination(request.destination());
        log.setDriverEmployee(driver);
        log.setOdometerStart(request.odometerStart());
        log.setOdometerEnd(request.odometerEnd());

        if (request.status() != null && !request.status().isBlank()) {
            log.setStatus(request.status());
        }
    }

    private VehicleLogResponse toResponse(VehicleLog l) {
        return new VehicleLogResponse(
                l.getVehicleLogId(),
                l.getVehicle().getVehiclesId(),
                l.getPurpose(),
                l.getProject().getProjNum(),
                l.getDestination(),
                l.getDriverEmployee().getEmployeeId(),
                l.getOdometerStart(),
                l.getOdometerEnd(),
                l.getStatus(),
                l.getAddedOn()
        );
    }
}
