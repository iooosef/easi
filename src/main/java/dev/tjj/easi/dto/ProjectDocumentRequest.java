package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

public record ProjectDocumentRequest(

        @NotNull(message = "Project number is required")
        @Schema(description = "Project number to link the document to", example = "1")
        Integer projNum,

        @NotNull(message = "Document ID is required")
        @Schema(description = "Document ID to link to the project", example = "5")
        Integer docuId
) {}
