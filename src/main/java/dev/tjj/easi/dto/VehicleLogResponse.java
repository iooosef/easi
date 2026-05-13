package dev.tjj.easi.dto;

import java.time.LocalDateTime;

public record VehicleLogResponse(
        Integer vehicleLogId,
        Integer vehiclesId,
        String purpose,
        Integer projNum,
        String destination,
        Integer driverEmployeeId,
        Integer odometerStart,
        Integer odometerEnd,
        String status,
        LocalDateTime addedOn
) {}
