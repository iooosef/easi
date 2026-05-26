package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

public record ProjectDocumentResponse(

        @Schema(description = "Project document link ID", example = "1")
        Integer projDocId,

        @Schema(description = "Project number", example = "1")
        Integer projNum,

        @Schema(description = "Linked document ID", example = "5")
        Integer docuId,

        @Schema(description = "Document file name", example = "report.pdf")
        String fileName,

        @Schema(description = "Document file type extension", example = "pdf")
        String fileType,

        @Schema(description = "Document description", example = "Project completion report")
        String description,

        @Schema(description = "Date and time the document was uploaded")
        LocalDateTime addedOn
) {}
