package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PartUsageUpdateRequest(

        @Schema(description = "Service report number to link this usage to; null if not from an SR", example = "5")
        Integer srNumber,

        @Schema(description = "Updated quantity consumed in this usage event", example = "3")
        @NotNull(message = "Quantity used is required")
        @Min(value = 1, message = "Quantity used must be at least 1")
        Integer qtyUsed,

        @Schema(description = "Optional context note", example = "Used for emergency repair")
        @Size(max = 255, message = "Notes must not exceed 255 characters")
        String notes
) {}
