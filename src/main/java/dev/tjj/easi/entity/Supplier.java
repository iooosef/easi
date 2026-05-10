package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "suppliers")
public class Supplier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "supplier_id")
    @Getter
    @Setter
    private Integer supplierId;

    @Column(name = "name", length = 120, nullable = false)
    @Getter
    @Setter
    private String name;

    @Column(name = "address", length = 600, nullable = false)
    @Getter
    @Setter
    private String address;

    @Column(name = "added_on", nullable = false)
    @Getter
    @Setter
    private LocalDate addedOn;
}