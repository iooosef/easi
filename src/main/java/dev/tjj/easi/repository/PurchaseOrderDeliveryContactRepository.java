package dev.tjj.easi.repository;

import dev.tjj.easi.entity.PurchaseOrderDeliveryContact;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PurchaseOrderDeliveryContactRepository extends JpaRepository<PurchaseOrderDeliveryContact, Integer> {

    Page<PurchaseOrderDeliveryContact> findByPurchaseOrder_PoNum(String poNum, Pageable pageable);
}
