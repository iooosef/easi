package dev.tjj.easi.service;

import dev.tjj.easi.dto.EmployeeDocumentRequest;
import dev.tjj.easi.dto.EmployeeDocumentResponse;
import dev.tjj.easi.entity.*;
import dev.tjj.easi.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Handles employee document link business logic: creation, deletion, and retrieval. */
@Service
public class EmployeeDocumentService {

    private final EmployeeDocumentRepository employeeDocumentRepository ;
    private final EmployeeRepository employeeRepository;
    private final DocumentRepository documentRepository;
    private final LogService logService;

    public EmployeeDocumentService(EmployeeDocumentRepository employeeDocumentRepository,
                                   EmployeeRepository employeeRepository,
                                   DocumentRepository documentRepository,
                                   LogService logService) {
        this.employeeDocumentRepository = employeeDocumentRepository;
        this.employeeRepository = employeeRepository;
        this.documentRepository = documentRepository;
        this.logService = logService;
    }

    /** Links a document to a employee and persists the relationship. */
    @Transactional
    public EmployeeDocumentResponse add(EmployeeDocumentRequest request) {
        Employee employee = employeeRepository.findById(request.employeeId())
                .orElseThrow(() -> new IllegalArgumentException("employee not found."));
        Document document = documentRepository.findById(request.docuId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found."));

        EmployeeDocument ed = new EmployeeDocument();
        ed.setEmployee(employee);
        ed.setDocument(document);

        EmployeeDocument saved = employeeDocumentRepository.save(ed);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "EmployeeDocument",
                String.valueOf(saved.getEmployee().getEmployeeId()),
                "Linked document #" + request.docuId() + " to employee #" + request.employeeId(), null);
        return toResponse(saved);
    }

    /** Removes a employee-document link by its ID. The document file itself is not deleted. */
    @Transactional
    public void delete(Integer empDocId) {
        EmployeeDocument pd = employeeDocumentRepository.findById(empDocId)
                .orElseThrow(() -> new IllegalArgumentException("employee document link not found."));
        employeeDocumentRepository.delete(pd);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "DELETE", "EmployeeDocument",
                String.valueOf(empDocId), "Removed employee document link #" + empDocId, null);
    }

    /** Returns a page of document links filtered by employee id. */
    public Page<EmployeeDocumentResponse> getByemployee(Integer employee_id, Pageable pageable) {
        return employeeDocumentRepository.findByEmployeeEmployeeId(employee_id, pageable).map(this::toResponse);
    }

    /** Returns all employee document links. */
    public Page<EmployeeDocumentResponse> getAll(Pageable pageable) {
        return employeeDocumentRepository.findAll(pageable).map(this::toResponse);
    }

    /** Returns a single employee document link by ID. */
    public EmployeeDocumentResponse getById(Integer empDocId) {
        return employeeDocumentRepository.findById(empDocId)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Employee document link not found."));
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    private EmployeeDocumentResponse toResponse(EmployeeDocument ed) {
        Document d = ed.getDocument();
        return new EmployeeDocumentResponse(
                ed.getEmpDocId(),    // empDocId
                ed.getEmployee().getEmployeeId(),  // employeeId
                d.getDocuId(),       // docuId
                d.getFileName(),
                d.getFileType(),
                d.getDescription(),
                d.getAddedOn()
        );
    }
}
