package dev.tjj.easi.service;

import dev.tjj.easi.dto.PurchaseOrderRequest;
import dev.tjj.easi.dto.PurchaseOrderResponse;
import dev.tjj.easi.entity.Project;
import dev.tjj.easi.entity.PurchaseOrder;
import dev.tjj.easi.entity.ServiceReport;
import dev.tjj.easi.repository.PartRepository;
import dev.tjj.easi.repository.ProjectRepository;
import dev.tjj.easi.repository.PurchaseOrderRepository;
import dev.tjj.easi.repository.ServiceReportRepository;
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

/** Handles purchase order business logic: creation, updates, and retrieval. */
@Service
public class PurchaseOrderService {

    private final PurchaseOrderRepository purchaseOrderRepository;
    private final ProjectRepository projectRepository;
    private final ServiceReportRepository serviceReportRepository;
    private final PartRepository partRepository;
    private final LogService logService;

    public PurchaseOrderService(PurchaseOrderRepository purchaseOrderRepository,
                                ProjectRepository projectRepository,
                                ServiceReportRepository serviceReportRepository,
                                PartRepository partRepository,
                                LogService logService) {
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.projectRepository = projectRepository;
        this.serviceReportRepository = serviceReportRepository;
        this.partRepository = partRepository;
        this.logService = logService;
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
        PurchaseOrder saved = purchaseOrderRepository.save(po);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "PurchaseOrder", saved.getPoNum(), "Created purchase order " + saved.getPoNum(), null);
        return toResponse(saved);
    }

    /** Updates an existing purchase order record by PO number. */
    @Transactional
    public PurchaseOrderResponse update(String poNum, PurchaseOrderRequest request) {
        PurchaseOrder po = purchaseOrderRepository.findById(poNum)
                .orElseThrow(() -> new IllegalArgumentException("Purchase order not found."));
        applyRequest(po, request);
        PurchaseOrder saved = purchaseOrderRepository.save(po);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "PurchaseOrder", poNum, "Updated purchase order " + poNum, null);
        return toResponse(saved);
    }

    /** Returns a page of purchase order records, optionally filtered by service report number. */
    public Page<PurchaseOrderResponse> getAll(Integer srNum, Pageable pageable) {
        if (srNum != null) {
            return purchaseOrderRepository.findByServiceReport_SrNumber(srNum, pageable).map(this::toResponse);
        }
        return purchaseOrderRepository.findAll(pageable).map(this::toResponse);
    }

    /** Returns a single purchase order record by PO number. */
    public PurchaseOrderResponse getById(String poNum) {
        return purchaseOrderRepository.findById(poNum)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Purchase order not found."));
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
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
        BigDecimal totalCost = partRepository.sumTotalCostByPoNum(po.getPoNum());
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
                po.getAddedOn(),
                totalCost
        );
    }
}
