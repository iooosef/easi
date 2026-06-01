package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "equipment")
public class Equipment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "equipment_id")
    @Getter
    @Setter
    private Integer equipmentId;

    @Column(name = "name", length = 150, nullable = false)
    @Getter
    @Setter
    private String name;

    /** "durable" or "consumable" */
    @Column(name = "type", length = 16, nullable = false)
    @Getter
    @Setter
    private String type;

    @Column(name = "model", length = 100)
    @Getter
    @Setter
    private String model;

    @Column(name = "serial_number", length = 100)
    @Getter
    @Setter
    private String serialNumber;

    @Column(name = "description", length = 500)
    @Getter
    @Setter
    private String description;

    /** "active" | "under_maintenance" | "retired" | "depleted" */
    @Column(name = "status", length = 20, nullable = false, columnDefinition = "varchar(20) DEFAULT 'active'")
    @Getter
    @Setter
    private String status = "active";

    /** Number of units/instances available. Defaults to 1 for durables. */
    @Column(name = "stock", nullable = false, columnDefinition = "int DEFAULT 1")
    @Getter
    @Setter
    private Integer stock = 1;

    @Column(name = "acquisition_cost", precision = 19, scale = 2)
    @Getter
    @Setter
    private BigDecimal acquisitionCost;

    /** Optional link to the purchase order that procured this equipment. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "po_num")
    @Getter
    @Setter
    private PurchaseOrder purchaseOrder;

    @Column(name = "added_on", nullable = false)
    @Getter
    @Setter
    private LocalDateTime addedOn;

    /** Optimistic lock version — guards concurrent durable deployments. */
    @Version
    @Column(name = "version", nullable = false)
    @Getter
    @Setter
    private Integer version = 0;
}
