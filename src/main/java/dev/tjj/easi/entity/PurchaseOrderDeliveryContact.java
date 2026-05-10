package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "purchase_order_delivery_contacts")
public class PurchaseOrderDeliveryContact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "po_contact_num")
    @Getter
    @Setter
    private Integer poContactNum;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "po_num", nullable = false)
    @Getter
    @Setter
    private PurchaseOrder purchaseOrder;

    @Column(name = "contact_name", length = 300, nullable = false)
    @Getter
    @Setter
    private String contactName;

    @Column(name = "contact_number", length = 16, nullable = false)
    @Getter
    @Setter
    private String contactNumber;
}