package dev.tjj.easi.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record ServiceScheduleRequest(

        @NotNull(message = "Project number is required")
        Integer projNum,

        @NotBlank(message = "Purpose is required")
        @Size(max = 30, message = "Purpose must not exceed 30 characters")
        String purpose,

        @NotNull(message = "Date is required")
        LocalDate date,

        @Size(max = 16, message = "Status must not exceed 16 characters")
        String status
) {}
