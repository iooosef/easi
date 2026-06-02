package dev.tjj.easi.repository;

import dev.tjj.easi.entity.PartUsage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PartUsageRepository extends JpaRepository<PartUsage, Integer> {

    Page<PartUsage> findByPart_PartId(Integer partId, Pageable pageable);

    Page<PartUsage> findByServiceReport_SrNumber(Integer srNumber, Pageable pageable);

    @Query("SELECT COALESCE(SUM(pu.qtyUsed), 0) FROM PartUsage pu WHERE pu.part.partId = :partId")
    Integer sumQtyUsedByPartId(@Param("partId") Integer partId);

    @Query("""
            SELECT pu.part.partId, SUM(pu.qtyUsed)
            FROM PartUsage pu
            WHERE pu.part.partId IN :partIds
            GROUP BY pu.part.partId
            """)
    List<Object[]> sumQtyUsedByPartIds(@Param("partIds") List<Integer> partIds);
}
