package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "vehicle_gas_logs")
public class VehicleGasLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "gas_log_id")
    @Getter
    @Setter
    private Integer gasLogId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicle_log_id", nullable = false)
    @Getter
    @Setter
    private VehicleLog vehicleLog;

    @Column(name = "amount", nullable = false, precision = 19, scale = 2)
    @Getter
    @Setter
    private BigDecimal amount;

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