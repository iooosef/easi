package dev.tjj.easi.repository;

import dev.tjj.easi.entity.VehicleGasLog;
import dev.tjj.easi.entity.VehicleGasLogDocument;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface VehicleGasLogDocumentRepository extends JpaRepository<VehicleGasLogDocument, Integer> {

    /// SELECT * FROM vehicle_gas_logs_documents
    /// WHERE gas_log_id = input
    Page<VehicleGasLogDocument> findByVehicleGasLog(VehicleGasLog vehicleGasLog, Pageable pageable);
}
