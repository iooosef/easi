package dev.tjj.easi.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Binds jwt.* configuration properties (secret, token expirations). */
@ConfigurationProperties(prefix = "jwt")
public record JwtProperties(
        String secret,
        long accessTokenExpiration,
        long refreshTokenExpiration
) {}
