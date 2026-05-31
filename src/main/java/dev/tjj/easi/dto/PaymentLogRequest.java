package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PaymentLogRequest(

        @Schema(description = "Service report number this payment belongs to", example = "1")
        @NotNull(message = "Service report number is required")
        Integer srNumber,

        @Schema(description = "Amount paid", example = "1900.00")
        @NotNull(message = "Amount is required")
        @DecimalMin(value = "0.01", message = "Amount must be greater than zero")
        BigDecimal amount,

        @Schema(description = "Payment method used", example = "cash",
                allowableValues = {"cash", "check", "gcash", "bank"})
        @NotBlank(message = "Payment method is required")
        @Size(max = 16, message = "Payment method must not exceed 16 characters")
        String paymentMethod,

        @Schema(description = "Date the receipt was issued", example = "2026-01-09")
        @NotNull(message = "Receipt date is required")
        LocalDate receiptDate,

        @Schema(description = "Receipt or check reference number", example = "OR-2026-0042")
        @Size(max = 60, message = "Receipt number must not exceed 60 characters")
        String receiptNumber,

        @Schema(description = "Name of the person or organization that paid", example = "ABC Corporation")
        @NotBlank(message = "Paid by is required")
        @Size(max = 120, message = "Paid by must not exceed 120 characters")
        String paidBy,

        @Schema(description = "Optional notes about this payment", example = "Partial payment, balance next month")
        @Size(max = 255, message = "Notes must not exceed 255 characters")
        String notes
) {}
