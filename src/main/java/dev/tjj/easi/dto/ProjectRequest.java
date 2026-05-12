package dev.tjj.easi.dto;

import jakarta.validation.constraints.*;

import java.time.LocalDate;

public record ProjectRequest(

        @NotBlank(message = "Project name is required")
        @Size(max = 255, message = "Project name must not exceed 255 characters")
        String name,

        @NotBlank(message = "Address is required")
        @Size(max = 600, message = "Address must not exceed 600 characters")
        String address,

        @NotBlank(message = "Type is required")
        String type,

        @NotBlank(message = "Contact name is required")
        @Size(max = 300, message = "Contact name must not exceed 300 characters")
        String contactName,

        @NotBlank(message = "Contact number is required")
        @Size(min = 7, max = 16, message = "Contact number must be between 7 and 16 characters")
        @Pattern(regexp = "^[+0-9][0-9\\-\\s+]{5,14}[0-9]$", message = "Invalid contact number format")
        String contactNumber,

        @NotBlank(message = "Contact email is required")
        @Email(message = "Invalid contact email format")
        @Size(max = 255, message = "Contact email must not exceed 255 characters")
        String contactEmail,

        @NotNull(message = "Installation progress is required")
        @Min(value = 0, message = "Installation progress must be at least 0")
        @Max(value = 100, message = "Installation progress must not exceed 100")
        Integer installationProgress,

        @NotNull(message = "Warranty status is required")
        Integer warrantyStatus,

        @NotNull(message = "Warranty date is required")
        LocalDate warrantyDate,

        String status
) {}
