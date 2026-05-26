package dev.tjj.easi.service;

import dev.tjj.easi.dto.PurchaseOrderDocumentRequest;
import dev.tjj.easi.dto.PurchaseOrderDocumentResponse;
import dev.tjj.easi.entity.Document;
import dev.tjj.easi.entity.PurchaseOrder;
import dev.tjj.easi.entity.PurchaseOrderDocument;
import dev.tjj.easi.repository.DocumentRepository;
import dev.tjj.easi.repository.PurchaseOrderDocumentRepository;
import dev.tjj.easi.repository.PurchaseOrderRepository;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

/** Handles purchase order document business logic: creation, updates, and retrieval. */
@Service
public class PurchaseOrderDocumentService {

    private final PurchaseOrderDocumentRepository poDocumentRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final DocumentRepository documentRepository;
    private final LogService logService;

    public PurchaseOrderDocumentService(PurchaseOrderDocumentRepository poDocumentRepository,
                                        PurchaseOrderRepository purchaseOrderRepository,
                                        DocumentRepository documentRepository,
                                        LogService logService) {
        this.poDocumentRepository = poDocumentRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.documentRepository = documentRepository;
        this.logService = logService;
    }

    /** Creates and persists a new purchase order document record. */
    @Transactional
    public PurchaseOrderDocumentResponse add(PurchaseOrderDocumentRequest request) {
        PurchaseOrderDocument poDocument = new PurchaseOrderDocument();
        applyRequest(poDocument, request);
        PurchaseOrderDocument saved = poDocumentRepository.save(poDocument);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "PurchaseOrderDocument", String.valueOf(saved.getPoDocNum()), "Created PO document #" + saved.getPoDocNum(), null);
        return toResponse(saved);
    }

    /** Updates an existing purchase order document record by ID. */
    @Transactional
    public PurchaseOrderDocumentResponse update(Integer poDocNum, PurchaseOrderDocumentRequest request) {
        PurchaseOrderDocument poDocument = poDocumentRepository.findById(poDocNum)
                .orElseThrow(() -> new IllegalArgumentException("Purchase order document not found."));
        applyRequest(poDocument, request);
        PurchaseOrderDocument saved = poDocumentRepository.save(poDocument);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "PurchaseOrderDocument", String.valueOf(poDocNum), "Updated PO document #" + poDocNum, null);
        return toResponse(saved);
    }

    /** Returns a page of purchase order document records. */
    public Page<PurchaseOrderDocumentResponse> getAll(Pageable pageable) {
        return poDocumentRepository.findAll(pageable).map(this::toResponse);
    }

    /** Returns a page of purchase order document records filtered by PO number. */
    public Page<PurchaseOrderDocumentResponse> getByPoNum(String poNum, Pageable pageable) {
        return poDocumentRepository.findByPurchaseOrder_PoNum(poNum, pageable).map(this::toResponse);
    }

    /** Returns a single purchase order document record by ID. */
    public PurchaseOrderDocumentResponse getById(Integer poDocNum) {
        return poDocumentRepository.findById(poDocNum)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Purchase order document not found."));
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /** Applies request fields onto the purchase order document entity. */
    private void applyRequest(PurchaseOrderDocument poDocument, PurchaseOrderDocumentRequest request) {
        PurchaseOrder purchaseOrder = purchaseOrderRepository.findById(request.poNum())
                .orElseThrow(() -> new IllegalArgumentException("Purchase order not found."));
        poDocument.setPurchaseOrder(purchaseOrder);
        poDocument.setInvoiceId(request.invoiceId());

        if (request.docuId() != null) {
            Document document = documentRepository.findById(request.docuId())
                    .orElseThrow(() -> new IllegalArgumentException("Document not found."));
            poDocument.setDocument(document);
        } else {
            poDocument.setDocument(null);
        }
    }

    private PurchaseOrderDocumentResponse toResponse(PurchaseOrderDocument d) {
        return new PurchaseOrderDocumentResponse(
                d.getPoDocNum(),
                d.getPurchaseOrder().getPoNum(),
                d.getInvoiceId(),
                d.getDocument() != null ? d.getDocument().getDocuId() : null
        );
    }
}
