package dev.tjj.easi.controller;

import dev.tjj.easi.dto.BackupFileResponse;
import dev.tjj.easi.dto.BackupResponse;
import dev.tjj.easi.service.MaintenanceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.core.io.PathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.util.List;

/**
 * REST endpoints for database backup and restore operations.
 * All endpoints are restricted to ADMIN role.
 */
@Tag(name = "Maintenance", description = "Database backup, restore, and file management — ADMIN only")
@RestController
@RequestMapping("/api/maintenance")
public class MaintenanceController {

    private final MaintenanceService maintenanceService;

    public MaintenanceController(MaintenanceService maintenanceService) {
        this.maintenanceService = maintenanceService;
    }

    /** Triggers a pg_dump backup and returns the filename and download URL. */
    @Operation(
            summary = "Create a database backup",
            description = "Runs pg_dump and saves a timestamped .dump file to the configured backup directory. Returns the filename and a download link."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Backup created successfully"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "403", description = "Forbidden — ADMIN role required"),
            @ApiResponse(responseCode = "500", description = "pg_dump execution failed")
    })
    @PostMapping("/backup")
    public ResponseEntity<BackupResponse> createBackup() {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(maintenanceService.createBackup());
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage());
        }
    }

    /** Returns all backup files in the backup directory sorted newest first. */
    @Operation(
            summary = "List existing backup files",
            description = "Returns metadata (filename, size, createdAt) for all .dump files in the configured backup directory, sorted newest first."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "List returned successfully"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "403", description = "Forbidden — ADMIN role required")
    })
    @GetMapping("/backups")
    public ResponseEntity<List<BackupFileResponse>> listBackups() {
        return ResponseEntity.ok(maintenanceService.listBackups());
    }

    /** Streams the specified backup file as a binary download. */
    @Operation(
            summary = "Download a backup file",
            description = "Streams the specified .dump file as an application/octet-stream download. Returns 404 if the file does not exist."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "File downloaded"),
            @ApiResponse(responseCode = "400", description = "Invalid filename (path traversal attempt)"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "403", description = "Forbidden — ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Backup file not found")
    })
    @GetMapping("/backups/{filename}")
    public ResponseEntity<Resource> downloadBackup(
            @Parameter(description = "Backup filename", example = "backup_20260525_143000.dump")
            @PathVariable String filename) {
        Path path = maintenanceService.getBackupPath(filename);
        Resource resource = new PathResource(path);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(resource);
    }

    /** Accepts a .sql or .dump upload and runs pg_restore, overwriting current data. */
    @Operation(
            summary = "Restore database from backup",
            description = "Accepts a .sql or .dump file and runs pg_restore. This operation drops and recreates all objects, overwriting current data. Max upload size: 500 MB."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Database restored successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid file type or size"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "403", description = "Forbidden — ADMIN role required"),
            @ApiResponse(responseCode = "500", description = "pg_restore execution failed")
    })
    @PostMapping(value = "/restore", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Void> restore(
            @Parameter(description = "Backup file (.sql or .dump, max 500 MB)")
            @RequestParam("file") MultipartFile file) {
        try {
            maintenanceService.restoreBackup(file);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage());
        }
    }

    /** Permanently deletes the specified backup file from the server. */
    @Operation(
            summary = "Delete a backup file",
            description = "Permanently removes the specified .dump file from the backup directory and logs the deletion."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Backup deleted"),
            @ApiResponse(responseCode = "400", description = "Invalid filename"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "403", description = "Forbidden — ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Backup file not found")
    })
    @DeleteMapping("/backups/{filename}")
    public ResponseEntity<Void> deleteBackup(
            @Parameter(description = "Backup filename to delete", example = "backup_20260525_143000.dump")
            @PathVariable String filename) {
        try {
            maintenanceService.deleteBackup(filename);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage());
        }
    }
}
