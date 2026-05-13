package dev.tjj.easi.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SupplierRequest(

        @NotBlank(message = "Supplier name is required")
        @Size(max = 120, message = "Supplier name must not exceed 120 characters")
        String name,

        @NotBlank(message = "Address is required")
        @Size(max = 600, message = "Address must not exceed 600 characters")
        String address
) {}
