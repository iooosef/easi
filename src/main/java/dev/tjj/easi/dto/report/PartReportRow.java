package dev.tjj.easi.dto.report;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

@Schema(description = "A single row in the Parts summary report")
public record PartReportRow(

        @Schema(description = "Part ID", example = "42")
        Integer partId,

        @Schema(description = "Part name", example = "Refrigerant R-410A")
        String name,

        @Schema(description = "Supplier name", example = "ABC Supply Co.")
        String supplierName,

        @Schema(description = "Quantity ordered", example = "10")
        Integer quantityOrdered,

        @Schema(description = "Unit of measure for the quantity", example = "pcs")
        String quantityType,

        @Schema(description = "Total quantity consumed across all service reports", example = "7")
        Integer quantityUsed,

        @Schema(description = "Unit price of the part", example = "250.00")
        BigDecimal unitPrice,

        @Schema(description = "Total cost: quantityOrdered × unitPrice", example = "2500.00")
        BigDecimal total,

        @Schema(description = "Current status of the part", example = "received",
                allowableValues = {"ordered", "received", "used"})
        String status

) {}
