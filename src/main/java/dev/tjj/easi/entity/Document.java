package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "documents")
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "docu_id")
    @Getter
    @Setter
    private Integer docuId;

    @Column(name = "file_name", length = 255, nullable = false)
    @Getter
    @Setter
    private String fileName;

    @Column(name = "description", length = 600)
    @Getter
    @Setter
    private String description;

    @Column(name = "file_type", length = 16, nullable = false)
    @Getter
    @Setter
    private String fileType;

    @Column(name = "file_path", length = 30, nullable = false)
    @Getter
    @Setter
    private String filePath;

    @Column(name = "added_on", nullable = false)
    @Getter
    @Setter
    private LocalDateTime addedOn;
}