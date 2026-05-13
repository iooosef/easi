package dev.tjj.easi.dto;

import java.math.BigDecimal;

public record VehicleGasLogResponse(
        Integer gasLogId,
        Integer vehicleLogId,
        BigDecimal amount,
        String invoiceId,
        Integer docuId
) {}
