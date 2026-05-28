package dev.tjj.easi.repository;

import dev.tjj.easi.entity.ServiceReportBillingItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ServiceReportBillingItemRepository extends JpaRepository<ServiceReportBillingItem, Integer> {

    Page<ServiceReportBillingItem> findByServiceReport_SrNumber(Integer srNumber, Pageable pageable);

    @Query("""
            SELECT bi.serviceReport.srNumber, SUM(bi.quantity * bi.unitPrice)
            FROM ServiceReportBillingItem bi
            WHERE bi.serviceReport.srNumber IN :srNumbers
            GROUP BY bi.serviceReport.srNumber
            """)
    List<Object[]> sumTotalBySrNumbers(@Param("srNumbers") List<Integer> srNumbers);
}
