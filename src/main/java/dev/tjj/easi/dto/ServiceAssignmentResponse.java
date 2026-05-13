package dev.tjj.easi.dto;

import java.time.LocalDateTime;

public record ServiceAssignmentResponse(
        Integer servAssgnId,
        Integer employeeId,
        Integer schedId,
        LocalDateTime addedOn
) {}
