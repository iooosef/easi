package dev.tjj.easi.service;

import dev.tjj.easi.dto.PartRequest;
import dev.tjj.easi.dto.PartResponse;
import dev.tjj.easi.entity.Part;
import dev.tjj.easi.entity.PurchaseOrder;
import dev.tjj.easi.entity.Supplier;
import dev.tjj.easi.repository.PartRepository;
import dev.tjj.easi.repository.PartUsageRepository;
import dev.tjj.easi.repository.PaymentLogRepository;
import dev.tjj.easi.repository.PurchaseOrderRepository;
import dev.tjj.easi.repository.ServiceReportBillingItemRepository;
import dev.tjj.easi.repository.SupplierRepository;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** Handles part business logic: creation, updates, and retrieval. */
@Service
public class PartService {

    private final PartRepository partRepository;
    private final SupplierRepository supplierRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final PartUsageRepository partUsageRepository;
    private final ServiceReportBillingItemRepository billingItemRepository;
    private final PaymentLogRepository paymentLogRepository;
    private final LogService logService;

    public PartService(PartRepository partRepository,
                       SupplierRepository supplierRepository,
                       PurchaseOrderRepository purchaseOrderRepository,
                       PartUsageRepository partUsageRepository,
                       ServiceReportBillingItemRepository billingItemRepository,
                       PaymentLogRepository paymentLogRepository,
                       LogService logService) {
        this.partRepository = partRepository;
        this.supplierRepository = supplierRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.partUsageRepository = partUsageRepository;
        this.billingItemRepository = billingItemRepository;
        this.paymentLogRepository = paymentLogRepository;
        this.logService = logService;
    }

    /** Creates and persists a new part record. */
    @Transactional
    public PartResponse add(PartRequest request) {
        Part part = new Part();
        applyRequest(part, request);
        part.setOrderDate(java.time.LocalDate.now());
        part.setAddedOn(LocalDateTime.now());
        Part saved = partRepository.save(part);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "Part", String.valueOf(saved.getPartId()), "Created part #" + saved.getPartId(), null);
        return toResponse(saved);
    }

    /** Updates an existing part record by ID.
     *  Rejects the update if lowering the unit price would make any linked SR's grand total fall below its total paid. */
    @Transactional
    public PartResponse update(Integer partId, PartRequest request) {
        Part part = partRepository.findById(partId)
                .orElseThrow(() -> new IllegalArgumentException("Part not found."));
        applyRequest(part, request);
        Part saved = partRepository.save(part);
        List<Integer> affectedSrNums = partUsageRepository.findDistinctSrNumbersByPartId(saved.getPartId());
        for (Integer srNum : affectedSrNums) {
            validateSrNotOverpaid(srNum);
        }
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "Part", String.valueOf(partId), "Updated part #" + partId, null);
        return toResponse(saved);
    }

    /** Returns a page of part records, optionally filtered by PO number, search term, or status. */
    public Page<PartResponse> getAll(String poNum, String search, String status, Pageable pageable) {
        if (poNum != null && !poNum.isBlank()) {
            return partRepository.findByPurchaseOrder_PoNum(poNum, pageable).map(this::toResponse);
        }
        String searchVal = (search != null && !search.isBlank()) ? search : null;
        String statusVal = (status != null && !status.isBlank()) ? status : null;
        return partRepository.search(searchVal, statusVal, pageable).map(this::toResponse);
    }

    /** Deletes a part record by ID. */
    @Transactional
    public void delete(Integer partId) {
        Part part = partRepository.findById(partId)
                .orElseThrow(() -> new IllegalArgumentException("Part not found."));
        partRepository.delete(part);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "DELETE", "Part", String.valueOf(partId), "Deleted part #" + partId, null);
    }

    /** Returns a single part record by ID. */
    public PartResponse getById(Integer partId) {
        return partRepository.findById(partId)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Part not found."));
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /** Throws if the SR's grand total (billing items + part usages) is less than what has already been paid. */
    private void validateSrNotOverpaid(Integer srNumber) {
        BigDecimal grandTotal = billingItemRepository.sumTotalBySrNumber(srNumber)
                .add(partUsageRepository.sumTotalCostBySrNumber(srNumber));
        BigDecimal paid = paymentLogRepository.sumPaidBySrNumber(srNumber);
        if (paid.compareTo(grandTotal) > 0) {
            throw new IllegalArgumentException(
                    "Cannot reduce total for SR #" + srNumber + " below the amount already paid. " +
                    "Total paid: ₱" + paid.toPlainString() + ", new total would be: ₱" + grandTotal.toPlainString() + ".");
        }
    }

    /** Applies request fields onto the part entity. */
    private void applyRequest(Part part, PartRequest request) {
        Supplier supplier = supplierRepository.findById(request.supplierId())
                .orElseThrow(() -> new IllegalArgumentException("Supplier not found."));
        PurchaseOrder purchaseOrder = purchaseOrderRepository.findById(request.poNum())
                .orElseThrow(() -> new IllegalArgumentException("Purchase order not found."));

        part.setName(request.name());
        part.setQuantityOrdered(request.quantityOrdered());
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
        int totalUsed = partUsageRepository.sumQtyUsedByPartId(p.getPartId());
        int availableQty = p.getQuantityOrdered() - totalUsed;
        return new PartResponse(
                p.getPartId(),
                p.getName(),
                p.getQuantityOrdered(),
                availableQty,
                p.getQuantityType(),
                p.getUnitPrice(),
                p.getSupplier().getSupplierId(),
                p.getSupplier().getName(),
                p.getOrderDate(),
                p.getPurchaseOrder().getPoNum(),
                p.getStatus(),
                p.getAddedOn()
        );
    }
}
