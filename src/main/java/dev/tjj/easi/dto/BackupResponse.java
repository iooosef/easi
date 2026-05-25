package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record BackupResponse(
        @Schema(description = "Generated backup filename", example = "backup_20260525_143000.dump")
        String filename,

        @Schema(description = "URL to download the backup file", example = "/api/maintenance/backups/backup_20260525_143000.dump")
        String downloadUrl
) {}
