package dev.tjj.easi.repository;

import dev.tjj.easi.entity.Employee;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, Integer> {

    @Query("SELECT e FROM Employee e WHERE EXISTS (SELECT u FROM User u WHERE u.employee = e AND u.role = :role)")
    Page<Employee> findByUserRole(@Param("role") String role, Pageable pageable);

    @Query("SELECT e FROM Employee e WHERE (CAST(:position AS string) IS NULL OR LOWER(e.position) LIKE LOWER(CONCAT('%', CAST(:position AS string), '%')))")
    Page<Employee> findFiltered(@Param("position") String position, Pageable pageable);
}
