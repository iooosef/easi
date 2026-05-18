package dev.tjj.easi.service;

import dev.tjj.easi.dto.RegisterUserRequest;
import dev.tjj.easi.dto.RegisterUserResponse;
import dev.tjj.easi.entity.Employee;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import dev.tjj.easi.entity.Role;
import dev.tjj.easi.entity.TokenPurpose;
import dev.tjj.easi.entity.User;
import dev.tjj.easi.entity.VerificationToken;
import dev.tjj.easi.repository.EmployeeRepository;
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
    private final EmployeeRepository employeeRepository;
    private final VerificationTokenRepository tokenRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final LogService logService;

    private static final int OTP_EXPIRY_MINUTES = 10;
    private static final SecureRandom RANDOM = new SecureRandom();

    public UserService(UserRepository userRepository,
                       EmployeeRepository employeeRepository,
                       VerificationTokenRepository tokenRepository,
                       EmailService emailService,
                       PasswordEncoder passwordEncoder,
                       LogService logService) {
        this.userRepository = userRepository;
        this.employeeRepository = employeeRepository;
        this.tokenRepository = tokenRepository;
        this.emailService = emailService;
        this.passwordEncoder = passwordEncoder;
        this.logService = logService;
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
            logService.log(email, LogType.SECURITY, LogSeverity.INFO, "OTP_REQUEST", "User", String.valueOf(user.getUserId()), "Password reset OTP sent to " + email, null);
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
        logService.log(email, LogType.SECURITY, LogSeverity.INFO, "UPDATE", "User", String.valueOf(user.getUserId()), "Password reset via OTP for user #" + user.getUserId(), null);
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
        logService.logByEmail(currentUser.getUsername(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "User", String.valueOf(targetUserId), "Admin reset password for user #" + targetUserId, null);
    }

    /**
     * Registers a new user account linked to an existing employee.
     * ADMIN can assign any role; HR cannot register accounts with the ADMIN role.
     */
    @Transactional
    public RegisterUserResponse registerUser(RegisterUserRequest request, UserDetails currentUser) {
        String callerRole = currentUser.getAuthorities().stream()
                .findFirst()
                .map(a -> a.getAuthority().replace("ROLE_", ""))
                .orElseThrow(() -> new IllegalArgumentException("Access denied."));

        Role role;
        try {
            role = Role.valueOf(request.role().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid role: " + request.role());
        }

        if ("HR".equals(callerRole) && role == Role.ADMIN) {
            throw new IllegalArgumentException("HR cannot register an admin account.");
        }

        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new IllegalArgumentException("Email is already in use.");
        }

        Employee employee = employeeRepository.findById(request.employeeId())
                .orElseThrow(() -> new IllegalArgumentException("Employee not found."));

        User user = new User();
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(role.name());
        user.setEmployee(employee);
        user.setAddedOn(LocalDateTime.now());

        User saved = userRepository.save(user);
        logService.logByEmail(currentUser.getUsername(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "User", String.valueOf(saved.getUserId()), "Registered user #" + saved.getUserId() + " with role " + role.name(), null);

        return new RegisterUserResponse(
                saved.getUserId(),
                saved.getEmail(),
                saved.getRole(),
                employee.getEmployeeId(),
                saved.getAddedOn()
        );
    }

    private String generateOtp() {
        return String.format("%06d", RANDOM.nextInt(1_000_000));
    }
}
