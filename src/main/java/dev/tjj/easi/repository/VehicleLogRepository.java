package dev.tjj.easi.repository;

import dev.tjj.easi.entity.VehicleLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface VehicleLogRepository extends JpaRepository<VehicleLog, Integer> {

    Page<VehicleLog> findByVehicleVehiclesId(Integer vehiclesId, Pageable pageable);

    Page<VehicleLog> findByServiceScheduleSchedId(Integer schedId, Pageable pageable);

    Optional<VehicleLog> findTopByVehicleVehiclesIdAndOdometerEndIsNotNullOrderByAddedOnDesc(Integer vehiclesId);

    Optional<VehicleLog> findTopByVehicleVehiclesIdAndOdometerEndIsNullOrderByAddedOnDesc(Integer vehiclesId);
}
