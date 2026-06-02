package dev.tjj.easi.repository;

import dev.tjj.easi.entity.PurchaseOrder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, String> {

    Page<PurchaseOrder> findByServiceReport_SrNumber(Integer srNum, Pageable pageable);

    @Query("SELECT p.poNum FROM PurchaseOrder p WHERE p.poNum LIKE CONCAT(:prefix, '%') ORDER BY p.poNum DESC")
    List<String> findLatestPoNumsByPrefix(@Param("prefix") String prefix, Pageable pageable);

    @Query("SELECT po FROM PurchaseOrder po WHERE LOWER(po.poNum) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(po.purpose) LIKE LOWER(CONCAT('%', :q, '%'))")
    Page<PurchaseOrder> search(@Param("q") String q, Pageable pageable);

    @Query("SELECT po FROM PurchaseOrder po WHERE EXISTS (SELECT p FROM Part p WHERE p.purchaseOrder = po)")
    Page<PurchaseOrder> findWithParts(Pageable pageable);

    @Query("SELECT po FROM PurchaseOrder po WHERE EXISTS (SELECT p FROM Part p WHERE p.purchaseOrder = po) AND (LOWER(po.poNum) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(po.purpose) LIKE LOWER(CONCAT('%', :q, '%')))")
    Page<PurchaseOrder> searchWithParts(@Param("q") String q, Pageable pageable);

    @Query("SELECT po FROM PurchaseOrder po WHERE EXISTS (SELECT e FROM Equipment e WHERE e.purchaseOrder = po)")
    Page<PurchaseOrder> findWithEquipment(Pageable pageable);

    @Query("SELECT po FROM PurchaseOrder po WHERE EXISTS (SELECT e FROM Equipment e WHERE e.purchaseOrder = po) AND (LOWER(po.poNum) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(po.purpose) LIKE LOWER(CONCAT('%', :q, '%')))")
    Page<PurchaseOrder> searchWithEquipment(@Param("q") String q, Pageable pageable);

    @Query("""
            SELECT po.poNum, sr.srNumber, proj.name, po.terms, po.addedOn
            FROM PurchaseOrder po
            LEFT JOIN po.serviceReport sr
            LEFT JOIN sr.serviceSchedule sched
            LEFT JOIN sched.project proj
            WHERE po.addedOn BETWEEN :startDate AND :endDate
            ORDER BY po.addedOn DESC
            """)
    List<Object[]> findForReport(@Param("startDate") LocalDateTime startDate,
                                 @Param("endDate") LocalDateTime endDate);
}
