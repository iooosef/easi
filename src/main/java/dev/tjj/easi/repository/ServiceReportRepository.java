package dev.tjj.easi.repository;

import dev.tjj.easi.entity.ServiceReport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ServiceReportRepository extends JpaRepository<ServiceReport, Integer> {

    Page<ServiceReport> findAllByProject_ProjNum(Integer projNum, Pageable pageable);

    @Query("""
            SELECT sr FROM ServiceReport sr
            LEFT JOIN FETCH sr.project
            LEFT JOIN FETCH sr.serviceSchedule
            LEFT JOIN FETCH sr.engineerEmployee
            WHERE sr.addedOn >= :start AND sr.addedOn <= :end
            AND (:projNum IS NULL OR sr.project.projNum = :projNum)
            AND (:status IS NULL OR sr.status = :status)
            AND (:paymentMethod IS NULL OR sr.paymentMethod = :paymentMethod)
            ORDER BY sr.addedOn ASC
            """)
    List<ServiceReport> findForSummaryReport(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end,
            @Param("projNum") Integer projNum,
            @Param("status") String status,
            @Param("paymentMethod") String paymentMethod);
}
