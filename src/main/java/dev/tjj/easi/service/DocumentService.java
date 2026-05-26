package dev.tjj.easi.service;

import dev.tjj.easi.config.StorageProperties;
import dev.tjj.easi.dto.DocumentCreateRequest;
import dev.tjj.easi.dto.DocumentResponse;
import dev.tjj.easi.dto.DocumentUpdateRequest;
import dev.tjj.easi.entity.Document;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import dev.tjj.easi.repository.DocumentRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;

/** Handles document file storage and database record management. */
@Service
public class DocumentService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final DocumentRepository documentRepository;
    private final StorageProperties storageProperties;
    private final LogService logService;

    private Path uploadRoot;

    public DocumentService(DocumentRepository documentRepository, StorageProperties storageProperties, LogService logService) {
        this.documentRepository = documentRepository;
        this.storageProperties = storageProperties;
        this.logService = logService;
    }

    /** Initializes and creates the upload directory on application startup. */
    @PostConstruct
    public void init() {
        uploadRoot = Paths.get(storageProperties.getUploadDir()).toAbsolutePath().normalize();
        try {
            Files.createDirectories(uploadRoot);
        } catch (IOException e) {
            throw new IllegalStateException("Could not create upload directory: " + uploadRoot, e);
        }
    }

    /**
     * Saves the uploaded file to disk and creates a document record.
     * The file must not be empty. Description is optional.
     */
    @Transactional
    public DocumentResponse create(MultipartFile file, DocumentCreateRequest request) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File must not be empty.");
        }

        String originalName = sanitizeFileName(file.getOriginalFilename());
        String extension = extractExtension(originalName);
        String storedName = generateStoredName(extension);

        saveFileToDisk(file, storedName);

        Document document = new Document();
        document.setFileName(originalName);
        document.setDescription(request != null ? request.description() : null);
        document.setFileType(extension);
        document.setFilePath(storedName);
        document.setAddedOn(LocalDateTime.now());

        DocumentResponse response = toResponse(documentRepository.save(document));
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "Document",
                String.valueOf(response.docuId()), "Uploaded document '" + originalName + "'", null);
        return response;
    }

    /**
     * Updates an existing document record.
     * If a new file is provided, the old file is deleted and replaced.
     * Description is updated only when provided in the request.
     */
    @Transactional
    public DocumentResponse update(Integer docuId, MultipartFile newFile, DocumentUpdateRequest request) {
        Document document = documentRepository.findById(docuId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found."));

        if (newFile != null && !newFile.isEmpty()) {
            deleteFileFromDisk(document.getFilePath());

            String originalName = sanitizeFileName(newFile.getOriginalFilename());
            String extension = extractExtension(originalName);
            String storedName = generateStoredName(extension);

            saveFileToDisk(newFile, storedName);

            document.setFileName(originalName);
            document.setFileType(extension);
            document.setFilePath(storedName);
        }

        if (request != null && request.description() != null) {
            document.setDescription(request.description());
        }

        DocumentResponse response = toResponse(documentRepository.save(document));
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "Document",
                String.valueOf(docuId), "Updated document #" + docuId, null);
        return response;
    }

    /**
     * Streams the document file from disk with the appropriate Content-Type header.
     * Returns inline disposition so browsers render images and PDFs directly.
     */
    public ResponseEntity<Resource> serveFile(Integer docuId) {
        Document document = documentRepository.findById(docuId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found."));

        Path filePath = uploadRoot.resolve(document.getFilePath());
        Resource resource;
        try {
            resource = new UrlResource(filePath.toUri());
        } catch (Exception e) {
            throw new IllegalStateException("Could not resolve file path.", e);
        }

        if (!resource.exists() || !resource.isReadable()) {
            throw new IllegalStateException("File not found on disk: " + document.getFilePath());
        }

        String contentType = resolveContentType(document.getFileType());

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + document.getFileName() + "\"")
                .body(resource);
    }

    /** Maps a file extension to its MIME type; defaults to application/octet-stream. */
    private String resolveContentType(String fileType) {
        if (fileType == null) return "application/octet-stream";
        return switch (fileType.toLowerCase()) {
            case "pdf"       -> "application/pdf";
            case "jpg", "jpeg" -> "image/jpeg";
            case "png"       -> "image/png";
            case "gif"       -> "image/gif";
            case "webp"      -> "image/webp";
            default          -> "application/octet-stream";
        };
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /** Returns all document records. */
    public List<DocumentResponse> getAll() {
        return documentRepository.findAll().stream().map(this::toResponse).toList();
    }

    /** Returns a single document record by ID. */
    public DocumentResponse getById(Integer docuId) {
        return documentRepository.findById(docuId)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Document not found."));
    }

    /** Writes the file bytes to the upload directory under the given stored filename. */
    private void saveFileToDisk(MultipartFile file, String storedName) {
        try {
            Path destination = uploadRoot.resolve(storedName);
            Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to save file: " + storedName, e);
        }
    }

    /** Deletes a file from the upload directory; silently ignores missing files. */
    private void deleteFileFromDisk(String storedName) {
        try {
            Files.deleteIfExists(uploadRoot.resolve(storedName));
        } catch (IOException e) {
            throw new IllegalStateException("Failed to delete file: " + storedName, e);
        }
    }

    /**
     * Generates a unique stored filename using the current timestamp and 4 random hex bytes.
     * Result fits within the 30-character filePath column limit.
     */
    private String generateStoredName(String extension) {
        byte[] bytes = new byte[4];
        RANDOM.nextBytes(bytes);
        String hex = HexFormat.of().formatHex(bytes);
        String name = System.currentTimeMillis() + "_" + hex;
        return extension.isEmpty() ? name : name + "." + extension;
    }

    /** Extracts the file extension from the filename, lowercased, or empty string if none. */
    private String extractExtension(String fileName) {
        int dot = fileName.lastIndexOf('.');
        if (dot < 0 || dot == fileName.length() - 1) {
            return "";
        }
        return fileName.substring(dot + 1).toLowerCase();
    }

    /** Returns the original filename, or "file" if null or blank. */
    private String sanitizeFileName(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            return "file";
        }
        // Strip any path separators to prevent directory traversal
        return Paths.get(originalFilename).getFileName().toString();
    }

    private DocumentResponse toResponse(Document d) {
        return new DocumentResponse(
                d.getDocuId(),
                d.getFileName(),
                d.getDescription(),
                d.getFileType(),
                d.getFilePath(),
                d.getAddedOn()
        );
    }
}
