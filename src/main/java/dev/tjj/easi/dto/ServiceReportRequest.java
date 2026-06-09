package dev.tjj.easi.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ServiceReportRequest(

        @NotBlank(message = "Complaint is required")
        @Size(max = 900, message = "Complaint must not exceed 900 characters")
        String complaint,

        @Size(max = 900, message = "Work done must not exceed 900 characters")
        String workDone,

        Integer engineerEmployeeId,

        @NotBlank(message = "Location is required")
        @Size(max = 255, message = "Location must not exceed 255 characters")
        String location,

        @NotNull(message = "Schedule ID is required")
        Integer schedId,

        Integer docuId
) {}
