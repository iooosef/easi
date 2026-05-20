package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ServiceReportFindingRequest(

        @Schema(description = "ID of the service report this finding belongs to", example = "1")
        @NotNull(message = "Service report number is required")
        Integer srNumber,

        @Schema(description = "Finding classification code (max 6 chars)", example = "DEFECT",
                allowableValues = {"GOOD", "DEFECT", "WORN", "DIRTY", "LEAK", "FAIL"})
        @Size(max = 6, message = "Finding type must not exceed 6 characters")
        String findingType,

        @Schema(description = "Model or name of the affected part", example = "Capacitor 35/5 MFD")
        @Size(max = 60, message = "Part model must not exceed 60 characters")
        String partModel,

        @Schema(description = "ID of the air conditioning unit this finding is for", example = "1")
        @NotNull(message = "AC unit number is required")
        Integer acNum,

        @Schema(description = "Detailed remarks about the finding", example = "Capacitor found bulging; replaced and system recharged.")
        @Size(max = 1200, message = "Remarks must not exceed 1200 characters")
        String remarks
) {}
