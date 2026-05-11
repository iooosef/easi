package dev.tjj.easi.dto;

import jakarta.validation.constraints.*;

import java.time.LocalDate;

public record EmployeeRequest(
        @NotBlank(message = "Last name is required")
        @Size(max = 255, message = "Last name must not exceed 255 characters")
        String lastName,

        @NotBlank(message = "First name is required")
        @Size(max = 255, message = "First name must not exceed 255 characters")
        String firstName,

        @NotNull(message = "Middle name is required")
        @Size(max = 255, message = "Middle name must not exceed 255 characters")
        String middleName,

        @NotNull(message = "Suffix name is required")
        @Size(max = 255, message = "Suffix name must not exceed 255 characters")
        String suffixName,

        @NotBlank(message = "Gender is required")
        String gender,

        @NotNull(message = "Birthdate is required")
        @Past(message = "Birthdate must be in the past")
        LocalDate birthdate,

        @NotBlank(message = "Contact number is required")
        @Size(min = 7, max = 16, message = "Contact number must be between 7 and 16 characters")
        @Pattern(regexp = "^[+0-9][0-9\\-\\s+]{5,14}[0-9]$", message = "Invalid contact number format")
        String contactNumber,

        @NotBlank(message = "Position is required")
        @Size(max = 30, message = "Position must not exceed 30 characters")
        String position,

        @Size(max = 16, message = "Status must not exceed 16 characters")
        String status
) {}
