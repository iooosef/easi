package dev.tjj.easi.repository;

import dev.tjj.easi.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Integer> {

    @Query("SELECT p FROM Project p WHERE p.status = 'active' AND NOT EXISTS " +
           "(SELECT s FROM ServiceSchedule s WHERE s.project = p AND s.date >= :cutoff AND s.status <> 'cancelled')")
    List<Project> findActiveWithoutRecentOrUpcomingSchedule(@Param("cutoff") LocalDate cutoff);
}
