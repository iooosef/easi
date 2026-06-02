package dev.tjj.easi.repository;

import dev.tjj.easi.entity.Part;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PartRepository extends JpaRepository<Part, Integer> {

    Page<Part> findByPurchaseOrder_PoNum(String poNum, Pageable pageable);

    @Query("SELECT p FROM Part p WHERE (cast(:search as string) IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', cast(:search as string), '%')) OR LOWER(p.purchaseOrder.poNum) LIKE LOWER(CONCAT('%', cast(:search as string), '%'))) AND (cast(:status as string) IS NULL OR p.status = cast(:status as string))")
    Page<Part> search(@Param("search") String search, @Param("status") String status, Pageable pageable);

    @Query("SELECT COALESCE(SUM(p.quantityOrdered * p.unitPrice), 0) FROM Part p WHERE p.purchaseOrder.poNum = :poNum")
    BigDecimal sumTotalCostByPoNum(@Param("poNum") String poNum);

    @Query("SELECT COALESCE(SUM(p.quantityOrdered * p.unitPrice), 0) FROM Part p WHERE p.purchaseOrder.serviceReport.srNumber = :srNumber")
    BigDecimal sumTotalCostBySrNumber(@Param("srNumber") Integer srNumber);

    @Query("""
            SELECT p.purchaseOrder.serviceReport.srNumber, SUM(p.quantityOrdered * p.unitPrice)
            FROM Part p
            WHERE p.purchaseOrder.serviceReport.srNumber IN :srNumbers
            GROUP BY p.purchaseOrder.serviceReport.srNumber
            """)
    List<Object[]> sumTotalCostBySrNumbers(@Param("srNumbers") List<Integer> srNumbers);

    @Query("""
            SELECT p.purchaseOrder.poNum, SUM(p.quantityOrdered * p.unitPrice)
            FROM Part p
            WHERE p.purchaseOrder.poNum IN :poNums
            GROUP BY p.purchaseOrder.poNum
            """)
    List<Object[]> sumTotalByPoNums(@Param("poNums") List<String> poNums);

    @Query("""
            SELECT p.partId, p.name, sup.name, p.quantityOrdered, p.quantityType, p.unitPrice, p.status
            FROM Part p
            LEFT JOIN p.supplier sup
            WHERE p.addedOn BETWEEN :startDate AND :endDate
            ORDER BY p.addedOn DESC
            """)
    List<Object[]> findForReport(@Param("startDate") LocalDateTime startDate,
                                 @Param("endDate") LocalDateTime endDate);
}
