package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "vehicle_maintenance_log_documents")
public class VehicleMaintenanceLogDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "mnt_log_doc_id")
    @Getter
    @Setter
    private Integer mntLogDocId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mnt_log_id", nullable = false)
    @Getter
    @Setter
    private VehicleMaintenanceLog vehicleMaintenanceLog;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "docu_id", nullable = false)
    @Getter
    @Setter
    private Document document;
}