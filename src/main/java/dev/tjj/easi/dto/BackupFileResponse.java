package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

public record BackupFileResponse(
        @Schema(description = "Backup filename", example = "backup_20260525_143000.dump")
        String filename,

        @Schema(description = "File size in bytes", example = "1048576")
        long sizeBytes,

        @Schema(description = "When the backup file was created")
        LocalDateTime createdAt
) {}
