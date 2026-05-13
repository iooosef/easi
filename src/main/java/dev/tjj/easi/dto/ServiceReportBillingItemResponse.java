package dev.tjj.easi.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ServiceReportBillingItemResponse(
        Integer srBillingNum,
        Integer srNumber,
        String description,
        Integer quantity,
        BigDecimal unitPrice,
        LocalDateTime addedOn
) {}
