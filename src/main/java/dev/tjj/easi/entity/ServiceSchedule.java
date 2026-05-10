package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "service_schedule")
public class ServiceSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "sched_id")
    @Getter
    @Setter
    private Integer schedId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "proj_num", nullable = false)
    @Getter
    @Setter
    private Project project;

    @Column(name = "purpose", length = 30, nullable = false)
    @Getter
    @Setter
    private String purpose;

    @Column(name = "date", nullable = false)
    @Getter
    @Setter
    private LocalDate date;

    @Column(name = "status", length = 16, nullable = false, columnDefinition = "varchar(16) DEFAULT 'pending'")
    @Getter
    @Setter
    private String status = "pending";

    @Column(name = "added_on", nullable = false)
    @Getter
    @Setter
    private LocalDateTime addedOn;
}