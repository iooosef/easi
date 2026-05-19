package dev.tjj.easi.repository;

import dev.tjj.easi.entity.ServiceReport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ServiceReportRepository extends JpaRepository<ServiceReport, Integer> {

    Page<ServiceReport> findAllByProject_ProjNum(Integer projNum, Pageable pageable);
}
