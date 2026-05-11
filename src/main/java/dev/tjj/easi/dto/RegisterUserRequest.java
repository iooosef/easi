package dev.tjj.easi.dto;

import jakarta.validation.constraints.*;

public record RegisterUserRequest(

        @NotNull(message = "Employee ID is required")
        Integer employeeId,

        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        @Size(max = 255, message = "Email must not exceed 255 characters")
        String email,

        @NotBlank(message = "Password is required")
        @Size(min = 8, message = "Password must be at least 8 characters")
        String password,

        @NotBlank(message = "Role is required")
        String role
) {}
