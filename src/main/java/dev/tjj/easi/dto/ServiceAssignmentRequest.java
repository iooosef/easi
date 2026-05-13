package dev.tjj.easi.dto;

import jakarta.validation.constraints.NotNull;

public record ServiceAssignmentRequest(

        @NotNull(message = "Employee ID is required")
        Integer employeeId,

        @NotNull(message = "Schedule ID is required")
        Integer schedId
) {}
