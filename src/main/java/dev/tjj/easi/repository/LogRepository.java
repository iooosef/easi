package dev.tjj.easi.repository;

import dev.tjj.easi.entity.Log;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import dev.tjj.easi.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface LogRepository extends JpaRepository<Log, Long> {
    Page<Log> findByUser(User user, Pageable pageable);
    Page<Log> findByLogType(LogType logType, Pageable pageable);
    Page<Log> findBySeverity(LogSeverity severity, Pageable pageable);
    Page<Log> findByLogTypeAndSeverity(LogType logType, LogSeverity severity, Pageable pageable);
    Page<Log> findByEntityTypeAndEntityId(String entityType, String entityId, Pageable pageable);
    Page<Log> findByCreatedAtBetween(LocalDateTime from, LocalDateTime to, Pageable pageable);
}
