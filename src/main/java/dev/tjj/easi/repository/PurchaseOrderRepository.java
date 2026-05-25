package dev.tjj.easi.repository;

import dev.tjj.easi.entity.PurchaseOrder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, String> {

    Page<PurchaseOrder> findByServiceReport_SrNumber(Integer srNum, Pageable pageable);
}
