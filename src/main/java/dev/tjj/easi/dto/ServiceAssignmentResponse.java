package dev.tjj.easi.dto;

import java.time.LocalDateTime;

public record ServiceAssignmentResponse(
        Integer servAssgnId,
        Integer employeeId,
        String firstName,
        String lastName,
        String position,
        Integer schedId,
        LocalDateTime addedOn
) {}
