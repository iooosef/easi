package dev.tjj.easi.repository;

import dev.tjj.easi.entity.PurchaseOrder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, String> {

    Page<PurchaseOrder> findByServiceReport_SrNumber(Integer srNum, Pageable pageable);

    @Query("SELECT p.poNum FROM PurchaseOrder p WHERE p.poNum LIKE CONCAT(:prefix, '%') ORDER BY p.poNum DESC")
    List<String> findLatestPoNumsByPrefix(@Param("prefix") String prefix, Pageable pageable);
}
