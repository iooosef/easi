package dev.tjj.easi.dto.report;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Schema(description = "A single row in the Purchase Orders summary report")
public record PurchaseOrderRow(

        @Schema(description = "Purchase order number", example = "PO-2025-001")
        String poNum,

        @Schema(description = "Linked service report number; null for equipment POs", example = "5")
        Integer srNumber,

        @Schema(description = "Project name linked via the service report; null for equipment POs", example = "SM Southmall")
        String projectName,

        @Schema(description = "Payment terms agreed with the supplier", example = "30 days")
        String terms,

        @Schema(description = "Purchase order type based on linked items",
                example = "parts", allowableValues = {"parts", "equipment"})
        String type,

        @Schema(description = "Total cost: sum of (qty × unit price) for parts POs, or sum of acquisition costs for equipment POs",
                example = "12500.00")
        BigDecimal total,

        @Schema(description = "Date and time the purchase order was created", example = "2025-03-10T08:30:00")
        LocalDateTime addedOn

) {}
