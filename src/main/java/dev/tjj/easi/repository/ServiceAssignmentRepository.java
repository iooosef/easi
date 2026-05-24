package dev.tjj.easi.repository;

import dev.tjj.easi.entity.ServiceAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ServiceAssignmentRepository extends JpaRepository<ServiceAssignment, Integer> {
    List<ServiceAssignment> findByServiceScheduleSchedId(Integer schedId);
}
