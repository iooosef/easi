package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

public record EmployeeDocumentRequest(

        @NotNull(message = "Employee Id is required")
        @Schema(description = "Employee Id to link the document to", example = "1")
        Integer employeeId,

        @NotNull(message = "Document ID is required")
        @Schema(description = "Document ID to link to the project", example = "5")
        Integer docuId
) {}
