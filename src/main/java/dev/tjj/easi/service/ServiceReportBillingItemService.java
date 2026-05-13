package dev.tjj.easi.service;

import dev.tjj.easi.dto.ServiceReportBillingItemRequest;
import dev.tjj.easi.dto.ServiceReportBillingItemResponse;
import dev.tjj.easi.entity.ServiceReport;
import dev.tjj.easi.entity.ServiceReportBillingItem;
import dev.tjj.easi.repository.ServiceReportBillingItemRepository;
import dev.tjj.easi.repository.ServiceReportRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** Handles service report billing item business logic: creation, updates, and retrieval. */
@Service
public class ServiceReportBillingItemService {

    private final ServiceReportBillingItemRepository billingItemRepository;
    private final ServiceReportRepository serviceReportRepository;

    public ServiceReportBillingItemService(ServiceReportBillingItemRepository billingItemRepository,
                                           ServiceReportRepository serviceReportRepository) {
        this.billingItemRepository = billingItemRepository;
        this.serviceReportRepository = serviceReportRepository;
    }

    /** Creates and persists a new service report billing item record. */
    @Transactional
    public ServiceReportBillingItemResponse add(ServiceReportBillingItemRequest request) {
        ServiceReportBillingItem item = new ServiceReportBillingItem();
        applyRequest(item, request);
        item.setAddedOn(LocalDateTime.now());
        return toResponse(billingItemRepository.save(item));
    }

    /** Updates an existing service report billing item record by ID. */
    @Transactional
    public ServiceReportBillingItemResponse update(Integer srBillingNum, ServiceReportBillingItemRequest request) {
        ServiceReportBillingItem item = billingItemRepository.findById(srBillingNum)
                .orElseThrow(() -> new IllegalArgumentException("Service report billing item not found."));
        applyRequest(item, request);
        return toResponse(billingItemRepository.save(item));
    }

    /** Returns all service report billing item records. */
    public List<ServiceReportBillingItemResponse> getAll() {
        return billingItemRepository.findAll().stream().map(this::toResponse).toList();
    }

    /** Returns a single service report billing item record by ID. */
    public ServiceReportBillingItemResponse getById(Integer srBillingNum) {
        return billingItemRepository.findById(srBillingNum)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Service report billing item not found."));
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
