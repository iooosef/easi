package dev.tjj.easi.repository;

import dev.tjj.easi.entity.VehicleGasLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface VehicleGasLogRepository extends JpaRepository<VehicleGasLog, Integer> {

    Page<VehicleGasLog> findByVehicleLogVehicleLogId(Integer vehicleLogId, Pageable pageable);

    @Query("""
            SELECT gl.gasLogId, v.vehicleModel, v.vehiclePlateNum, gl.invoiceId, gl.amount, vl.addedOn
            FROM VehicleGasLog gl
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
