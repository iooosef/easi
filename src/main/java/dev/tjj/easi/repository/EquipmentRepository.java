package dev.tjj.easi.repository;

import dev.tjj.easi.entity.Equipment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EquipmentRepository extends JpaRepository<Equipment, Integer> {

    Page<Equipment> findByPurchaseOrder_PoNum(String poNum, Pageable pageable);

    @Query("SELECT e FROM Equipment e WHERE " +
           "(cast(:search as string) IS NULL OR LOWER(e.name) LIKE LOWER(CONCAT('%', cast(:search as string), '%')) " +
           "OR LOWER(COALESCE(e.model, '')) LIKE LOWER(CONCAT('%', cast(:search as string), '%'))) " +
           "AND (cast(:type as string) IS NULL OR e.type = cast(:type as string)) " +
           "AND (cast(:status as string) IS NULL OR e.status = cast(:status as string))")
    Page<Equipment> search(@Param("search") String search,
                           @Param("type") String type,
                           @Param("status") String status,
                           Pageable pageable);

    @Query("""
            SELECT e.purchaseOrder.poNum, COALESCE(SUM(e.acquisitionCost), 0)
            FROM Equipment e
            WHERE e.purchaseOrder IS NOT NULL AND e.purchaseOrder.poNum IN :poNums
            GROUP BY e.purchaseOrder.poNum
            """)
    List<Object[]> sumCostByPoNums(@Param("poNums") List<String> poNums);
}
