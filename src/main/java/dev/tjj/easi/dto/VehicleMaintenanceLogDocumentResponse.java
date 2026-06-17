package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record VehicleMaintenanceLogDocumentResponse(

        @Schema(description = "Maintenance log document link ID", example = "1")
        Integer mntLogDocId,

        @Schema(description = "Maintenance log ID", example = "1")
        Integer mntLogId,

        @Schema(description = "Linked document ID", example = "5")
        Integer docuId,

        @Schema(description = "Document file name", example = "invoice.pdf")
        String fileName,

        @Schema(description = "Document file type extension", example = "pdf")
        String fileType

) {}