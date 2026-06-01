package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record EquipmentUsageUpdateRequest(

        @Schema(description = "Service schedule ID this equipment is deployed to", example = "3")
        @NotNull(message = "Schedule ID is required")
        Integer schedId,

        @Schema(description = "Optional notes about this deployment", example = "Brought to site for leak test")
        @Size(max = 255, message = "Notes must not exceed 255 characters")
        String notes
) {}
