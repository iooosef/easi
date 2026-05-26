package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "project_documents")
public class ProjectDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "proj_doc_id")
    @Getter
    @Setter
    private Integer projDocId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "proj_num", nullable = false)
    @Getter
    @Setter
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "docu_id", nullable = false)
    @Getter
    @Setter
    private Document document;
}
