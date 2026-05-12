package dev.tjj.easi.dto;

import jakarta.validation.constraints.Size;

public record DocumentUpdateRequest(

        @Size(max = 600, message = "Description must not exceed 600 characters")
        String description
) {}
