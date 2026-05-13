package dev.tjj.easi.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AirConditioningUnitRequest(

        @NotBlank(message = "Brand is required")
        @Size(max = 30, message = "Brand must not exceed 30 characters")
        String brand,

        @NotBlank(message = "Model is required")
        @Size(max = 30, message = "Model must not exceed 30 characters")
        String model,

        @NotBlank(message = "Serial number is required")
        @Size(max = 60, message = "Serial number must not exceed 60 characters")
        String serialNum,

        @NotNull(message = "Project number is required")
        Integer projNum,

        @Size(max = 16, message = "Status must not exceed 16 characters")
        String status
) {}
