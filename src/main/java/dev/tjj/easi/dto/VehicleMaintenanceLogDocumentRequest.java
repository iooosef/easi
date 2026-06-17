package dev.tjj.easi.dto;

import jakarta.validation.constraints.NotNull;

public record VehicleMaintenanceLogDocumentRequest(

        @NotNull(message = "Maintenance log ID is required")
        Integer mntLogId,

        @NotNull(message = "Document ID is required")
        Integer docuId

) {}