package dev.tjj.easi.repository;

import dev.tjj.easi.entity.VehicleLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface VehicleLogRepository extends JpaRepository<VehicleLog, Integer> {
}
