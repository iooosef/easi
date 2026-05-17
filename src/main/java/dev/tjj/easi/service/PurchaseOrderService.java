package dev.tjj.easi.service;

import dev.tjj.easi.dto.PurchaseOrderRequest;
import dev.tjj.easi.dto.PurchaseOrderResponse;
import dev.tjj.easi.entity.Project;
import dev.tjj.easi.entity.PurchaseOrder;
import dev.tjj.easi.entity.ServiceReport;
import dev.tjj.easi.repository.ProjectRepository;
import dev.tjj.easi.repository.PurchaseOrderRepository;
import dev.tjj.easi.repository.ServiceReportRepository;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** Handles purchase order business logic: creation, updates, and retrieval. */
@Service
public class PurchaseOrderService {

    private final PurchaseOrderRepository purchaseOrderRepository;
    private final ProjectRepository projectRepository;
    private final ServiceReportRepository serviceReportRepository;

    public PurchaseOrderService(PurchaseOrderRepository purchaseOrderRepository,
                                ProjectRepository projectRepository,
                                ServiceReportRepository serviceReportRepository) {
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.projectRepository = projectRepository;
        this.serviceReportRepository = serviceReportRepository;
    }

    /** Creates and persists a new purchase order record. */
    @Transactional
    public PurchaseOrderResponse add(PurchaseOrderRequest request) {
        if (purchaseOrderRepository.existsById(request.poNum())) {
            throw new IllegalArgumentException("Purchase order with this PO number already exists.");
        }
        PurchaseOrder po = new PurchaseOrder();
        po.setPoNum(request.poNum());
        applyRequest(po, request);
        po.setAddedOn(LocalDateTime.now());
        return toResponse(purchaseOrderRepository.save(po));
    }

    /** Updates an existing purchase order record by PO number. */
    @Transactional
    public PurchaseOrderResponse update(String poNum, PurchaseOrderRequest request) {
        PurchaseOrder po = purchaseOrderRepository.findById(poNum)
                .orElseThrow(() -> new IllegalArgumentException("Purchase order not found."));
        applyRequest(po, request);
        return toResponse(purchaseOrderRepository.save(po));
    }

    /** Returns a page of purchase order records. */
    public Page<PurchaseOrderResponse> getAll(Pageable pageable) {
        return purchaseOrderRepository.findAll(pageable).map(this::toResponse);
    }

    /** Returns a single purchase order record by PO number. */
    public PurchaseOrderResponse getById(String poNum) {
        return purchaseOrderRepository.findById(poNum)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Purchase order not found."));
    }

    /** Applies request fields onto the purchase order entity. */
    private void applyRequest(PurchaseOrder po, PurchaseOrderRequest request) {
        Project project = projectRepository.findById(request.projNum())
                .orElseThrow(() -> new IllegalArgumentException("Project not found."));
        po.setProject(project);
        po.setPurpose(request.purpose());
        po.setTerms(request.terms());
        po.setDeliveryAddress(request.deliveryAddress());
        po.setRemarks(request.remarks());

        if (request.paymentMethod() != null && !request.paymentMethod().isBlank()) {
            po.setPaymentMethod(request.paymentMethod());
        }

        po.setPaymentDetails(request.paymentDetails());

        if (request.srNum() != null) {
            ServiceReport serviceReport = serviceReportRepository.findById(request.srNum())
                    .orElseThrow(() -> new IllegalArgumentException("Service report not found."));
            po.setServiceReport(serviceReport);
        } else {
            po.setServiceReport(null);
        }
    }

    private PurchaseOrderResponse toResponse(PurchaseOrder po) {
        return new PurchaseOrderResponse(
                po.getPoNum(),
                po.getProject().getProjNum(),
                po.getPurpose(),
                po.getTerms(),
                po.getServiceReport() != null ? po.getServiceReport().getSrNumber() : null,
                po.getDeliveryAddress(),
                po.getRemarks(),
                po.getPaymentMethod(),
                po.getPaymentDetails(),
                po.getAddedOn()
        );
    }
}
