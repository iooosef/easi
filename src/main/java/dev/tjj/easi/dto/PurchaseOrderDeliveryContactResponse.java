package dev.tjj.easi.dto;

public record PurchaseOrderDeliveryContactResponse(
        Integer poContactNum,
        String poNum,
        String contactName,
        String contactNumber
) {}
