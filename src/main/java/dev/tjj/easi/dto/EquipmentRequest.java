package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record EquipmentRequest(

        @Schema(description = "Equipment name", example = "Industrial Vacuum Pump")
        @NotBlank(message = "Name is required")
        @Size(max = 150, message = "Name must not exceed 150 characters")
        String name,

        @Schema(description = "Equipment type", example = "durable", allowableValues = {"durable", "consumable"})
        @NotBlank(message = "Type is required")
        @Pattern(regexp = "durable|consumable", message = "Type must be 'durable' or 'consumable'")
        String type,

        @Schema(description = "Model or brand designation", example = "VP-300X")
        @Size(max = 100, message = "Model must not exceed 100 characters")
        String model,

        @Schema(description = "Serial number or asset tag", example = "SN-20240501-001")
        @Size(max = 100, message = "Serial number must not exceed 100 characters")
        String serialNumber,

        @Schema(description = "Brief description of the equipment", example = "High-pressure vacuum pump for refrigerant evacuation")
        @Size(max = 500, message = "Description must not exceed 500 characters")
        String description,

        @Schema(description = "Current status", example = "active", allowableValues = {"active", "under_maintenance", "retired", "depleted"})
        @NotBlank(message = "Status is required")
        @Pattern(regexp = "active|under_maintenance|retired|depleted", message = "Status must be one of: active, under_maintenance, retired, depleted")
        String status,

        @Schema(description = "Number of units in stock; defaults to 1 for durables", example = "1")
        @NotNull(message = "Stock is required")
        @Min(value = 0, message = "Stock must be zero or greater")
        Integer stock,

        @Schema(description = "Acquisition cost of the equipment", example = "12500.00")
        @DecimalMin(value = "0.00", message = "Acquisition cost must be non-negative")
        BigDecimal acquisitionCost,

        @Schema(description = "PO number that procured this equipment; null if not purchased via PO", example = "PO-2024-001")
        String poNum
) {}
