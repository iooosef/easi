package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "purchase_orders")
public class PurchaseOrder {

    @Id
    @Column(name = "po_num", length = 30)
    @Getter
    @Setter
    private String poNum;

    @Column(name = "purpose", length = 30, nullable = false)
    @Getter
    @Setter
    private String purpose;

    @Column(name = "terms", length = 16, nullable = false)
    @Getter
    @Setter
    private String terms;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sr_num")
    @Getter
    @Setter
    private ServiceReport serviceReport;

    @Column(name = "delivery_address", length = 600)
    @Getter
    @Setter
    private String deliveryAddress;

    @Column(name = "remarks", length = 255)
    @Getter
    @Setter
    private String remarks;

    @Column(name = "payment_method", length = 16, nullable = false, columnDefinition = "varchar(16) DEFAULT 'unset'")
    @Getter
    @Setter
    private String paymentMethod = "unset";

    @Column(name = "payment_details", length = 60)
    @Getter
    @Setter
    private String paymentDetails;

    @Column(name = "added_on", nullable = false)
    @Getter
    @Setter
    private LocalDateTime addedOn;
}