package dev.tjj.easi.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record ServiceScheduleResponse(
        Integer schedId,
        Integer projNum,
        String projName,
        String purpose,
        LocalDate date,
        String status,
        LocalDateTime addedOn
) {}
