package dev.tjj.easi.service;

import dev.tjj.easi.dto.PurchaseOrderDeliveryContactRequest;
import dev.tjj.easi.dto.PurchaseOrderDeliveryContactResponse;
import dev.tjj.easi.entity.PurchaseOrder;
import dev.tjj.easi.entity.PurchaseOrderDeliveryContact;
import dev.tjj.easi.repository.PurchaseOrderDeliveryContactRepository;
import dev.tjj.easi.repository.PurchaseOrderRepository;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

/** Handles purchase order delivery contact business logic: creation, updates, and retrieval. */
@Service
public class PurchaseOrderDeliveryContactService {

    private final PurchaseOrderDeliveryContactRepository contactRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final LogService logService;

    public PurchaseOrderDeliveryContactService(PurchaseOrderDeliveryContactRepository contactRepository,
                                               PurchaseOrderRepository purchaseOrderRepository,
                                               LogService logService) {
        this.contactRepository = contactRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.logService = logService;
    }

    /** Creates and persists a new purchase order delivery contact record. */
    @Transactional
    public PurchaseOrderDeliveryContactResponse add(PurchaseOrderDeliveryContactRequest request) {
        PurchaseOrderDeliveryContact contact = new PurchaseOrderDeliveryContact();
        applyRequest(contact, request);
        PurchaseOrderDeliveryContact saved = contactRepository.save(contact);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "PurchaseOrderDeliveryContact", String.valueOf(saved.getPoContactNum()), "Created PO delivery contact #" + saved.getPoContactNum(), null);
        return toResponse(saved);
    }

    /** Updates an existing purchase order delivery contact record by ID. */
    @Transactional
    public PurchaseOrderDeliveryContactResponse update(Integer poContactNum, PurchaseOrderDeliveryContactRequest request) {
        PurchaseOrderDeliveryContact contact = contactRepository.findById(poContactNum)
                .orElseThrow(() -> new IllegalArgumentException("Purchase order delivery contact not found."));
        applyRequest(contact, request);
        PurchaseOrderDeliveryContact saved = contactRepository.save(contact);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "PurchaseOrderDeliveryContact", String.valueOf(poContactNum), "Updated PO delivery contact #" + poContactNum, null);
        return toResponse(saved);
    }

    /** Returns a page of purchase order delivery contact records, optionally filtered by PO number. */
    public Page<PurchaseOrderDeliveryContactResponse> getAll(String poNum, Pageable pageable) {
        if (poNum != null && !poNum.isBlank()) {
            return contactRepository.findByPurchaseOrder_PoNum(poNum, pageable).map(this::toResponse);
        }
        return contactRepository.findAll(pageable).map(this::toResponse);
    }

    /** Deletes a purchase order delivery contact record by ID. */
    @Transactional
    public void delete(Integer poContactNum) {
        PurchaseOrderDeliveryContact contact = contactRepository.findById(poContactNum)
                .orElseThrow(() -> new IllegalArgumentException("Purchase order delivery contact not found."));
        contactRepository.delete(contact);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "DELETE", "PurchaseOrderDeliveryContact", String.valueOf(poContactNum), "Deleted PO delivery contact #" + poContactNum, null);
    }

    /** Returns a single purchase order delivery contact record by ID. */
    public PurchaseOrderDeliveryContactResponse getById(Integer poContactNum) {
        return contactRepository.findById(poContactNum)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Purchase order delivery contact not found."));
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /** Applies request fields onto the purchase order delivery contact entity. */
    private void applyRequest(PurchaseOrderDeliveryContact contact, PurchaseOrderDeliveryContactRequest request) {
        PurchaseOrder purchaseOrder = purchaseOrderRepository.findById(request.poNum())
                .orElseThrow(() -> new IllegalArgumentException("Purchase order not found."));
        contact.setPurchaseOrder(purchaseOrder);
        contact.setContactName(request.contactName());
        contact.setContactNumber(request.contactNumber());
    }

    private PurchaseOrderDeliveryContactResponse toResponse(PurchaseOrderDeliveryContact c) {
        return new PurchaseOrderDeliveryContactResponse(
                c.getPoContactNum(),
                c.getPurchaseOrder().getPoNum(),
                c.getContactName(),
                c.getContactNumber()
        );
    }
}
