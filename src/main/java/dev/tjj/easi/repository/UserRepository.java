package dev.tjj.easi.repository;

import dev.tjj.easi.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Integer> {
    Optional<User> findByEmail(String email);

    @Query("SELECT u FROM User u WHERE u.employee.employeeId = :employeeId")
    Optional<User> findByEmployeeId(@Param("employeeId") Integer employeeId);
}
