package dev.tjj.easi.service;

import dev.tjj.easi.dto.VehicleLogRequest;
import dev.tjj.easi.dto.VehicleLogResponse;
import dev.tjj.easi.entity.Employee;
import dev.tjj.easi.entity.ServiceSchedule;
import dev.tjj.easi.entity.Vehicle;
import dev.tjj.easi.entity.VehicleLog;
import dev.tjj.easi.repository.EmployeeRepository;
import dev.tjj.easi.repository.ServiceScheduleRepository;
import dev.tjj.easi.repository.VehicleLogRepository;
import dev.tjj.easi.repository.VehicleRepository;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

/** Handles vehicle log business logic: creation, updates, and retrieval. */
@Service
public class VehicleLogService {

    private final VehicleLogRepository vehicleLogRepository;
    private final VehicleRepository vehicleRepository;
    private final ServiceScheduleRepository serviceScheduleRepository;
    private final EmployeeRepository employeeRepository;
    private final LogService logService;

    public VehicleLogService(VehicleLogRepository vehicleLogRepository,
                              VehicleRepository vehicleRepository,
                              ServiceScheduleRepository serviceScheduleRepository,
                              EmployeeRepository employeeRepository,
                              LogService logService) {
        this.vehicleLogRepository = vehicleLogRepository;
        this.vehicleRepository = vehicleRepository;
        this.serviceScheduleRepository = serviceScheduleRepository;
        this.employeeRepository = employeeRepository;
        this.logService = logService;
    }

    /** Creates and persists a new vehicle log record. */
    @Transactional
    public VehicleLogResponse add(VehicleLogRequest request) {
        VehicleLog log = new VehicleLog();
        applyRequest(log, request);
        log.setAddedOn(LocalDateTime.now());
        VehicleLog saved = vehicleLogRepository.save(log);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "VehicleLog", String.valueOf(saved.getVehicleLogId()), "Created vehicle log #" + saved.getVehicleLogId(), null);
        return toResponse(saved);
    }

    /** Updates an existing vehicle log record by ID. */
    @Transactional
    public VehicleLogResponse update(Integer vehicleLogId, VehicleLogRequest request) {
        VehicleLog log = vehicleLogRepository.findById(vehicleLogId)
                .orElseThrow(() -> new IllegalArgumentException("Vehicle log not found."));
        applyRequest(log, request);
        VehicleLog saved = vehicleLogRepository.save(log);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "VehicleLog", String.valueOf(vehicleLogId), "Updated vehicle log #" + vehicleLogId, null);
        return toResponse(saved);
    }

    /** Returns a page of vehicle log records, optionally filtered by vehicle ID or schedule ID. */
    public Page<VehicleLogResponse> getAll(Integer vehiclesId, Integer schedId, Pageable pageable) {
        if (vehiclesId != null) {
            return vehicleLogRepository.findByVehicleVehiclesId(vehiclesId, pageable).map(this::toResponse);
        }
        if (schedId != null) {
            return vehicleLogRepository.findByServiceScheduleSchedId(schedId, pageable).map(this::toResponse);
        }
        return vehicleLogRepository.findAll(pageable).map(this::toResponse);
    }

    /** Returns the most recent vehicle log with no end odometer for the given vehicle, if any. */
    public Optional<VehicleLogResponse> getLatestIncomplete(Integer vehiclesId) {
        return vehicleLogRepository.findTopByVehicleVehiclesIdAndOdometerEndIsNullOrderByAddedOnDesc(vehiclesId)
                .map(this::toResponse);
    }

    /** Returns a single vehicle log record by ID. */
    public VehicleLogResponse getById(Integer vehicleLogId) {
        return vehicleLogRepository.findById(vehicleLogId)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Vehicle log not found."));
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /** Applies request fields onto the vehicle log entity. */
    private void applyRequest(VehicleLog log, VehicleLogRequest request) {
        Vehicle vehicle = vehicleRepository.findById(request.vehiclesId())
                .orElseThrow(() -> new IllegalArgumentException("Vehicle not found."));
        Employee driver = employeeRepository.findById(request.driverEmployeeId())
                .orElseThrow(() -> new IllegalArgumentException("Driver employee not found."));

        log.setVehicle(vehicle);
        log.setPurpose(request.purpose());

        if (request.schedId() != null) {
            ServiceSchedule schedule = serviceScheduleRepository.findById(request.schedId())
                    .orElseThrow(() -> new IllegalArgumentException("Service schedule not found."));
            log.setServiceSchedule(schedule);
        } else {
            log.setServiceSchedule(null);
        }

        log.setDestination(request.destination());
        log.setDriverEmployee(driver);
        log.setOdometerStart(request.odometerStart());
        log.setOdometerEnd(request.odometerEnd());
        log.setDate(request.date());

        if (request.status() != null && !request.status().isBlank()) {
            log.setStatus(request.status());
        }
    }

    private VehicleLogResponse toResponse(VehicleLog l) {
        String driverName = l.getDriverEmployee().getFirstName() + " " + l.getDriverEmployee().getLastName();
        return new VehicleLogResponse(
                l.getVehicleLogId(),
                l.getVehicle().getVehiclesId(),
                l.getVehicle().getVehicleModel(),
                l.getVehicle().getVehiclePlateNum(),
                l.getPurpose(),
                l.getServiceSchedule() != null ? l.getServiceSchedule().getSchedId() : null,
                l.getDestination(),
                l.getDriverEmployee().getEmployeeId(),
                driverName,
                l.getOdometerStart(),
                l.getOdometerEnd(),
                l.getStatus(),
                l.getDate(),
                l.getAddedOn()
        );
    }
}
