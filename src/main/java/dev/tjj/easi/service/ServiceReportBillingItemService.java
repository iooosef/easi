package dev.tjj.easi.service;

import dev.tjj.easi.dto.ServiceReportBillingItemRequest;
import dev.tjj.easi.dto.ServiceReportBillingItemResponse;
import dev.tjj.easi.entity.ServiceReport;
import dev.tjj.easi.entity.ServiceReportBillingItem;
import dev.tjj.easi.repository.ServiceReportBillingItemRepository;
import dev.tjj.easi.repository.ServiceReportRepository;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** Handles service report billing item business logic: creation, updates, and retrieval. */
@Service
public class ServiceReportBillingItemService {

    private final ServiceReportBillingItemRepository billingItemRepository;
    private final ServiceReportRepository serviceReportRepository;
    private final LogService logService;

    public ServiceReportBillingItemService(ServiceReportBillingItemRepository billingItemRepository,
                                           ServiceReportRepository serviceReportRepository,
                                           LogService logService) {
        this.billingItemRepository = billingItemRepository;
        this.serviceReportRepository = serviceReportRepository;
        this.logService = logService;
    }

    /** Creates and persists a new service report billing item record. */
    @Transactional
    public ServiceReportBillingItemResponse add(ServiceReportBillingItemRequest request) {
        ServiceReportBillingItem item = new ServiceReportBillingItem();
        applyRequest(item, request);
        item.setAddedOn(LocalDateTime.now());
        ServiceReportBillingItem saved = billingItemRepository.save(item);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "ServiceReportBillingItem", String.valueOf(saved.getSrBillingNum()), "Created billing item #" + saved.getSrBillingNum(), null);
        return toResponse(saved);
    }

    /** Updates an existing service report billing item record by ID. */
    @Transactional
    public ServiceReportBillingItemResponse update(Integer srBillingNum, ServiceReportBillingItemRequest request) {
        ServiceReportBillingItem item = billingItemRepository.findById(srBillingNum)
                .orElseThrow(() -> new IllegalArgumentException("Service report billing item not found."));
        applyRequest(item, request);
        ServiceReportBillingItem saved = billingItemRepository.save(item);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "ServiceReportBillingItem", String.valueOf(srBillingNum), "Updated billing item #" + srBillingNum, null);
        return toResponse(saved);
    }

    /** Returns a page of service report billing item records. */
    public Page<ServiceReportBillingItemResponse> getAll(Pageable pageable) {
        return billingItemRepository.findAll(pageable).map(this::toResponse);
    }

    /** Returns a single service report billing item record by ID. */
    public ServiceReportBillingItemResponse getById(Integer srBillingNum) {
        return billingItemRepository.findById(srBillingNum)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Service report billing item not found."));
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /** Applies request fields onto the service report billing item entity. */
    private void applyRequest(ServiceReportBillingItem item, ServiceReportBillingItemRequest request) {
        ServiceReport serviceReport = serviceReportRepository.findById(request.srNumber())
                .orElseThrow(() -> new IllegalArgumentException("Service report not found."));
        item.setServiceReport(serviceReport);
        item.setDescription(request.description());
        item.setQuantity(request.quantity());
        item.setUnitPrice(request.unitPrice());
    }

    private ServiceReportBillingItemResponse toResponse(ServiceReportBillingItem i) {
        return new ServiceReportBillingItemResponse(
                i.getSrBillingNum(),
                i.getServiceReport().getSrNumber(),
                i.getDescription(),
                i.getQuantity(),
                i.getUnitPrice(),
                i.getAddedOn()
        );
    }
}
