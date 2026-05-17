package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "logs")
public class Log {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "log_id")
    @Getter
    @Setter
    private Long logId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @Getter
    @Setter
    private User user;

    @Column(name = "actor_identifier", length = 255)
    @Getter
    @Setter
    private String actorIdentifier;

    @Enumerated(EnumType.STRING)
    @Column(name = "log_type", length = 20, nullable = false)
    @Getter
    @Setter
    private LogType logType;

    @Enumerated(EnumType.STRING)
    @Column(name = "severity", length = 10, nullable = false)
    @Getter
    @Setter
    private LogSeverity severity;

    @Column(name = "action", length = 50, nullable = false)
    @Getter
    @Setter
    private String action;

    @Column(name = "entity_type", length = 50)
    @Getter
    @Setter
    private String entityType;

    @Column(name = "entity_id", length = 50)
    @Getter
    @Setter
    private String entityId;

    @Column(name = "description", columnDefinition = "TEXT")
    @Getter
    @Setter
    private String description;

    @Column(name = "ip_address", length = 45)
    @Getter
    @Setter
    private String ipAddress;

    @Column(name = "created_at", nullable = false)
    @Getter
    @Setter
    private LocalDateTime createdAt;
}
