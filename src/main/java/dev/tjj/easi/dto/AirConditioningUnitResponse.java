package dev.tjj.easi.dto;

import java.time.LocalDateTime;

public record AirConditioningUnitResponse(
        Integer acNum,
        String brand,
        String model,
        String serialNum,
        Integer projNum,
        String status,
        LocalDateTime addedOn
) {}
