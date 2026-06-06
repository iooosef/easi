package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

public record ScheduleVehicleResponse(

        @Schema(description = "Schedule vehicle assignment ID", example = "1")
        Integer schedVehicleId,

        @Schema(description = "ID of the service schedule", example = "1")
        Integer schedId,

        @Schema(description = "ID of the vehicle", example = "1")
        Integer vehicleId,

        @Schema(description = "Vehicle model", example = "Toyota HiAce")
        String vehicleModel,

        @Schema(description = "Vehicle plate number", example = "AAA 1234")
        String vehiclePlateNum,

        @Schema(description = "Timestamp when the assignment was created")
        LocalDateTime addedOn
) {}
