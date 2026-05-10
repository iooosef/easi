package dev.tjj.easi.repository;

import dev.tjj.easi.entity.ServiceSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ServiceScheduleRepository extends JpaRepository<ServiceSchedule, Integer> {
}
