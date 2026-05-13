package dev.tjj.easi.service;

import dev.tjj.easi.dto.PurchaseOrderDocumentRequest;
import dev.tjj.easi.dto.PurchaseOrderDocumentResponse;
import dev.tjj.easi.entity.Document;
import dev.tjj.easi.entity.PurchaseOrder;
import dev.tjj.easi.entity.PurchaseOrderDocument;
import dev.tjj.easi.repository.DocumentRepository;
import dev.tjj.easi.repository.PurchaseOrderDocumentRepository;
import dev.tjj.easi.repository.PurchaseOrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Handles purchase order document business logic: creation, updates, and retrieval. */
@Service
public class PurchaseOrderDocumentService {

    private final PurchaseOrderDocumentRepository poDocumentRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final DocumentRepository documentRepository;

    public PurchaseOrderDocumentService(PurchaseOrderDocumentRepository poDocumentRepository,
                                        PurchaseOrderRepository purchaseOrderRepository,
                                        DocumentRepository documentRepository) {
        this.poDocumentRepository = poDocumentRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.documentRepository = documentRepository;
    }

    /** Creates and persists a new purchase order document record. */
    @Transactional
    public PurchaseOrderDocumentResponse add(PurchaseOrderDocumentRequest request) {
        PurchaseOrderDocument poDocument = new PurchaseOrderDocument();
        applyRequest(poDocument, request);
        return toResponse(poDocumentRepository.save(poDocument));
    }

    /** Updates an existing purchase order document record by ID. */
    @Transactional
    public PurchaseOrderDocumentResponse update(Integer poDocNum, PurchaseOrderDocumentRequest request) {
        PurchaseOrderDocument poDocument = poDocumentRepository.findById(poDocNum)
                .orElseThrow(() -> new IllegalArgumentException("Purchase order document not found."));
        applyRequest(poDocument, request);
        return toResponse(poDocumentRepository.save(poDocument));
    }

    /** Returns all purchase order document records. */
    public List<PurchaseOrderDocumentResponse> getAll() {
        return poDocumentRepository.findAll().stream().map(this::toResponse).toList();
    }

    /** Returns a single purchase order document record by ID. */
    public PurchaseOrderDocumentResponse getById(Integer poDocNum) {
        return poDocumentRepository.findById(poDocNum)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Purchase order document not found."));
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
