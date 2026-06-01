package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PartUsageRequest(

        @Schema(description = "ID of the part being consumed", example = "3")
        @NotNull(message = "Part ID is required")
        Integer partId,

        @Schema(description = "Service report number this usage is linked to; omit or null if consumed outside an SR", example = "5")
        Integer srNumber,

        @Schema(description = "Quantity consumed in this usage event", example = "2")
        @NotNull(message = "Quantity used is required")
        @Min(value = 1, message = "Quantity used must be at least 1")
        Integer qtyUsed,

        @Schema(description = "Optional context note, especially useful when usage is not linked to an SR", example = "Used for internal testing")
        @Size(max = 255, message = "Notes must not exceed 255 characters")
        String notes
) {}
