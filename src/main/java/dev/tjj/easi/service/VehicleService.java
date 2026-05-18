package dev.tjj.easi.service;

import dev.tjj.easi.dto.VehicleRequest;
import dev.tjj.easi.dto.VehicleResponse;
import dev.tjj.easi.entity.Vehicle;
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

/** Handles vehicle business logic: registration, updates, and retrieval. */
@Service
public class VehicleService {

    private final VehicleRepository vehicleRepository;
    private final LogService logService;

    public VehicleService(VehicleRepository vehicleRepository, LogService logService) {
        this.vehicleRepository = vehicleRepository;
        this.logService = logService;
    }

    /** Creates and persists a new vehicle record. */
    @Transactional
    public VehicleResponse register(VehicleRequest request) {
        Vehicle vehicle = new Vehicle();
        applyRequest(vehicle, request);
        vehicle.setAddedOn(LocalDateTime.now());
        Vehicle saved = vehicleRepository.save(vehicle);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "Vehicle", String.valueOf(saved.getVehiclesId()), "Registered vehicle #" + saved.getVehiclesId(), null);
        return toResponse(saved);
    }

    /** Updates an existing vehicle's information by vehicle ID. */
    @Transactional
    public VehicleResponse update(Integer vehiclesId, VehicleRequest request) {
        Vehicle vehicle = vehicleRepository.findById(vehiclesId)
                .orElseThrow(() -> new IllegalArgumentException("Vehicle not found."));
        applyRequest(vehicle, request);
        Vehicle saved = vehicleRepository.save(vehicle);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "Vehicle", String.valueOf(vehiclesId), "Updated vehicle #" + vehiclesId, null);
        return toResponse(saved);
    }

    /** Returns a page of vehicle records. */
    public Page<VehicleResponse> getAll(Pageable pageable) {
        return vehicleRepository.findAll(pageable).map(this::toResponse);
    }

    /** Returns a single vehicle record by vehicle ID. */
    public VehicleResponse getById(Integer vehiclesId) {
        return vehicleRepository.findById(vehiclesId)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Vehicle not found."));
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /** Applies request fields onto the vehicle entity. */
    private void applyRequest(Vehicle vehicle, VehicleRequest request) {
        vehicle.setVehicleModel(request.vehicleModel());
        vehicle.setVehiclePlateNum(request.vehiclePlateNum());
    }

    private VehicleResponse toResponse(Vehicle v) {
        return new VehicleResponse(
                v.getVehiclesId(),
                v.getVehicleModel(),
                v.getVehiclePlateNum(),
                v.getAddedOn()
        );
    }
}
