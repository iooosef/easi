package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "part_usages")
public class PartUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "usage_id")
    @Getter
    @Setter
    private Integer usageId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "part_id", nullable = false)
    @Getter
    @Setter
    private Part part;

    /** Nullable — parts may be consumed outside a service report. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sr_number")
    @Getter
    @Setter
    private ServiceReport serviceReport;

    @Column(name = "qty_used", nullable = false)
    @Getter
    @Setter
    private Integer qtyUsed;

    @Column(name = "notes", length = 255)
    @Getter
    @Setter
    private String notes;

    @Column(name = "used_on", nullable = false)
    @Getter
    @Setter
    private LocalDateTime usedOn;
}
