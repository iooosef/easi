package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

public record ScheduleVehicleRequest(

        @NotNull(message = "Vehicle ID is required")
        @Schema(description = "ID of the vehicle to assign", example = "1")
        Integer vehicleId,

        @NotNull(message = "Schedule ID is required")
        @Schema(description = "ID of the service schedule", example = "1")
        Integer schedId
) {}
