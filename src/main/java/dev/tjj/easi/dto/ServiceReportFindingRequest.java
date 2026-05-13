package dev.tjj.easi.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ServiceReportFindingRequest(

        @NotNull(message = "Service report number is required")
        Integer srNumber,

        @Size(max = 6, message = "Finding type must not exceed 6 characters")
        String findingType,

        @Size(max = 60, message = "Part model must not exceed 60 characters")
        String partModel,

        @NotNull(message = "AC unit number is required")
        Integer acNum,

        @Size(max = 1200, message = "Remarks must not exceed 1200 characters")
        String remarks
) {}
