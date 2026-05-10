package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "vehicles")
public class Vehicle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "vehicles_id")
    @Getter
    @Setter
    private Integer vehiclesId;

    @Column(name = "vehicle_model", length = 30, nullable = false)
    @Getter
    @Setter
    private String vehicleModel;

    @Column(name = "vehicle_plate_num", length = 12, nullable = false)
    @Getter
    @Setter
    private String vehiclePlateNum;

    @Column(name = "added_on", nullable = false)
    @Getter
    @Setter
    private LocalDateTime addedOn;
}