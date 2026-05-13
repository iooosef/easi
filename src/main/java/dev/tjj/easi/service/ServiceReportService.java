package dev.tjj.easi.service;

import dev.tjj.easi.dto.ServiceReportRequest;
import dev.tjj.easi.dto.ServiceReportResponse;
import dev.tjj.easi.entity.*;
import dev.tjj.easi.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** Handles service report business logic: creation, updates, and retrieval. */
@Service
public class ServiceReportService {

    private final ServiceReportRepository serviceReportRepository;
    private final ProjectRepository projectRepository;
    private final EmployeeRepository employeeRepository;
    private final ServiceScheduleRepository serviceScheduleRepository;
    private final DocumentRepository documentRepository;

    public ServiceReportService(ServiceReportRepository serviceReportRepository,
                                ProjectRepository projectRepository,
                                EmployeeRepository employeeRepository,
                                ServiceScheduleRepository serviceScheduleRepository,
                                DocumentRepository documentRepository) {
        this.serviceReportRepository = serviceReportRepository;
        this.projectRepository = projectRepository;
        this.employeeRepository = employeeRepository;
        this.serviceScheduleRepository = serviceScheduleRepository;
        this.documentRepository = documentRepository;
    }

    /** Creates and persists a new service report record. */
    @Transactional
    public ServiceReportResponse add(ServiceReportRequest request) {
        ServiceReport report = new ServiceReport();
        applyRequest(report, request);
        report.setAddedOn(LocalDateTime.now());
        return toResponse(serviceReportRepository.save(report));
    }

    /** Updates an existing service report record by ID. */
    @Transactional
    public ServiceReportResponse update(Integer srNumber, ServiceReportRequest request) {
        ServiceReport report = serviceReportRepository.findById(srNumber)
                .orElseThrow(() -> new IllegalArgumentException("Service report not found."));
        applyRequest(report, request);
        return toResponse(serviceReportRepository.save(report));
    }

    /** Returns all service report records. */
    public List<ServiceReportResponse> getAll() {
        return serviceReportRepository.findAll().stream().map(this::toResponse).toList();
    }

    /** Returns a single service report record by ID. */
    public ServiceReportResponse getById(Integer srNumber) {
        return serviceReportRepository.findById(srNumber)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Service report not found."));
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
                r.getComplaint(),
                r.getWorkDone(),
                r.getEngineerEmployee() != null ? r.getEngineerEmployee().getEmployeeId() : null,
                r.getLocation(),
                r.getServiceSchedule().getSchedId(),
                r.getPaymentMethod(),
                r.getReceiptReceiveDate(),
                r.getDocument() != null ? r.getDocument().getDocuId() : null,
                r.getStatus(),
                r.getAddedOn()
        );
    }
}
