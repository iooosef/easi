package dev.tjj.easi.service;

import dev.tjj.easi.dto.PartRequest;
import dev.tjj.easi.dto.PartResponse;
import dev.tjj.easi.entity.Part;
import dev.tjj.easi.entity.PurchaseOrder;
import dev.tjj.easi.entity.Supplier;
import dev.tjj.easi.repository.PartRepository;
import dev.tjj.easi.repository.PurchaseOrderRepository;
import dev.tjj.easi.repository.SupplierRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** Handles part business logic: creation, updates, and retrieval. */
@Service
public class PartService {

    private final PartRepository partRepository;
    private final SupplierRepository supplierRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;

    public PartService(PartRepository partRepository,
                       SupplierRepository supplierRepository,
                       PurchaseOrderRepository purchaseOrderRepository) {
        this.partRepository = partRepository;
        this.supplierRepository = supplierRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
    }

    /** Creates and persists a new part record. */
    @Transactional
    public PartResponse add(PartRequest request) {
        Part part = new Part();
        applyRequest(part, request);
        part.setAddedOn(LocalDateTime.now());
        return toResponse(partRepository.save(part));
    }

    /** Updates an existing part record by ID. */
    @Transactional
    public PartResponse update(Integer partId, PartRequest request) {
        Part part = partRepository.findById(partId)
                .orElseThrow(() -> new IllegalArgumentException("Part not found."));
        applyRequest(part, request);
        return toResponse(partRepository.save(part));
    }

    /** Returns all part records. */
    public List<PartResponse> getAll() {
        return partRepository.findAll().stream().map(this::toResponse).toList();
    }

    /** Returns a single part record by ID. */
    public PartResponse getById(Integer partId) {
        return partRepository.findById(partId)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Part not found."));
    }

    /** Applies request fields onto the part entity. */
    private void applyRequest(Part part, PartRequest request) {
        Supplier supplier = supplierRepository.findById(request.supplierId())
                .orElseThrow(() -> new IllegalArgumentException("Supplier not found."));
        PurchaseOrder purchaseOrder = purchaseOrderRepository.findById(request.poNum())
                .orElseThrow(() -> new IllegalArgumentException("Purchase order not found."));

        part.setName(request.name());
        part.setQuantity(request.quantity());
        part.setQuantityType(request.quantityType());
        part.setUnitPrice(request.unitPrice());
        part.setSupplier(supplier);
        part.setOrderDate(request.orderDate());
        part.setPurchaseOrder(purchaseOrder);

        if (request.status() != null && !request.status().isBlank()) {
            part.setStatus(request.status());
        }
    }

    private PartResponse toResponse(Part p) {
        return new PartResponse(
                p.getPartId(),
                p.getName(),
                p.getQuantity(),
                p.getQuantityType(),
                p.getUnitPrice(),
                p.getSupplier().getSupplierId(),
                p.getOrderDate(),
                p.getPurchaseOrder().getPoNum(),
                p.getStatus(),
                p.getAddedOn()
        );
    }
}
