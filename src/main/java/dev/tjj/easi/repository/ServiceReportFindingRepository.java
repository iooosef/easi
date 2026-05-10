package dev.tjj.easi.repository;

import dev.tjj.easi.entity.ServiceReportFinding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ServiceReportFindingRepository extends JpaRepository<ServiceReportFinding, Integer> {
}
