package dev.tjj.easi.repository;

import dev.tjj.easi.entity.VehicleMaintenanceLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface VehicleMaintenanceLogRepository extends JpaRepository<VehicleMaintenanceLog, Integer> {

    Page<VehicleMaintenanceLog> findByVehicleLogVehicleLogId(Integer vehicleLogId, Pageable pageable);

    @Query("""
            SELECT gl.mntLogId, v.vehicleModel, v.vehiclePlateNum, gl.invoiceId, gl.amount, gl.mntType, vl.addedOn
            FROM VehicleMaintenanceLog gl
            JOIN gl.vehicleLog vl
            JOIN vl.vehicle v
            WHERE vl.addedOn BETWEEN :startDate AND :endDate
            AND (:vehicleId IS NULL OR v.vehiclesId = :vehicleId)
            ORDER BY vl.addedOn DESC
            """)
    List<Object[]> findForReport(@Param("startDate") LocalDateTime startDate,
                                 @Param("endDate") LocalDateTime endDate,
                                 @Param("vehicleId") Integer vehicleId);


}