package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "projects")
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "proj_num")
    @Getter
    @Setter
    private Integer projNum;

    @Column(name = "name", length = 255, nullable = false)
    @Getter
    @Setter
    private String name;

    @Column(name = "address", length = 600, nullable = false)
    @Getter
    @Setter
    private String address;

    @Column(name = "type", length = 16, nullable = false)
    @Getter
    @Setter
    private String type;

    @Column(name = "contact_name", length = 300, nullable = false)
    @Getter
    @Setter
    private String contactName;

    @Column(name = "contact_number", length = 16, nullable = false)
    @Getter
    @Setter
    private String contactNumber;

    @Column(name = "contact_email", length = 255, nullable = false)
    @Getter
    @Setter
    private String contactEmail;

    @Column(name = "installation_progress", nullable = false, columnDefinition = "integer DEFAULT 0")
    @Getter
    @Setter
    private Integer installationProgress = 0;

    @Column(name = "warranty_status", nullable = false)
    @Getter
    @Setter
    private Integer warrantyStatus;

    @Column(name = "warranty_date", nullable = false)
    @Getter
    @Setter
    private LocalDate warrantyDate;

    @Column(name = "status", length = 16, nullable = false, columnDefinition = "varchar(16) DEFAULT 'active'")
    @Getter
    @Setter
    private String status = "active";

    @Column(name = "added_on", nullable = false)
    @Getter
    @Setter
    private LocalDateTime addedOn;
}