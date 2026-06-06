package dev.tjj.easi.repository;

import dev.tjj.easi.entity.ScheduleVehicle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ScheduleVehicleRepository extends JpaRepository<ScheduleVehicle, Integer> {
    List<ScheduleVehicle> findByServiceScheduleSchedId(Integer schedId);
    boolean existsByVehicleVehiclesIdAndServiceScheduleSchedId(Integer vehicleId, Integer schedId);
}
