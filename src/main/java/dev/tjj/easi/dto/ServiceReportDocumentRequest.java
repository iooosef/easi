package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Request body for linking or unlinking a document from a service report. */
public record ServiceReportDocumentRequest(

        @Schema(description = "Document ID to link, or null to unlink the current document", example = "5")
        Integer docuId
) {}
