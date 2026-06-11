package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "vehicle_logs")
public class VehicleLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "vehicle_log_id")
    @Getter
    @Setter
    private Integer vehicleLogId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicle_id", nullable = false)
    @Getter
    @Setter
    private Vehicle vehicle;

    @Column(name = "purpose", length = 30, nullable = false)
    @Getter
    @Setter
    private String purpose;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sched_id")
    @Getter
    @Setter
    private ServiceSchedule serviceSchedule;

    @Column(name = "destination", length = 255, nullable = false)
    @Getter
    @Setter
    private String destination;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "driver_employee_id", nullable = false)
    @Getter
    @Setter
    private Employee driverEmployee;

    @Column(name = "odometer_start", nullable = false)
    @Getter
    @Setter
    private Integer odometerStart;

    @Column(name = "odometer_end")
    @Getter
    @Setter
    private Integer odometerEnd;

    @Column(name = "date", nullable = false)
    @Getter
    @Setter
    private LocalDate date;

    @Column(name = "status", length = 16, nullable = false, columnDefinition = "varchar(16) DEFAULT 'driving'")
    @Getter
    @Setter
    private String status = "driving";

    @Column(name = "added_on", nullable = false)
    @Getter
    @Setter
    private LocalDateTime addedOn;
}