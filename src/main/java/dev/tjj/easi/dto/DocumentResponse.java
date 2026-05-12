package dev.tjj.easi.dto;

import java.time.LocalDateTime;

public record DocumentResponse(
        Integer docuId,
        String fileName,
        String description,
        String fileType,
        String filePath,
        LocalDateTime addedOn
) {}
