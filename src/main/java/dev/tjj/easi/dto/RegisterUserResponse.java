package dev.tjj.easi.dto;

import java.time.LocalDateTime;

public record RegisterUserResponse(
        Integer userId,
        String email,
        String role,
        Integer employeeId,
        LocalDateTime addedOn
) {}
