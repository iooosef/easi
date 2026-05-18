package dev.tjj.easi.service;

import dev.tjj.easi.dto.SupplierRequest;
import dev.tjj.easi.dto.SupplierResponse;
import dev.tjj.easi.entity.Supplier;
import dev.tjj.easi.repository.SupplierRepository;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/** Handles supplier business logic: creation, updates, and retrieval. */
@Service
public class SupplierService {

    private final SupplierRepository supplierRepository;
    private final LogService logService;

    public SupplierService(SupplierRepository supplierRepository, LogService logService) {
        this.supplierRepository = supplierRepository;
        this.logService = logService;
    }

    /** Creates and persists a new supplier record. */
    @Transactional
    public SupplierResponse create(SupplierRequest request) {
        Supplier supplier = new Supplier();
        applyRequest(supplier, request);
        supplier.setAddedOn(LocalDate.now());
        Supplier saved = supplierRepository.save(supplier);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "Supplier", String.valueOf(saved.getSupplierId()), "Created supplier #" + saved.getSupplierId(), null);
        return toResponse(saved);
    }

    /** Updates an existing supplier's information by supplier ID. */
    @Transactional
    public SupplierResponse update(Integer supplierId, SupplierRequest request) {
        Supplier supplier = supplierRepository.findById(supplierId)
                .orElseThrow(() -> new IllegalArgumentException("Supplier not found."));
        applyRequest(supplier, request);
        Supplier saved = supplierRepository.save(supplier);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "Supplier", String.valueOf(supplierId), "Updated supplier #" + supplierId, null);
        return toResponse(saved);
    }

    /** Returns a page of supplier records. */
    public Page<SupplierResponse> getAll(Pageable pageable) {
        return supplierRepository.findAll(pageable).map(this::toResponse);
    }

    /** Returns a single supplier record by supplier ID. */
    public SupplierResponse getById(Integer supplierId) {
        return supplierRepository.findById(supplierId)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Supplier not found."));
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /** Applies request fields onto the supplier entity. */
    private void applyRequest(Supplier supplier, SupplierRequest request) {
        supplier.setName(request.name());
        supplier.setAddress(request.address());
    }

    private SupplierResponse toResponse(Supplier s) {
        return new SupplierResponse(
                s.getSupplierId(),
                s.getName(),
                s.getAddress(),
                s.getAddedOn()
        );
    }
}
