package dev.tjj.easi.service;

import dev.tjj.easi.dto.ServiceReportRequest;
import dev.tjj.easi.dto.ServiceReportResponse;
import dev.tjj.easi.entity.*;
import dev.tjj.easi.repository.*;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** Handles service report business logic: creation, updates, and retrieval. */
@Service
public class ServiceReportService {

    private final ServiceReportRepository serviceReportRepository;
    private final ProjectRepository projectRepository;
    private final EmployeeRepository employeeRepository;
    private final ServiceScheduleRepository serviceScheduleRepository;
    private final DocumentRepository documentRepository;
    private final LogService logService;

    public ServiceReportService(ServiceReportRepository serviceReportRepository,
                                ProjectRepository projectRepository,
                                EmployeeRepository employeeRepository,
                                ServiceScheduleRepository serviceScheduleRepository,
                                DocumentRepository documentRepository,
                                LogService logService) {
        this.serviceReportRepository = serviceReportRepository;
        this.projectRepository = projectRepository;
        this.employeeRepository = employeeRepository;
        this.serviceScheduleRepository = serviceScheduleRepository;
        this.documentRepository = documentRepository;
        this.logService = logService;
    }

    /** Creates and persists a new service report record. */
    @Transactional
    public ServiceReportResponse add(ServiceReportRequest request) {
        ServiceReport report = new ServiceReport();
        applyRequest(report, request);
        report.setAddedOn(LocalDateTime.now());
        ServiceReport saved = serviceReportRepository.save(report);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "ServiceReport", String.valueOf(saved.getSrNumber()), "Created service report #" + saved.getSrNumber(), null);
        return toResponse(saved);
    }

    /** Updates an existing service report record by ID. */
    @Transactional
    public ServiceReportResponse update(Integer srNumber, ServiceReportRequest request) {
        ServiceReport report = serviceReportRepository.findById(srNumber)
                .orElseThrow(() -> new IllegalArgumentException("Service report not found."));
        applyRequest(report, request);
        ServiceReport saved = serviceReportRepository.save(report);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "ServiceReport", String.valueOf(srNumber), "Updated service report #" + srNumber, null);
        return toResponse(saved);
    }

    /** Returns a page of service report records. */
    public Page<ServiceReportResponse> getAll(Pageable pageable) {
        return serviceReportRepository.findAll(pageable).map(this::toResponse);
    }

    /** Returns a single service report record by ID. */
    public ServiceReportResponse getById(Integer srNumber) {
        return serviceReportRepository.findById(srNumber)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Service report not found."));
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /** Applies request fields onto the service report entity. */
    private void applyRequest(ServiceReport report, ServiceReportRequest request) {
        Project project = projectRepository.findById(request.projNum())
                .orElseThrow(() -> new IllegalArgumentException("Project not found."));
        ServiceSchedule schedule = serviceScheduleRepository.findById(request.schedId())
                .orElseThrow(() -> new IllegalArgumentException("Service schedule not found."));

        report.setProject(project);
        report.setComplaint(request.complaint());
        report.setWorkDone(request.workDone());
        report.setLocation(request.location());
        report.setServiceSchedule(schedule);
        report.setReceiptReceiveDate(request.receiptReceiveDate());

        if (request.engineerEmployeeId() != null) {
            Employee engineer = employeeRepository.findById(request.engineerEmployeeId())
                    .orElseThrow(() -> new IllegalArgumentException("Engineer employee not found."));
            report.setEngineerEmployee(engineer);
        } else {
            report.setEngineerEmployee(null);
        }

        if (request.docuId() != null) {
            Document document = documentRepository.findById(request.docuId())
                    .orElseThrow(() -> new IllegalArgumentException("Document not found."));
            report.setDocument(document);
        } else {
            report.setDocument(null);
        }

        if (request.paymentMethod() != null && !request.paymentMethod().isBlank()) {
            report.setPaymentMethod(request.paymentMethod());
        }

        if (request.status() != null && !request.status().isBlank()) {
            report.setStatus(request.status());
        }
    }

    private ServiceReportResponse toResponse(ServiceReport r) {
        return new ServiceReportResponse(
                r.getSrNumber(),
                r.getProject().getProjNum(),
                r.getProject().getName(),
                r.getComplaint(),
                r.getWorkDone(),
                r.getEngineerEmployee() != null ? r.getEngineerEmployee().getEmployeeId() : null,
                r.getLocation(),
                r.getServiceSchedule().getSchedId(),
                r.getServiceSchedule().getDate(),
                r.getPaymentMethod(),
                r.getReceiptReceiveDate(),
                r.getDocument() != null ? r.getDocument().getDocuId() : null,
                r.getStatus(),
                r.getAddedOn()
        );
    }
}
