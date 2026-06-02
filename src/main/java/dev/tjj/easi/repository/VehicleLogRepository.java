package dev.tjj.easi.repository;

import dev.tjj.easi.entity.VehicleLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface VehicleLogRepository extends JpaRepository<VehicleLog, Integer> {

    Page<VehicleLog> findByVehicleVehiclesId(Integer vehiclesId, Pageable pageable);

    Page<VehicleLog> findByServiceScheduleSchedId(Integer schedId, Pageable pageable);

    Optional<VehicleLog> findTopByVehicleVehiclesIdAndOdometerEndIsNotNullOrderByAddedOnDesc(Integer vehiclesId);

    Optional<VehicleLog> findTopByVehicleVehiclesIdAndOdometerEndIsNullOrderByAddedOnDesc(Integer vehiclesId);

    @Query("""
            SELECT vl.vehicleLogId, v.vehicleModel, v.vehiclePlateNum,
                   vl.odometerStart, vl.odometerEnd, vl.addedOn
            FROM VehicleLog vl
            JOIN vl.vehicle v
            WHERE vl.addedOn BETWEEN :startDate AND :endDate
            AND (:vehicleId IS NULL OR v.vehiclesId = :vehicleId)
            ORDER BY vl.addedOn DESC
            """)
    List<Object[]> findForReport(@Param("startDate") LocalDateTime startDate,
                                 @Param("endDate") LocalDateTime endDate,
                                 @Param("vehicleId") Integer vehicleId);
}
