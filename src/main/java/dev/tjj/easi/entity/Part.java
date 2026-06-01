package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "parts")
public class Part {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "part_id")
    @Getter
    @Setter
    private Integer partId;

    @Column(name = "name", length = 255, nullable = false)
    @Getter
    @Setter
    private String name;

    @Column(name = "quantity_ordered", nullable = false)
    @Getter
    @Setter
    private Integer quantityOrdered;

    @Column(name = "quantity_type", length = 30, nullable = false)
    @Getter
    @Setter
    private String quantityType;

    @Column(name = "unit_price", nullable = false, precision = 19, scale = 2)
    @Getter
    @Setter
    private BigDecimal unitPrice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", nullable = false)
    @Getter
    @Setter
    private Supplier supplier;

    @Column(name = "order_date", nullable = false)
    @Getter
    @Setter
    private LocalDate orderDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "po_num", nullable = false)
    @Getter
    @Setter
    private PurchaseOrder purchaseOrder;

    @Column(name = "status", length = 16, nullable = false, columnDefinition = "varchar(16) DEFAULT 'ordered'")
    @Getter
    @Setter
    private String status = "ordered";

    @Column(name = "added_on", nullable = false)
    @Getter
    @Setter
    private LocalDateTime addedOn;
}