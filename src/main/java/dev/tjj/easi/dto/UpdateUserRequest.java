package dev.tjj.easi.dto;

import jakarta.validation.constraints.*;

public record UpdateUserRequest(

        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        @Size(max = 255, message = "Email must not exceed 255 characters")
        String email,

        @NotBlank(message = "Role is required")
        String role,

        @NotNull(message = "Status is required")
        Integer status,

        /** Leave blank to keep the existing password unchanged. */
        @Size(min = 8, message = "Password must be at least 8 characters")
        String password
) {}
