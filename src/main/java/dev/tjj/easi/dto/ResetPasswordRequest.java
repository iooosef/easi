package dev.tjj.easi.dto;

public record ResetPasswordRequest(String email, String otp, String newPassword) {}
