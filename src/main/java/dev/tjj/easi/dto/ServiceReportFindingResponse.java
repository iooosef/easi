package dev.tjj.easi.dto;

import java.time.LocalDateTime;

public record ServiceReportFindingResponse(
        Integer srFindingsNumber,
        Integer srNumber,
        String findingType,
        String partModel,
        Integer acNum,
        String remarks,
        LocalDateTime addedOn
) {}
