package dev.tjj.easi.repository;

import dev.tjj.easi.entity.VehicleGasLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface VehicleGasLogRepository extends JpaRepository<VehicleGasLog, Integer> {
}
