package dev.tjj.easi.repository;

import dev.tjj.easi.entity.ProjectDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectDocumentRepository extends JpaRepository<ProjectDocument, Integer> {

    Page<ProjectDocument> findByProject_ProjNum(Integer projNum, Pageable pageable);
}
