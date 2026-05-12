package dev.tjj.easi.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record VehicleRequest(

        @NotBlank(message = "Vehicle model is required")
        @Size(max = 30, message = "Vehicle model must not exceed 30 characters")
        String vehicleModel,

        @NotBlank(message = "Vehicle plate number is required")
        @Size(max = 12, message = "Vehicle plate number must not exceed 12 characters")
        String vehiclePlateNum
) {}
