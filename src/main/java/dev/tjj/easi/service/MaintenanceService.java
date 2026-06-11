package dev.tjj.easi.service;

import dev.tjj.easi.config.BackupProperties;
import dev.tjj.easi.dto.BackupFileResponse;
import dev.tjj.easi.dto.BackupResponse;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/** Handles database backup and restore operations via pg_dump / pg_restore. */
@Service
public class MaintenanceService {

    private static final Logger log = LoggerFactory.getLogger(MaintenanceService.class);

    private final BackupProperties backupProperties;
    private final LogService logService;

    @Value("${spring.datasource.url}")
    private String datasourceUrl;

    @Value("${spring.datasource.username}")
    private String dbUsername;

    @Value("${spring.datasource.password}")
    private String dbPassword;

    public MaintenanceService(BackupProperties backupProperties, LogService logService) {
        this.backupProperties = backupProperties;
        this.logService = logService;
    }

    /** Runs pg_dump and saves a timestamped .dump file. Returns filename and download URL. */
    public BackupResponse createBackup() throws IOException, InterruptedException {
        Path backupDir = ensureBackupDir();
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String filename = "backup_" + timestamp + ".dump";
        Path outputPath = backupDir.resolve(filename);

        DbConn conn = parseJdbcUrl(datasourceUrl);

        ProcessBuilder pb = new ProcessBuilder(
                backupProperties.getPgDump(),
                "-h", conn.host(),
                "-p", String.valueOf(conn.port()),
                "-U", dbUsername,
                "-d", conn.database(),
                "-F", "c",
                "-f", outputPath.toAbsolutePath().toString()
        );
        pb.environment().put("PGPASSWORD", dbPassword);
        pb.redirectErrorStream(true);

        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO,
                "BACKUP", "Database", filename, "Initiated database backup", null);
        log.info("Starting pg_dump for file: {}", filename);

        Process process = pb.start();

        StringBuilder output = new StringBuilder();
        Thread reader = new Thread(() -> {
            try (BufferedReader br = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = br.readLine()) != null) {
                    log.info("[pg_dump] {}", line);
                    output.append(line).append('\n');
                }
            } catch (IOException ignored) {}
        });
        reader.setDaemon(true);
        reader.start();

        int exitCode = process.waitFor();
        reader.join();

        if (exitCode != 0) {
            logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.ERROR,
                    "BACKUP", "Database", filename, "Database backup failed (exit " + exitCode + ")", null);
            throw new RuntimeException("pg_dump failed (exit " + exitCode + "): " + output);
        }
        log.info("pg_dump completed successfully: {}", filename);

        return new BackupResponse(filename, "/api/maintenance/backups/" + filename);
    }

    /** Lists all .dump files in the backup directory, sorted newest first. */
    public List<BackupFileResponse> listBackups() {
        Path backupDir = ensureBackupDir();
        File[] files = backupDir.toFile().listFiles(f -> f.isFile() && f.getName().endsWith(".dump"));
        if (files == null) return List.of();

        return Arrays.stream(files)
                .sorted(Comparator.comparingLong(File::lastModified).reversed())
                .map(f -> new BackupFileResponse(
                        f.getName(),
                        f.length(),
                        LocalDateTime.ofInstant(java.time.Instant.ofEpochMilli(f.lastModified()), ZoneId.systemDefault())
                ))
                .collect(Collectors.toList());
    }

    /** Returns the filesystem path of a backup file for streaming download. */
    public Path getBackupPath(String filename) {
        validateFilename(filename);
        Path path = ensureBackupDir().resolve(filename);
        if (!Files.exists(path)) throw new IllegalArgumentException("Backup file not found: " + filename);
        return path;
    }

    /** Runs pg_restore from the uploaded .sql or .dump file, overwriting current data. */
    public void restoreBackup(MultipartFile file) throws IOException, InterruptedException {
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null
                || (!originalFilename.endsWith(".sql") && !originalFilename.endsWith(".dump"))) {
            throw new IllegalArgumentException("Only .sql or .dump files are accepted.");
        }
        if (file.getSize() > 500L * 1024 * 1024) {
            throw new IllegalArgumentException("Backup file exceeds 500 MB limit.");
        }

        Path tempFile = Files.createTempFile("restore_", "_" + originalFilename);
        try {
            file.transferTo(tempFile);
            DbConn conn = parseJdbcUrl(datasourceUrl);

            ProcessBuilder pb = new ProcessBuilder(
                    backupProperties.getPgRestore(),
                    "-h", conn.host(),
                    "-p", String.valueOf(conn.port()),
                    "-U", dbUsername,
                    "-d", conn.database(),
                    "-F", "c",
                    "-c",
                    tempFile.toAbsolutePath().toString()
            );
            pb.environment().put("PGPASSWORD", dbPassword);
            pb.redirectErrorStream(true);

            log.info("Starting pg_restore for file: {}", originalFilename);
            Process process = pb.start();

            // Drain stdout+stderr on a separate thread to prevent buffer deadlock
            StringBuilder output = new StringBuilder();
            Thread reader = new Thread(() -> {
                try (BufferedReader br = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                    String line;
                    while ((line = br.readLine()) != null) {
                        log.info("[pg_restore] {}", line);
                        output.append(line).append('\n');
                    }
                } catch (IOException ignored) {}
            });
            reader.setDaemon(true);
            reader.start();

            int exitCode = process.waitFor();
            reader.join();

            if (exitCode != 0) {
                throw new RuntimeException("pg_restore failed (exit " + exitCode + "): " + output);
            }

            log.info("pg_restore completed successfully for file: {}", originalFilename);
            logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO,
                    "RESTORE", "Database", originalFilename,
                    "Restored database from backup", null);
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }

    /** Deletes a backup file by filename and logs the action. */
    public void deleteBackup(String filename) throws IOException {
        validateFilename(filename);
        Path path = ensureBackupDir().resolve(filename);
        if (!Files.exists(path)) throw new IllegalArgumentException("Backup file not found: " + filename);
        Files.delete(path);

        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO,
                "DELETE", "Backup", filename, "Deleted backup file " + filename, null);
    }

    /** Ensures the configured backup directory exists and returns its path. */
    private Path ensureBackupDir() {
        Path dir = Paths.get(backupProperties.getBackupDir());
        dir.toFile().mkdirs();
        return dir;
    }

    /** Rejects filenames containing path traversal characters. */
    private void validateFilename(String filename) {
        if (filename == null || filename.contains("/") || filename.contains("\\") || filename.contains("..")) {
            throw new IllegalArgumentException("Invalid filename.");
        }
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /** Parses a JDBC PostgreSQL URL into host, port, and database name. */
    private DbConn parseJdbcUrl(String url) {
        String withoutPrefix = url.replace("jdbc:", "");
        URI uri = URI.create(withoutPrefix);
        String host = uri.getHost() != null ? uri.getHost() : "localhost";
        int port = uri.getPort() > 0 ? uri.getPort() : 5432;
        String database = uri.getPath() != null ? uri.getPath().replaceFirst("/", "") : "";
        return new DbConn(host, port, database);
    }

    private record DbConn(String host, int port, String database) {}
}
