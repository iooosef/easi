package dev.tjj.easi.controller;

import dev.tjj.easi.dto.AdminResetPasswordRequest;
import dev.tjj.easi.dto.ForgotPasswordRequest;
import dev.tjj.easi.dto.RegisterUserRequest;
import dev.tjj.easi.dto.RegisterUserResponse;
import dev.tjj.easi.dto.ResetPasswordRequest;
import dev.tjj.easi.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Handles user account operations such as password reset. */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    /** Sends a password reset OTP to the given email if it belongs to an active account. */
    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        userService.sendPasswordResetOtp(request.email());
        return ResponseEntity.ok(Map.of("message", "If that email is registered, an OTP has been sent."));
    }

    /** Resets the user's password after verifying the OTP. */
    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        userService.resetPassword(request.email(), request.otp(), request.newPassword());
        return ResponseEntity.ok(Map.of("message", "Password reset successfully."));
    }

    /** Resets any user's password directly; ADMIN is unrestricted, HR cannot reset ADMIN accounts. */
    @PostMapping("/admin-reset-password")
    public ResponseEntity<Map<String, String>> adminResetPassword(
            @Valid @RequestBody AdminResetPasswordRequest request,
            @AuthenticationPrincipal UserDetails currentUser) {
        userService.adminResetPassword(request.userId(), request.newPassword(), currentUser);
        return ResponseEntity.ok(Map.of("message", "Password reset successfully."));
    }

    /** Registers a new user account; ADMIN can assign any role, HR cannot register ADMIN accounts. */
    @PostMapping("/register")
    public ResponseEntity<RegisterUserResponse> registerUser(
            @Valid @RequestBody RegisterUserRequest request,
            @AuthenticationPrincipal UserDetails currentUser) {
        RegisterUserResponse response = userService.registerUser(request, currentUser);
        return ResponseEntity.status(201).body(response);
    }
}
