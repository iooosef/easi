package dev.tjj.easi.dto.report;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;

@Schema(description = "A single row in the Service Report Billing report")
public record ServiceReportBillingRow(

        @Schema(description = "Service report number", example = "5")
        Integer srNumber,

        @Schema(description = "Date of the linked service schedule", example = "2025-03-15")
        LocalDate serviceDate,

        @Schema(description = "Sum of all billing item amounts (services and labor) for this SR", example = "3500.00")
        BigDecimal servicesAndLaborCost,

        @Schema(description = "Sum of (qtyUsed × unitPrice) for all part usages recorded against this SR", example = "1200.00")
        BigDecimal partsTotalCost,

        @Schema(description = "Total billed cost: servicesAndLaborCost + partsTotalCost", example = "4700.00")
        BigDecimal subtotalBilledCost,

        @Schema(description = "Sum of all payment log amounts received for this SR", example = "4700.00")
        BigDecimal totalPayments,

        @Schema(description = "Remaining balance: subtotalBilledCost − totalPayments", example = "0.00")
        BigDecimal balance

) {}
