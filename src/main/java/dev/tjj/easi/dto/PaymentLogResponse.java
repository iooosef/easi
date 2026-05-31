package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record PaymentLogResponse(

        @Schema(description = "Payment log ID", example = "1")
        Integer logId,

        @Schema(description = "Service report number", example = "1")
        Integer srNumber,

        @Schema(description = "Amount paid", example = "1900.00")
        BigDecimal amount,

        @Schema(description = "Payment method", example = "cash")
        String paymentMethod,

        @Schema(description = "Date the receipt was issued", example = "2026-01-09")
        LocalDate receiptDate,

        @Schema(description = "Receipt or reference number", example = "OR-2026-0042")
        String receiptNumber,

        @Schema(description = "Person or organization that paid", example = "ABC Corporation")
        String paidBy,

        @Schema(description = "Optional notes", example = "Partial payment")
        String notes,

        @Schema(description = "Datetime this log was recorded", example = "2026-01-09T14:00:00")
        LocalDateTime addedOn
) {}
