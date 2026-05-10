package dev.tjj.easi.dto;

/** Refresh token payload used to request a new token pair. */
public record RefreshTokenRequest(String refreshToken) {}
