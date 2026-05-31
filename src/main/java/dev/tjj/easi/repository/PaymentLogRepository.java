package dev.tjj.easi.repository;

import dev.tjj.easi.entity.PaymentLog;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface PaymentLogRepository extends JpaRepository<PaymentLog, Integer> {

    List<PaymentLog> findByServiceReport_SrNumber(Integer srNumber, Sort sort);

    @Query("SELECT COALESCE(SUM(pl.amount), 0) FROM PaymentLog pl WHERE pl.serviceReport.srNumber = :srNumber")
    BigDecimal sumPaidBySrNumber(@Param("srNumber") Integer srNumber);

    @Query("""
            SELECT pl.serviceReport.srNumber, SUM(pl.amount)
            FROM PaymentLog pl
            WHERE pl.serviceReport.srNumber IN :srNumbers
            GROUP BY pl.serviceReport.srNumber
            """)
    List<Object[]> sumPaidBySrNumbers(@Param("srNumbers") List<Integer> srNumbers);
}
