package dev.tjj.easi.dto;

import java.time.LocalDateTime;

public record VehicleResponse(
        Integer vehiclesId,
        String vehicleModel,
        String vehiclePlateNum,
        LocalDateTime addedOn,
        Integer latestOdometer
) {}
