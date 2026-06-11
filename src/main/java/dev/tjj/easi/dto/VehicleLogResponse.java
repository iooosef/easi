package dev.tjj.easi.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record VehicleLogResponse(
        Integer vehicleLogId,
        Integer vehiclesId,
        String vehicleModel,
        String vehiclePlateNum,
        String purpose,
        Integer schedId,
        String destination,
        Integer driverEmployeeId,
        String driverName,
        Integer odometerStart,
        Integer odometerEnd,
        String status,
        LocalDate date,
        LocalDateTime addedOn
) {}
