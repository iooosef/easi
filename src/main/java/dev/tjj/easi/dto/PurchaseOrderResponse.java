package dev.tjj.easi.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record PurchaseOrderResponse(
        String poNum,
        String purpose,
        String terms,
        Integer srNum,
        String deliveryAddress,
        String remarks,
        String paymentMethod,
        String paymentDetails,
        LocalDateTime addedOn,
        BigDecimal totalCost
) {}
