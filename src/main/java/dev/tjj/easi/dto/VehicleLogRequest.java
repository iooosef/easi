package dev.tjj.easi.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record VehicleLogRequest(

        @NotNull(message = "Vehicle ID is required")
        Integer vehiclesId,

        @NotBlank(message = "Purpose is required")
        @Size(max = 30, message = "Purpose must not exceed 30 characters")
        String purpose,

        @NotNull(message = "Project number is required")
        Integer projNum,

        @NotBlank(message = "Destination is required")
        @Size(max = 255, message = "Destination must not exceed 255 characters")
        String destination,

        @NotNull(message = "Driver employee ID is required")
        Integer driverEmployeeId,

        @NotNull(message = "Odometer start is required")
        @Min(value = 0, message = "Odometer start must be zero or greater")
        Integer odometerStart,

        @Min(value = 0, message = "Odometer end must be zero or greater")
        Integer odometerEnd,

        @Size(max = 16, message = "Status must not exceed 16 characters")
        String status
) {}
