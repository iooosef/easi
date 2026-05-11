package dev.tjj.easi.service;

import dev.tjj.easi.entity.TokenPurpose;
import dev.tjj.easi.entity.User;
import dev.tjj.easi.entity.VerificationToken;
import dev.tjj.easi.repository.UserRepository;
import dev.tjj.easi.repository.VerificationTokenRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.security.core.userdetails.UserDetails;

import java.security.SecureRandom;
import java.time.LocalDateTime;

/** Handles user account operations such as password reset via OTP. */
@Service
public class UserService {

    private final UserRepository userRepository;
    private final VerificationTokenRepository tokenRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;

    private static final int OTP_EXPIRY_MINUTES = 10;
    private static final SecureRandom RANDOM = new SecureRandom();

    public UserService(UserRepository userRepository,
                       VerificationTokenRepository tokenRepository,
                       EmailService emailService,
                       PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.emailService = emailService;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Generates a 6-digit OTP for password reset and emails it to the user.
     * Silently succeeds when the email is not registered to prevent user enumeration.
     */
    @Transactional
    public void sendPasswordResetOtp(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            tokenRepository.deleteByUserAndPurpose(user, TokenPurpose.PASSWORD_RESET);

            String otp = generateOtp();

            VerificationToken token = new VerificationToken();
            token.setToken(otp);
            token.setUser(user);
            token.setPurpose(TokenPurpose.PASSWORD_RESET);
            token.setExpiresAt(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES));
            tokenRepository.save(token);

            emailService.sendOtp(email, otp, "password reset");
        });
    }

    /** Verifies the OTP and updates the password if the token is valid and unused. */
    @Transactional
    public void resetPassword(String email, String otp, String newPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired OTP."));

        VerificationToken token = tokenRepository
                .findByTokenAndPurpose(otp, TokenPurpose.PASSWORD_RESET)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired OTP."));

        // Ensure the OTP belongs to the requesting user
        if (!token.getUser().getUserId().equals(user.getUserId())) {
            throw new IllegalArgumentException("Invalid or expired OTP.");
        }

        if (token.isUsed() || token.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Invalid or expired OTP.");
        }

        token.setUsed(true);
        tokenRepository.save(token);

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    /**
     * Resets a target user's password directly without OTP.
     * ADMIN can reset any user; HR cannot reset accounts with the ADMIN role.
     */
    @Transactional
    public void adminResetPassword(Integer targetUserId, String newPassword, UserDetails currentUser) {
        String callerRole = currentUser.getAuthorities().stream()
                .findFirst()
                .map(a -> a.getAuthority().replace("ROLE_", ""))
                .orElseThrow(() -> new IllegalArgumentException("Access denied."));

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found."));

        if ("HR".equals(callerRole) && "ADMIN".equals(target.getRole())) {
            throw new IllegalArgumentException("HR cannot reset an admin's password.");
        }

        target.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(target);
    }

    private String generateOtp() {
        return String.format("%06d", RANDOM.nextInt(1_000_000));
    }
}
