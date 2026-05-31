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

    @Query(value = """
            SELECT sr FROM ServiceReport sr
            WHERE (:projNum IS NULL OR sr.project.projNum = :projNum)
            AND (
                :noFilter = true
                OR (:wantUnpaid = true
                    AND (SELECT COALESCE(SUM(p.amount), 0) FROM PaymentLog p WHERE p.serviceReport = sr) = 0)
                OR (:wantPartial = true
                    AND (SELECT COALESCE(SUM(p.amount), 0) FROM PaymentLog p WHERE p.serviceReport = sr) > 0
                    AND (SELECT COALESCE(SUM(p.amount), 0) FROM PaymentLog p WHERE p.serviceReport = sr) <
                        (SELECT COALESCE(SUM(b.unitPrice * b.quantity), 0) FROM ServiceReportBillingItem b WHERE b.serviceReport = sr))
                OR (:wantPaid = true
                    AND (SELECT COALESCE(SUM(b.unitPrice * b.quantity), 0) FROM ServiceReportBillingItem b WHERE b.serviceReport = sr) > 0
                    AND (SELECT COALESCE(SUM(p.amount), 0) FROM PaymentLog p WHERE p.serviceReport = sr) >=
                        (SELECT COALESCE(SUM(b.unitPrice * b.quantity), 0) FROM ServiceReportBillingItem b WHERE b.serviceReport = sr))
            )
            """,
            countQuery = """
            SELECT COUNT(sr) FROM ServiceReport sr
            WHERE (:projNum IS NULL OR sr.project.projNum = :projNum)
            AND (
                :noFilter = true
                OR (:wantUnpaid = true
                    AND (SELECT COALESCE(SUM(p.amount), 0) FROM PaymentLog p WHERE p.serviceReport = sr) = 0)
                OR (:wantPartial = true
                    AND (SELECT COALESCE(SUM(p.amount), 0) FROM PaymentLog p WHERE p.serviceReport = sr) > 0
                    AND (SELECT COALESCE(SUM(p.amount), 0) FROM PaymentLog p WHERE p.serviceReport = sr) <
                        (SELECT COALESCE(SUM(b.unitPrice * b.quantity), 0) FROM ServiceReportBillingItem b WHERE b.serviceReport = sr))
                OR (:wantPaid = true
                    AND (SELECT COALESCE(SUM(b.unitPrice * b.quantity), 0) FROM ServiceReportBillingItem b WHERE b.serviceReport = sr) > 0
                    AND (SELECT COALESCE(SUM(p.amount), 0) FROM PaymentLog p WHERE p.serviceReport = sr) >=
                        (SELECT COALESCE(SUM(b.unitPrice * b.quantity), 0) FROM ServiceReportBillingItem b WHERE b.serviceReport = sr))
            )
            """)
    Page<ServiceReport> findAllFiltered(
            @Param("projNum") Integer projNum,
            @Param("noFilter") boolean noFilter,
            @Param("wantUnpaid") boolean wantUnpaid,
            @Param("wantPartial") boolean wantPartial,
            @Param("wantPaid") boolean wantPaid,
            Pageable pageable);

    @Query("""
            SELECT sr FROM ServiceReport sr
            LEFT JOIN FETCH sr.project
            LEFT JOIN FETCH sr.serviceSchedule
            LEFT JOIN FETCH sr.engineerEmployee
            WHERE sr.addedOn >= :start AND sr.addedOn <= :end
            AND (:projNum IS NULL OR sr.project.projNum = :projNum)
            ORDER BY sr.addedOn ASC
            """)
    List<ServiceReport> findForSummaryReport(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end,
            @Param("projNum") Integer projNum);
}
