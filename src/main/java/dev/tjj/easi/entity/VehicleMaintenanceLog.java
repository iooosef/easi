package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;

@Entity
@Table(name = "vehicle_maintenance_logs")
public class VehicleMaintenanceLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "mnt_log_id")
    @Getter
    @Setter
    private Integer mntLogId;

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

    @Column(name = "mnt_type", length = 30, nullable = false)
    @Getter
    @Setter
    private String mntType;

}