package dev.tjj.easi.dto.report;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Schema(description = "A single row in the Vehicle Gas Logs report")
public record VehicleGasLogRow(

        @Schema(description = "Gas log ID", example = "7")
        Integer gasLogId,

        @Schema(description = "Vehicle model name", example = "Toyota Hilux")
        String vehicleModel,

        @Schema(description = "Vehicle plate number", example = "ABC 1234")
        String plateNumber,

        @Schema(description = "Invoice ID for the gas purchase", example = "INV-20250301-001")
        String invoiceId,

        @Schema(description = "Amount paid for gas", example = "1500.00")
        BigDecimal amount,

        @Schema(description = "Date and time the vehicle log was created", example = "2025-03-10T08:30:00")
        LocalDateTime addedOn

) {}
