package dev.tjj.easi.service;

import dev.tjj.easi.entity.Log;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import dev.tjj.easi.entity.User;
import dev.tjj.easi.repository.LogRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** Handles creation and retrieval of audit/security/system log entries. */
@Service
public class LogService {

    private final LogRepository logRepository;

    public LogService(LogRepository logRepository) {
        this.logRepository = logRepository;
    }

    /**
     * Records a log entry for an authenticated user action.
     * Use this when the actor is a known, logged-in user.
     */
    @Transactional
    public void log(User user, LogType logType, LogSeverity severity,
                    String action, String entityType, String entityId,
                    String description, String ipAddress) {
        Log entry = buildEntry(logType, severity, action, entityType, entityId, description, ipAddress);
        entry.setUser(user);
        logRepository.save(entry);
    }

    /**
     * Records a log entry for an unauthenticated action.
     * Use this for login attempts, password resets, or any action without a session user.
     * actorIdentifier should be the submitted email or username, if available.
     */
    @Transactional
    public void log(String actorIdentifier, LogType logType, LogSeverity severity,
                    String action, String entityType, String entityId,
                    String description, String ipAddress) {
        Log entry = buildEntry(logType, severity, action, entityType, entityId, description, ipAddress);
        entry.setActorIdentifier(actorIdentifier);
        logRepository.save(entry);
    }

    /**
     * Records a system-level log entry with no actor (e.g., background jobs, startup events).
     */
    @Transactional
    public void logSystem(LogSeverity severity, String action, String description) {
        Log entry = buildEntry(LogType.SYSTEM, severity, action, null, null, description, null);
        logRepository.save(entry);
    }

    /** Returns a page of all log entries. */
    public Page<Log> getAll(Pageable pageable) {
        return logRepository.findAll(pageable);
    }

    /** Returns a page of log entries for a specific user. */
    public Page<Log> getByUser(User user, Pageable pageable) {
        return logRepository.findByUser(user, pageable);
    }

    /** Returns a page of log entries of a given type. */
    public Page<Log> getByLogType(LogType logType, Pageable pageable) {
        return logRepository.findByLogType(logType, pageable);
    }

    /** Returns a page of log entries of a given severity. */
    public Page<Log> getBySeverity(LogSeverity severity, Pageable pageable) {
        return logRepository.findBySeverity(severity, pageable);
    }

    /** Returns a page of log entries matching both type and severity. */
    public Page<Log> getByLogTypeAndSeverity(LogType logType, LogSeverity severity, Pageable pageable) {
        return logRepository.findByLogTypeAndSeverity(logType, severity, pageable);
    }

    /** Returns a page of log entries associated with a specific entity. */
    public Page<Log> getByEntity(String entityType, String entityId, Pageable pageable) {
        return logRepository.findByEntityTypeAndEntityId(entityType, entityId, pageable);
    }

    /** Returns a page of log entries within a time range. */
    public Page<Log> getByDateRange(LocalDateTime from, LocalDateTime to, Pageable pageable) {
        return logRepository.findByCreatedAtBetween(from, to, pageable);
    }

    /** Builds a base log entry with common fields. */
    private Log buildEntry(LogType logType, LogSeverity severity, String action,
                           String entityType, String entityId,
                           String description, String ipAddress) {
        Log entry = new Log();
        entry.setLogType(logType);
        entry.setSeverity(severity);
        entry.setAction(action);
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        entry.setDescription(description);
        entry.setIpAddress(ipAddress);
        entry.setCreatedAt(LocalDateTime.now());
        return entry;
    }
}
