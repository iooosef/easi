package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

public record LogDto(
        @Schema(description = "Unique log entry ID", example = "42")
        Long logId,

        @Schema(description = "Email of the user who triggered the action", example = "admin@example.com")
        String userEmail,

        @Schema(description = "Actor identifier when user is not a registered account", example = "unknown@example.com")
        String actorIdentifier,

        @Schema(description = "Log category", allowableValues = {"SECURITY", "AUDIT", "SYSTEM"})
        String logType,

        @Schema(description = "Log severity", allowableValues = {"INFO", "WARN", "ERROR"})
        String severity,

        @Schema(description = "Action performed", example = "CREATE")
        String action,

        @Schema(description = "Entity type affected", example = "Project")
        String entityType,

        @Schema(description = "Entity ID affected", example = "5")
        String entityId,

        @Schema(description = "Human-readable description of the action", example = "Registered project #5")
        String description,

        @Schema(description = "IP address of the actor", example = "192.168.1.1")
        String ipAddress,

        @Schema(description = "When the log entry was created")
        LocalDateTime createdAt
) {}
