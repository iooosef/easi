package dev.tjj.easi.dto;

import jakarta.validation.constraints.NotBlank;

/** Refresh token payload used to request a new token pair. */
public record RefreshTokenRequest(
        @NotBlank(message = "Refresh token is required")
        String refreshToken
) {}
