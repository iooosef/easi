package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record EquipmentResponse(

        @Schema(description = "Unique equipment ID", example = "1")
        Integer equipmentId,

        @Schema(description = "Equipment name", example = "Industrial Vacuum Pump")
        String name,

        @Schema(description = "Equipment type: durable or consumable", example = "durable")
        String type,

        @Schema(description = "Model or brand designation", example = "VP-300X")
        String model,

        @Schema(description = "Serial number or asset tag", example = "SN-20240501-001")
        String serialNumber,

        @Schema(description = "Brief description", example = "High-pressure vacuum pump for refrigerant evacuation")
        String description,

        @Schema(description = "Current status", example = "active")
        String status,

        @Schema(description = "Number of units in stock", example = "1")
        Integer stock,

        @Schema(description = "Acquisition cost", example = "12500.00")
        BigDecimal acquisitionCost,

        @Schema(description = "PO number linked to this equipment, if any", example = "PO-2024-001")
        String poNum,

        @Schema(description = "Timestamp when the equipment record was added")
        LocalDateTime addedOn
) {}
