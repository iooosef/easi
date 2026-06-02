package dev.tjj.easi.dto.report;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

@Schema(description = "A single row in the Vehicle Logs report")
public record VehicleLogRow(

        @Schema(description = "Vehicle log ID", example = "12")
        Integer vehicleLogId,

        @Schema(description = "Vehicle model name", example = "Toyota Hilux")
        String vehicleModel,

        @Schema(description = "Vehicle plate number", example = "ABC 1234")
        String plateNumber,

        @Schema(description = "Odometer reading at the start of the trip (km)", example = "12500")
        Integer odometerStart,

        @Schema(description = "Odometer reading at the end of the trip (km); null if the trip is still in progress", example = "12750")
        Integer odometerEnd,

        @Schema(description = "Distance travelled in km; null if odometerEnd is not yet recorded", example = "250")
        Integer distance,

        @Schema(description = "Date and time the log was created", example = "2025-03-10T08:30:00")
        LocalDateTime addedOn

) {}
