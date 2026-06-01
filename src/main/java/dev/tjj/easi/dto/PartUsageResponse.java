package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

public record PartUsageResponse(

        @Schema(description = "Unique usage record ID", example = "1")
        Integer usageId,

        @Schema(description = "ID of the part that was consumed", example = "3")
        Integer partId,

        @Schema(description = "Name of the part that was consumed", example = "Air Filter 24-inch")
        String partName,

        @Schema(description = "Service report number this usage is linked to; null if not from an SR", example = "5")
        Integer srNumber,

        @Schema(description = "Quantity consumed in this event", example = "2")
        Integer qtyUsed,

        @Schema(description = "Optional context note", example = "Used for internal testing")
        String notes,

        @Schema(description = "Timestamp when this usage was recorded", example = "2026-03-05T09:00:00")
        LocalDateTime usedOn
) {}
