package dev.tjj.easi.repository;

import dev.tjj.easi.entity.Equipment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface EquipmentRepository extends JpaRepository<Equipment, Integer> {

    @Query("SELECT e FROM Equipment e WHERE " +
           "(cast(:search as string) IS NULL OR LOWER(e.name) LIKE LOWER(CONCAT('%', cast(:search as string), '%')) " +
           "OR LOWER(COALESCE(e.model, '')) LIKE LOWER(CONCAT('%', cast(:search as string), '%'))) " +
           "AND (cast(:type as string) IS NULL OR e.type = cast(:type as string)) " +
           "AND (cast(:status as string) IS NULL OR e.status = cast(:status as string))")
    Page<Equipment> search(@Param("search") String search,
                           @Param("type") String type,
                           @Param("status") String status,
                           Pageable pageable);
}
