package dev.tjj.easi.service;

import dev.tjj.easi.dto.ScheduleVehicleRequest;
import dev.tjj.easi.dto.ScheduleVehicleResponse;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import dev.tjj.easi.entity.ScheduleVehicle;
import dev.tjj.easi.entity.ServiceSchedule;
import dev.tjj.easi.entity.Vehicle;
import dev.tjj.easi.repository.ScheduleVehicleRepository;
import dev.tjj.easi.repository.ServiceScheduleRepository;
import dev.tjj.easi.repository.VehicleRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** Handles vehicle assignment to service schedules. */
@Service
public class ScheduleVehicleService {

    private final ScheduleVehicleRepository scheduleVehicleRepository;
    private final VehicleRepository vehicleRepository;
    private final ServiceScheduleRepository serviceScheduleRepository;
    private final LogService logService;

    public ScheduleVehicleService(ScheduleVehicleRepository scheduleVehicleRepository,
                                  VehicleRepository vehicleRepository,
                                  ServiceScheduleRepository serviceScheduleRepository,
                                  LogService logService) {
        this.scheduleVehicleRepository = scheduleVehicleRepository;
        this.vehicleRepository = vehicleRepository;
        this.serviceScheduleRepository = serviceScheduleRepository;
        this.logService = logService;
    }

    /**
     * Assigns a vehicle to a schedule.
     * Rejects duplicate assignments of the same vehicle to the same schedule.
     */
    @Transactional
    public ScheduleVehicleResponse add(ScheduleVehicleRequest request) {
        Vehicle vehicle = vehicleRepository.findById(request.vehicleId())
                .orElseThrow(() -> new IllegalArgumentException("Vehicle not found."));
        ServiceSchedule schedule = serviceScheduleRepository.findById(request.schedId())
                .orElseThrow(() -> new IllegalArgumentException("Service schedule not found."));
        if (scheduleVehicleRepository.existsByVehicleVehiclesIdAndServiceScheduleSchedId(request.vehicleId(), request.schedId())) {
            throw new IllegalArgumentException(
                    vehicle.getVehicleModel() + " (" + vehicle.getVehiclePlateNum() + ")"
                    + " is already assigned to this schedule.");
        }
        ScheduleVehicle sv = new ScheduleVehicle();
        sv.setVehicle(vehicle);
        sv.setServiceSchedule(schedule);
        sv.setAddedOn(LocalDateTime.now());
        ScheduleVehicle saved = scheduleVehicleRepository.save(sv);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "ScheduleVehicle",
                String.valueOf(saved.getSchedVehicleId()),
                "Assigned vehicle #" + request.vehicleId() + " to schedule #" + request.schedId(), null);
        return toResponse(saved);
    }

    /** Returns all vehicle assignments for a given schedule. */
    public List<ScheduleVehicleResponse> getBySchedule(Integer schedId) {
        return scheduleVehicleRepository.findByServiceScheduleSchedId(schedId).stream()
                .map(this::toResponse)
                .toList();
    }

    /** Deletes a schedule vehicle assignment by ID. */
    @Transactional
    public void delete(Integer schedVehicleId) {
        ScheduleVehicle sv = scheduleVehicleRepository.findById(schedVehicleId)
                .orElseThrow(() -> new IllegalArgumentException("Schedule vehicle assignment not found."));
        scheduleVehicleRepository.delete(sv);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "DELETE", "ScheduleVehicle",
                String.valueOf(schedVehicleId), "Deleted schedule vehicle assignment #" + schedVehicleId, null);
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    private ScheduleVehicleResponse toResponse(ScheduleVehicle sv) {
        return new ScheduleVehicleResponse(
                sv.getSchedVehicleId(),
                sv.getServiceSchedule().getSchedId(),
                sv.getVehicle().getVehiclesId(),
                sv.getVehicle().getVehicleModel(),
                sv.getVehicle().getVehiclePlateNum(),
                sv.getAddedOn()
        );
    }
}
