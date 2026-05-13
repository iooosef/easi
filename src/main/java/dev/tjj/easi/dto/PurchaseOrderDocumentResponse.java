package dev.tjj.easi.dto;

public record PurchaseOrderDocumentResponse(
        Integer poDocNum,
        String poNum,
        String invoiceId,
        Integer docuId
) {}
