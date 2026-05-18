package dev.tjj.easi.service;

import dev.tjj.easi.config.JwtProperties;
import dev.tjj.easi.dto.AuthResponse;
import dev.tjj.easi.dto.LoginRequest;
import dev.tjj.easi.dto.RefreshTokenRequest;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import dev.tjj.easi.entity.RefreshToken;
import dev.tjj.easi.entity.User;
import dev.tjj.easi.repository.RefreshTokenRepository;
import dev.tjj.easi.repository.UserRepository;
import dev.tjj.easi.security.JwtService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/** Handles login, token refresh, and logout business logic. */
@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRepository userRepository;
    private final LogService logService;

    public AuthService(
            AuthenticationManager authenticationManager,
            UserDetailsService userDetailsService,
            JwtService jwtService,
            JwtProperties jwtProperties,
            RefreshTokenRepository refreshTokenRepository,
            UserRepository userRepository,
            LogService logService
    ) {
        this.authenticationManager = authenticationManager;
        this.userDetailsService = userDetailsService;
        this.jwtService = jwtService;
        this.jwtProperties = jwtProperties;
        this.refreshTokenRepository = refreshTokenRepository;
        this.userRepository = userRepository;
        this.logService = logService;
    }

    /** Authenticates credentials and returns a new access and refresh token pair. */
    @Transactional
    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );

        User user = userRepository.findByEmail(request.email()).orElseThrow();
        UserDetails userDetails = userDetailsService.loadUserByUsername(request.email());

        refreshTokenRepository.revokeAllUserTokens(user);

        Map<String, Object> claims = Map.of(
                "firstName", user.getEmployee().getFirstName(),
                "lastName", user.getEmployee().getLastName(),
                "role", user.getRole()
        );
        String accessToken = jwtService.generateAccessToken(claims, userDetails);
        String refreshToken = createRefreshToken(user);

        logService.logByEmail(request.email(), LogType.SECURITY, LogSeverity.INFO, "LOGIN", "User", String.valueOf(user.getUserId()), "User logged in: " + request.email(), null);
        return new AuthResponse(accessToken, refreshToken);
    }

    /** Validates the refresh token and issues a new token pair, rotating the refresh token. */
    @Transactional
    public AuthResponse refresh(RefreshTokenRequest request) {
        RefreshToken stored = refreshTokenRepository.findByToken(request.refreshToken())
                .orElseThrow(() -> new IllegalArgumentException("Invalid refresh token"));

        if (stored.isRevoked() || stored.getExpiryDate().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Refresh token is expired or revoked");
        }

        User user = stored.getUser();
        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getEmail());

        stored.setRevoked(true);
        refreshTokenRepository.save(stored);

        Map<String, Object> claims = Map.of(
                "firstName", user.getEmployee().getFirstName(),
                "lastName", user.getEmployee().getLastName(),
                "role", user.getRole()
        );
        String accessToken = jwtService.generateAccessToken(claims, userDetails);
        String newRefreshToken = createRefreshToken(user);

        logService.log(user, LogType.SECURITY, LogSeverity.INFO, "REFRESH", "User", String.valueOf(user.getUserId()), "Token refreshed for user #" + user.getUserId(), null);
        return new AuthResponse(accessToken, newRefreshToken);
    }

    /** Revokes all active refresh tokens for the given user. */
    @Transactional
    public void logout(String email) {
        User user = userRepository.findByEmail(email).orElseThrow();
        refreshTokenRepository.revokeAllUserTokens(user);
        logService.logByEmail(email, LogType.SECURITY, LogSeverity.INFO, "LOGOUT", "User", String.valueOf(user.getUserId()), "User logged out: " + email, null);
    }

    private String createRefreshToken(User user) {
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setToken(UUID.randomUUID().toString());
        refreshToken.setUser(user);
        refreshToken.setExpiryDate(
                LocalDateTime.now().plus(Duration.ofMillis(jwtProperties.refreshTokenExpiration()))
        );
        refreshTokenRepository.save(refreshToken);
        return refreshToken.getToken();
    }
}
