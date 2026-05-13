package dev.tjj.easi.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PurchaseOrderDocumentRequest(

        @NotNull(message = "PO number is required")
        String poNum,

        @NotBlank(message = "Invoice ID is required")
        @Size(max = 16, message = "Invoice ID must not exceed 16 characters")
        String invoiceId,

        Integer docuId
) {}
