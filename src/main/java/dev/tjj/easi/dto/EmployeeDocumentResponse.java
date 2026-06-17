package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

public record EmployeeDocumentResponse(

        @Schema(description = "Employee document link ID", example = "1")
        Integer empDocId,

        @Schema(description = "Employee number", example = "1")
        Integer employeeId,

        @Schema(description = "Linked document ID", example = "5")
        Integer docuId,

        @Schema(description = "Document file name", example = "report.pdf")
        String fileName,

        @Schema(description = "Document file type extension", example = "pdf")
        String fileType,

        @Schema(description = "Document description", example = "Employee completion report")
        String description,

        @Schema(description = "Date and time the document was uploaded")
        LocalDateTime addedOn
) {}
