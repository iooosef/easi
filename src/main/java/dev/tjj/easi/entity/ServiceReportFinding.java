package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "service_report_findings")
public class ServiceReportFinding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "sr_findings_number")
    @Getter
    @Setter
    private Integer srFindingsNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sr_number", nullable = false)
    @Getter
    @Setter
    private ServiceReport serviceReport;

    @Column(name = "finding_type", length = 6)
    @Getter
    @Setter
    private String findingType;

    @Column(name = "part_model", length = 60)
    @Getter
    @Setter
    private String partModel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ac_num", nullable = false)
    @Getter
    @Setter
    private AirConditioningUnit airConditioningUnit;

    @Column(name = "remarks", length = 1200)
    @Getter
    @Setter
    private String remarks;

    @Column(name = "added_on", nullable = false)
    @Getter
    @Setter
    private LocalDateTime addedOn;
}