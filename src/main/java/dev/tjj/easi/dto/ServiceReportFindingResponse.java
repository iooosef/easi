package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

public record ServiceReportFindingResponse(
        @Schema(description = "Finding primary key", example = "1")
        Integer srFindingsNumber,

        @Schema(description = "Service report number this finding belongs to", example = "1")
        Integer srNumber,

        @Schema(description = "Finding classification code", example = "DEFECT")
        String findingType,

        @Schema(description = "Model or name of the affected part", example = "Capacitor 35/5 MFD")
        String partModel,

        @Schema(description = "AC unit number this finding is linked to", example = "1")
        Integer acNum,

        @Schema(description = "Detailed remarks about the finding")
        String remarks,

        @Schema(description = "Timestamp when the finding was recorded")
        LocalDateTime addedOn
) {}
