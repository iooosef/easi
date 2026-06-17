package dev.tjj.easi.dto;

import java.math.BigDecimal;

public record VehicleMaintenanceLogResponse(
    Integer mntLogId,
    Integer vehicleLogId,
    BigDecimal amount,
    String invoiceId,
    String mntType
) {}