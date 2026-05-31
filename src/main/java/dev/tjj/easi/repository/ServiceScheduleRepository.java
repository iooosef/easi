package dev.tjj.easi.repository;

import dev.tjj.easi.entity.ServiceSchedule;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ServiceScheduleRepository extends JpaRepository<ServiceSchedule, Integer> {

    @Query(value = "SELECT s FROM ServiceSchedule s JOIN FETCH s.project p WHERE " +
                   "(:search = '' OR LOWER(s.purpose) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%'))) AND " +
                   "(:projNum IS NULL OR p.projNum = :projNum)",
           countQuery = "SELECT COUNT(s) FROM ServiceSchedule s JOIN s.project p WHERE " +
                        "(:search = '' OR LOWER(s.purpose) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%'))) AND " +
                        "(:projNum IS NULL OR p.projNum = :projNum)")
    Page<ServiceSchedule> findFiltered(@Param("search") String search, @Param("projNum") Integer projNum, Pageable pageable);

    @Query(value = "SELECT s FROM ServiceSchedule s JOIN FETCH s.project p WHERE " +
                   "s.status NOT IN ('completed', 'cancelled') AND " +
                   "(:search = '' OR LOWER(s.purpose) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%'))) AND " +
                   "(:projNum IS NULL OR p.projNum = :projNum)",
           countQuery = "SELECT COUNT(s) FROM ServiceSchedule s JOIN s.project p WHERE " +
                        "s.status NOT IN ('completed', 'cancelled') AND " +
                        "(:search = '' OR LOWER(s.purpose) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%'))) AND " +
                        "(:projNum IS NULL OR p.projNum = :projNum)")
    Page<ServiceSchedule> findFilteredHideFinished(@Param("search") String search, @Param("projNum") Integer projNum, Pageable pageable);

    @Query("SELECT s FROM ServiceSchedule s JOIN FETCH s.project p WHERE s.date >= :dateFrom AND s.date <= :dateTo AND (:projNum IS NULL OR p.projNum = :projNum) ORDER BY s.date ASC")
    List<ServiceSchedule> findForCalendar(@Param("dateFrom") LocalDate dateFrom, @Param("dateTo") LocalDate dateTo, @Param("projNum") Integer projNum);

    @Query("SELECT s FROM ServiceSchedule s JOIN FETCH s.project p WHERE s.status = 'pending' AND s.date = :date")
    List<ServiceSchedule> findPendingByDate(@Param("date") LocalDate date);

    boolean existsByProjectProjNumAndDate(Integer projNum, LocalDate date);
}
