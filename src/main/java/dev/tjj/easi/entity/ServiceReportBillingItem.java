package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "service_report_billing_item")
public class ServiceReportBillingItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "sr_billing_num")
    @Getter
    @Setter
    private Integer srBillingNum;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sr_number", nullable = false)
    @Getter
    @Setter
    private ServiceReport serviceReport;

    @Column(name = "description", length = 255, nullable = false)
    @Getter
    @Setter
    private String description;

    @Column(name = "quantity", nullable = false)
    @Getter
    @Setter
    private Integer quantity;

    @Column(name = "unit_price", nullable = false, precision = 19, scale = 2)
    @Getter
    @Setter
    private BigDecimal unitPrice;

    @Column(name = "added_on", nullable = false)
    @Getter
    @Setter
    private LocalDateTime addedOn;
}