package dev.tjj.easi.dto;

public record VehicleMaintenanceLogDocumentResponse(

        Integer mntLogDocId,

        Integer mntLogId,

        Integer docuId,

        String fileName,

        String fileType

) {}