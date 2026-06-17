package dev.tjj.easi.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record VehicleMaintenanceLogRequest(
    @NotNull(message = "Vehicle log ID is required")
    Integer vehicleLogId,

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.00", inclusive = true, message = "Amount must be zero or greater")
    BigDecimal amount,

    @NotBlank(message = "Invoice ID is required")
    @Size(max = 16, message = "Invoice ID must not exceed 16 characters")
    String invoiceId,

    @NotBlank(message = "Maintenance type is required")
    @Size(max = 30, message = "Maintenance type must not exceed 30 characters")
    String mntType

) {}