package dev.tjj.easi.repository;

import dev.tjj.easi.entity.AirConditioningUnit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AirConditioningUnitRepository extends JpaRepository<AirConditioningUnit, Integer> {

    Page<AirConditioningUnit> findByProjectProjNum(Integer projNum, Pageable pageable);
}
