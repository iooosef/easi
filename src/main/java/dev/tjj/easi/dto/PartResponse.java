package dev.tjj.easi.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record PartResponse(
        Integer partId,
        String name,
        Integer quantityOrdered,
        Integer availableQty,
        String quantityType,
        BigDecimal unitPrice,
        Integer supplierId,
        String supplierName,
        LocalDate orderDate,
        String poNum,
        String status,
        LocalDateTime addedOn
) {}
