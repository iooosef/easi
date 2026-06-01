package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record EquipmentUsageResponse(

        @Schema(description = "Usage record ID", example = "1")
        Integer usageId,

        @Schema(description = "ID of the equipment deployed", example = "1")
        Integer equipmentId,

        @Schema(description = "Name of the equipment", example = "Industrial Vacuum Pump")
        String equipmentName,

        @Schema(description = "Type of the equipment: durable or consumable", example = "durable")
        String equipmentType,

        @Schema(description = "Service schedule ID", example = "3")
        Integer schedId,

        @Schema(description = "Date of the service schedule", example = "2024-07-15")
        LocalDate schedDate,

        @Schema(description = "Notes about this deployment", example = "Brought to site for leak test")
        String notes,

        @Schema(description = "Timestamp when the usage was logged")
        LocalDateTime loggedOn
) {}
