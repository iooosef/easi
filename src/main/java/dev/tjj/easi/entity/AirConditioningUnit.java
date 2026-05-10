package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "air_conditioning_units")
public class AirConditioningUnit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ac_num")
    @Getter
    @Setter
    private Integer acNum;

    @Column(name = "brand", length = 30, nullable = false)
    @Getter
    @Setter
    private String brand;

    @Column(name = "model", length = 30, nullable = false)
    @Getter
    @Setter
    private String model;

    @Column(name = "serial_num", length = 60, nullable = false)
    @Getter
    @Setter
    private String serialNum;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "proj_num", nullable = false)
    @Getter
    @Setter
    private Project project;

    @Column(name = "status", length = 16, nullable = false, columnDefinition = "varchar(16) DEFAULT 'active'")
    @Getter
    @Setter
    private String status = "active";

    @Column(name = "added_on", nullable = false)
    @Getter
    @Setter
    private LocalDateTime addedOn;
}