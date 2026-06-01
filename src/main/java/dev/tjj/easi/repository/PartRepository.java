package dev.tjj.easi.repository;

import dev.tjj.easi.entity.Part;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;

@Repository
public interface PartRepository extends JpaRepository<Part, Integer> {

    Page<Part> findByPurchaseOrder_PoNum(String poNum, Pageable pageable);

    @Query("SELECT p FROM Part p WHERE (cast(:search as string) IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', cast(:search as string), '%')) OR LOWER(p.purchaseOrder.poNum) LIKE LOWER(CONCAT('%', cast(:search as string), '%'))) AND (cast(:status as string) IS NULL OR p.status = cast(:status as string))")
    Page<Part> search(@Param("search") String search, @Param("status") String status, Pageable pageable);

    @Query("SELECT COALESCE(SUM(p.quantityOrdered * p.unitPrice), 0) FROM Part p WHERE p.purchaseOrder.poNum = :poNum")
    BigDecimal sumTotalCostByPoNum(@Param("poNum") String poNum);
}
