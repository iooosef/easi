package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "schedule_vehicles")
public class ScheduleVehicle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "sched_vehicle_id")
    @Getter
    @Setter
    private Integer schedVehicleId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sched_id", nullable = false)
    @Getter
    @Setter
    private ServiceSchedule serviceSchedule;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicle_id", nullable = false)
    @Getter
    @Setter
    private Vehicle vehicle;

    @Column(name = "added_on", nullable = false)
    @Getter
    @Setter
    private LocalDateTime addedOn;
}
