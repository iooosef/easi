package dev.tjj.easi.repository;

import dev.tjj.easi.entity.Employee;
import dev.tjj.easi.entity.EmployeeDocument;
import dev.tjj.easi.entity.ProjectDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface EmployeeDocumentRepository extends JpaRepository<EmployeeDocument, Integer> {

    Page<EmployeeDocument> findByEmployee_employee_id (Integer employee_Id, Pageable pageable);
}
