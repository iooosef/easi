package dev.tjj.easi.service;

import dev.tjj.easi.dto.SupplierRequest;
import dev.tjj.easi.dto.SupplierResponse;
import dev.tjj.easi.entity.Supplier;
import dev.tjj.easi.repository.SupplierRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/** Handles supplier business logic: creation, updates, and retrieval. */
@Service
public class SupplierService {

    private final SupplierRepository supplierRepository;

    public SupplierService(SupplierRepository supplierRepository) {
        this.supplierRepository = supplierRepository;
    }

    /** Creates and persists a new supplier record. */
    @Transactional
    public SupplierResponse create(SupplierRequest request) {
        Supplier supplier = new Supplier();
        applyRequest(supplier, request);
        supplier.setAddedOn(LocalDate.now());
        return toResponse(supplierRepository.save(supplier));
    }

    /** Updates an existing supplier's information by supplier ID. */
    @Transactional
    public SupplierResponse update(Integer supplierId, SupplierRequest request) {
        Supplier supplier = supplierRepository.findById(supplierId)
                .orElseThrow(() -> new IllegalArgumentException("Supplier not found."));
        applyRequest(supplier, request);
        return toResponse(supplierRepository.save(supplier));
    }

    /** Returns all supplier records. */
    public List<SupplierResponse> getAll() {
        return supplierRepository.findAll().stream().map(this::toResponse).toList();
    }

    /** Returns a single supplier record by supplier ID. */
    public SupplierResponse getById(Integer supplierId) {
        return supplierRepository.findById(supplierId)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Supplier not found."));
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
