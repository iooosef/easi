package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "service_reports")
public class ServiceReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "sr_number")
    @Getter
    @Setter
    private Integer srNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "proj_num", nullable = false)
    @Getter
    @Setter
    private Project project;

    @Column(name = "complaint", length = 900, nullable = false)
    @Getter
    @Setter
    private String complaint;

    @Column(name = "work_done", length = 900, nullable = false)
    @Getter
    @Setter
    private String workDone;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "engineer_employee_id")
    @Getter
    @Setter
    private Employee engineerEmployee;

    @Column(name = "location", nullable = false)
    @Getter
    @Setter
    private String location;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sched_id", nullable = false)
    @Getter
    @Setter
    private ServiceSchedule serviceSchedule;

    @Column(name = "payment_method", length = 16, nullable = false, columnDefinition = "varchar(16) DEFAULT 'unset'")
    @Getter
    @Setter
    private String paymentMethod = "unset";

    @Column(name = "receipt_receive_date")
    @Getter
    @Setter
    private LocalDate receiptReceiveDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "docu_id")
    @Getter
    @Setter
    private Document document;

    @Column(name = "status", length = 16, nullable = false, columnDefinition = "varchar(16) DEFAULT 'unpaid'")
    @Getter
    @Setter
    private String status = "unpaid";

    @Column(name = "added_on", nullable = false)
    @Getter
    @Setter
    private LocalDateTime addedOn;
}