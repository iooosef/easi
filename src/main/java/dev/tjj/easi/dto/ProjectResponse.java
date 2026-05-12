package dev.tjj.easi.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record ProjectResponse(
        Integer projNum,
        String name,
        String address,
        String type,
        String contactName,
        String contactNumber,
        String contactEmail,
        Integer installationProgress,
        Integer warrantyStatus,
        LocalDate warrantyDate,
        String status,
        LocalDateTime addedOn
) {}
