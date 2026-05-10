package dev.tjj.easi.dto;

/** JWT token pair returned after successful authentication or token refresh. */
public record AuthResponse(String accessToken, String refreshToken, String tokenType) {
    public AuthResponse(String accessToken, String refreshToken) {
        this(accessToken, refreshToken, "Bearer");
    }
}
