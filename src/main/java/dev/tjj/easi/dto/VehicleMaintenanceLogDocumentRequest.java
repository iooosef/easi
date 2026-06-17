package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

public record VehicleMaintenanceLogDocumentRequest(

        @NotNull(message = "Maintenance log ID is required")
        @Schema(description = "Maintenance log ID to link the document to", example = "1")
        Integer mntLogId,

        @NotNull(message = "Document ID is required")
        @Schema(description = "Document ID to link to the maintenance log", example = "5")
        Integer docuId

) {}