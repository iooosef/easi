package dev.tjj.easi.dto;

import java.time.LocalDate;

public record SupplierResponse(
        Integer supplierId,
        String name,
        String address,
        LocalDate addedOn
) {}
