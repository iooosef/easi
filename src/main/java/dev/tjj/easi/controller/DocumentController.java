package dev.tjj.easi.controller;

import dev.tjj.easi.dto.DocumentCreateRequest;
import dev.tjj.easi.dto.DocumentResponse;
import dev.tjj.easi.dto.DocumentUpdateRequest;
import dev.tjj.easi.service.DocumentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * REST endpoints for document file management.
 * ADMIN and STAFF can upload and update documents.
 * ADMIN, STAFF, and CREW can read documents.
 */
@Tag(name = "Documents", description = "Upload, retrieve, and manage document files (images and PDFs)")
@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private final DocumentService documentService;

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    /**
     * Uploads a new document file. Accepts images (jpg, png, gif, webp) and PDFs.
     * The file is saved to configured storage and a document record is created.
     */
    @Operation(summary = "Upload a document file",
               description = "Accepts an image or PDF file with an optional description. Saves the file to storage and returns the created document record.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Document uploaded successfully"),
        @ApiResponse(responseCode = "400", description = "File is missing, empty, or invalid"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "403", description = "Forbidden — requires ADMIN or STAFF role")
    })
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DocumentResponse> upload(
            @Parameter(description = "Image or PDF file to upload") @RequestPart("file") MultipartFile file,
            @Parameter(description = "Optional description for the document") @RequestPart(value = "description", required = false) String description) {
        DocumentCreateRequest req = new DocumentCreateRequest(description);
        return ResponseEntity.status(HttpStatus.CREATED).body(documentService.create(file, req));
    }

    /**
     * Returns metadata for a single document by its ID.
     */
    @Operation(summary = "Get document metadata by ID",
               description = "Returns the document record including file name, type, description, and upload date.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Document found"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "404", description = "Document not found")
    })
    @GetMapping("/{docuId}")
    public ResponseEntity<DocumentResponse> getById(
            @Parameter(description = "Document ID", example = "1") @PathVariable Integer docuId) {
        return ResponseEntity.ok(documentService.getById(docuId));
    }

    /**
     * Streams the raw file bytes for a document with the appropriate Content-Type.
     * Images and PDFs are served with inline disposition for browser rendering.
     */
    @Operation(summary = "Stream document file",
               description = "Streams the raw document file. Content-Type is set automatically based on file extension. Response uses inline disposition so browsers can render images and PDFs directly.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "File streamed successfully"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "404", description = "Document not found"),
        @ApiResponse(responseCode = "500", description = "File not found on disk")
    })
    @GetMapping("/{docuId}/file")
    public ResponseEntity<Resource> serveFile(
            @Parameter(description = "Document ID", example = "1") @PathVariable Integer docuId) {
        return documentService.serveFile(docuId);
    }

    /**
     * Updates the description of an existing document.
     * Does not replace the file; only the description field is updated.
     */
    @Operation(summary = "Update document description",
               description = "Updates only the description of an existing document record. The file itself is not changed.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Document updated"),
        @ApiResponse(responseCode = "400", description = "Validation failed"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "403", description = "Forbidden — requires ADMIN or STAFF role"),
        @ApiResponse(responseCode = "404", description = "Document not found")
    })
    @PutMapping("/{docuId}")
    public ResponseEntity<DocumentResponse> update(
            @Parameter(description = "Document ID", example = "1") @PathVariable Integer docuId,
            @Valid @RequestBody DocumentUpdateRequest request) {
        return ResponseEntity.ok(documentService.update(docuId, null, request));
    }

    /**
     * Replaces the stored file of an existing document.
     * The old file is deleted from disk and replaced with the new upload.
     * Description is left unchanged.
     */
    @Operation(summary = "Replace document file",
               description = "Replaces the stored file of an existing document with a new upload. Accepts images or PDFs. The description is not changed.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "File replaced successfully"),
        @ApiResponse(responseCode = "400", description = "File is missing or invalid"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "403", description = "Forbidden — requires ADMIN or STAFF role"),
        @ApiResponse(responseCode = "404", description = "Document not found")
    })
    @PutMapping(value = "/{docuId}/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DocumentResponse> replaceFile(
            @Parameter(description = "Document ID", example = "1") @PathVariable Integer docuId,
            @Parameter(description = "New image or PDF file") @RequestPart("file") MultipartFile file) {
        return ResponseEntity.ok(documentService.update(docuId, file, null));
    }
}
