package dev.tjj.easi.repository;

import dev.tjj.easi.entity.EquipmentUsage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;

@Repository
public interface EquipmentUsageRepository extends JpaRepository<EquipmentUsage, Integer> {

    Page<EquipmentUsage> findByEquipment_EquipmentId(Integer equipmentId, Pageable pageable);

    Page<EquipmentUsage> findByServiceSchedule_SchedId(Integer schedId, Pageable pageable);

    @Query("SELECT COUNT(eu) FROM EquipmentUsage eu " +
           "WHERE eu.equipment.equipmentId = :equipmentId " +
           "AND eu.serviceSchedule.date = :date " +
           "AND (:excludeId IS NULL OR eu.usageId <> :excludeId)")
    long countConflict(@Param("equipmentId") Integer equipmentId,
                       @Param("date") LocalDate date,
                       @Param("excludeId") Integer excludeId);
}
