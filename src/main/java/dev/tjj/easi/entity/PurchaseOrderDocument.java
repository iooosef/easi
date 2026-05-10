package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "purchase_order_documents")
public class PurchaseOrderDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "po_doc_num")
    @Getter
    @Setter
    private Integer poDocNum;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "po_num", nullable = false)
    @Getter
    @Setter
    private PurchaseOrder purchaseOrder;

    @Column(name = "invoice_id", length = 16, nullable = false)
    @Getter
    @Setter
    private String invoiceId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "docu_id")
    @Getter
    @Setter
    private Document document;
}