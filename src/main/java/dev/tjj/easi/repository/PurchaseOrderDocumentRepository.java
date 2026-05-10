package dev.tjj.easi.repository;

import dev.tjj.easi.entity.PurchaseOrderDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PurchaseOrderDocumentRepository extends JpaRepository<PurchaseOrderDocument, Integer> {
}
