package dev.tjj.easi.repository;

import dev.tjj.easi.entity.ServiceReportBillingItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ServiceReportBillingItemRepository extends JpaRepository<ServiceReportBillingItem, Integer> {
}
