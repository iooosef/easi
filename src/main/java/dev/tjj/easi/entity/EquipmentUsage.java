package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "equipment_usages")
public class EquipmentUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "usage_id")
    @Getter
    @Setter
    private Integer usageId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "equipment_id", nullable = false)
    @Getter
    @Setter
    private Equipment equipment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sched_id", nullable = false)
    @Getter
    @Setter
    private ServiceSchedule serviceSchedule;

    @Column(name = "notes", length = 255)
    @Getter
    @Setter
    private String notes;

    @Column(name = "logged_on", nullable = false)
    @Getter
    @Setter
    private LocalDateTime loggedOn;
}
