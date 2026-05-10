package dev.tjj.easi.repository;

import dev.tjj.easi.entity.ServiceAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ServiceAssignmentRepository extends JpaRepository<ServiceAssignment, Integer> {
}
