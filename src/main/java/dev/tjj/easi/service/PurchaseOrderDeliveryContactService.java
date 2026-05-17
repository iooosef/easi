package dev.tjj.easi.service;

import dev.tjj.easi.dto.PurchaseOrderDeliveryContactRequest;
import dev.tjj.easi.dto.PurchaseOrderDeliveryContactResponse;
import dev.tjj.easi.entity.PurchaseOrder;
import dev.tjj.easi.entity.PurchaseOrderDeliveryContact;
import dev.tjj.easi.repository.PurchaseOrderDeliveryContactRepository;
import dev.tjj.easi.repository.PurchaseOrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

/** Handles purchase order delivery contact business logic: creation, updates, and retrieval. */
@Service
public class PurchaseOrderDeliveryContactService {

    private final PurchaseOrderDeliveryContactRepository contactRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;

    public PurchaseOrderDeliveryContactService(PurchaseOrderDeliveryContactRepository contactRepository,
                                               PurchaseOrderRepository purchaseOrderRepository) {
        this.contactRepository = contactRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
    }

    /** Creates and persists a new purchase order delivery contact record. */
    @Transactional
    public PurchaseOrderDeliveryContactResponse add(PurchaseOrderDeliveryContactRequest request) {
        PurchaseOrderDeliveryContact contact = new PurchaseOrderDeliveryContact();
        applyRequest(contact, request);
        return toResponse(contactRepository.save(contact));
    }

    /** Updates an existing purchase order delivery contact record by ID. */
    @Transactional
    public PurchaseOrderDeliveryContactResponse update(Integer poContactNum, PurchaseOrderDeliveryContactRequest request) {
        PurchaseOrderDeliveryContact contact = contactRepository.findById(poContactNum)
                .orElseThrow(() -> new IllegalArgumentException("Purchase order delivery contact not found."));
        applyRequest(contact, request);
        return toResponse(contactRepository.save(contact));
    }

    /** Returns a page of purchase order delivery contact records. */
    public Page<PurchaseOrderDeliveryContactResponse> getAll(Pageable pageable) {
        return contactRepository.findAll(pageable).map(this::toResponse);
    }

    /** Returns a single purchase order delivery contact record by ID. */
    public PurchaseOrderDeliveryContactResponse getById(Integer poContactNum) {
        return contactRepository.findById(poContactNum)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Purchase order delivery contact not found."));
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
