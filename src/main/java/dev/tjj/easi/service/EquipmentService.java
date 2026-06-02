package dev.tjj.easi.service;

import dev.tjj.easi.dto.EquipmentRequest;
import dev.tjj.easi.dto.EquipmentResponse;
import dev.tjj.easi.entity.Equipment;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import dev.tjj.easi.entity.PurchaseOrder;
import dev.tjj.easi.repository.EquipmentRepository;
import dev.tjj.easi.repository.PurchaseOrderRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** Handles CRUD operations for equipment records. */
@Service
public class EquipmentService {

    private final EquipmentRepository equipmentRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final LogService logService;

    public EquipmentService(EquipmentRepository equipmentRepository,
                            PurchaseOrderRepository purchaseOrderRepository,
                            LogService logService) {
        this.equipmentRepository = equipmentRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.logService = logService;
    }

    /** Creates and persists a new equipment record. */
    @Transactional
    public EquipmentResponse add(EquipmentRequest request) {
        Equipment equipment = new Equipment();
        applyRequest(equipment, request);
        equipment.setAddedOn(LocalDateTime.now());
        Equipment saved = equipmentRepository.save(equipment);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE",
                "Equipment", String.valueOf(saved.getEquipmentId()),
                "Added equipment #" + saved.getEquipmentId() + " — " + saved.getName(), null);
        return toResponse(saved);
    }

    /** Updates an existing equipment record by ID. */
    @Transactional
    public EquipmentResponse update(Integer equipmentId, EquipmentRequest request) {
        Equipment equipment = equipmentRepository.findById(equipmentId)
                .orElseThrow(() -> new IllegalArgumentException("Equipment not found."));
        applyRequest(equipment, request);
        Equipment saved = equipmentRepository.save(equipment);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE",
                "Equipment", String.valueOf(equipmentId),
                "Updated equipment #" + equipmentId, null);
        return toResponse(saved);
    }

    /** Deletes an equipment record by ID. */
    @Transactional
    public void delete(Integer equipmentId) {
        Equipment equipment = equipmentRepository.findById(equipmentId)
                .orElseThrow(() -> new IllegalArgumentException("Equipment not found."));
        equipmentRepository.delete(equipment);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "DELETE",
                "Equipment", String.valueOf(equipmentId),
                "Deleted equipment #" + equipmentId, null);
    }

    /** Returns a single equipment record by ID. */
    public EquipmentResponse getById(Integer equipmentId) {
        return equipmentRepository.findById(equipmentId)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Equipment not found."));
    }

    /** Returns a paginated, searchable list of equipment records filtered by type, status, or PO number. */
    public Page<EquipmentResponse> search(String search, String type, String status, String poNum, Pageable pageable) {
        if (poNum != null && !poNum.isBlank()) {
            return equipmentRepository.findByPurchaseOrder_PoNum(poNum, pageable).map(this::toResponse);
        }
        return equipmentRepository.search(search, type, status, pageable).map(this::toResponse);
    }

    private void applyRequest(Equipment equipment, EquipmentRequest request) {
        equipment.setName(request.name());
        equipment.setType(request.type());
        equipment.setModel(request.model());
        equipment.setSerialNumber(request.serialNumber());
        equipment.setDescription(request.description());
        equipment.setStatus(request.status());
        equipment.setStock(request.stock());
        equipment.setAcquisitionCost(request.acquisitionCost());

        if (request.poNum() != null) {
            PurchaseOrder po = purchaseOrderRepository.findById(request.poNum())
                    .orElseThrow(() -> new IllegalArgumentException("Purchase order not found."));
            equipment.setPurchaseOrder(po);
        } else {
            equipment.setPurchaseOrder(null);
        }
    }

    private EquipmentResponse toResponse(Equipment e) {
        return new EquipmentResponse(
                e.getEquipmentId(),
                e.getName(),
                e.getType(),
                e.getModel(),
                e.getSerialNumber(),
                e.getDescription(),
                e.getStatus(),
                e.getStock(),
                e.getAcquisitionCost(),
                e.getPurchaseOrder() != null ? e.getPurchaseOrder().getPoNum() : null,
                e.getAddedOn()
        );
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }
}
