package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "vehicle_gas_logs_documents")
public class VehicleGasLogDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "proj_doc_id")
    @Getter
    @Setter
    private Integer projDocId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "gas_log_id", nullable = false)
    @Getter
    @Setter
    private VehicleGasLog vehicleGasLog;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "docu_id", nullable = false)
    @Getter
    @Setter
    private Document document;
}
