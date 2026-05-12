package dev.tjj.easi.service;

import dev.tjj.easi.config.StorageProperties;
import dev.tjj.easi.dto.DocumentCreateRequest;
import dev.tjj.easi.dto.DocumentResponse;
import dev.tjj.easi.dto.DocumentUpdateRequest;
import dev.tjj.easi.entity.Document;
import dev.tjj.easi.repository.DocumentRepository;
import jakarta.annotation.PostConstruct;
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

    private Path uploadRoot;

    public DocumentService(DocumentRepository documentRepository, StorageProperties storageProperties) {
        this.documentRepository = documentRepository;
        this.storageProperties = storageProperties;
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

        return toResponse(documentRepository.save(document));
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

        return toResponse(documentRepository.save(document));
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
