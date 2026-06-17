package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record VehicleMaintenanceLogRequest(

    @NotNull(message = "Vehicle log ID is required")
    @Schema(description = "Vehicle log ID this maintenance entry belongs to", example = "1")
    Integer vehicleLogId,

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.00", inclusive = true, message = "Amount must be zero or greater")
    @Schema(description = "Cost of the maintenance", example = "1500.00")
    BigDecimal amount,

    @NotBlank(message = "Invoice ID is required")
    @Size(max = 16, message = "Invoice ID must not exceed 16 characters")
    @Schema(description = "Invoice reference number", example = "INV-2024-0001")
    String invoiceId,

    @NotBlank(message = "Maintenance type is required")
    @Size(max = 30, message = "Maintenance type must not exceed 30 characters")
    @Schema(description = "Type of maintenance performed", example = "Oil Change")
    String mntType

) {}