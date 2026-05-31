package dev.tjj.easi.service;

import dev.tjj.easi.dto.EmployeeRequest;
import dev.tjj.easi.dto.EmployeeResponse;
import dev.tjj.easi.entity.Employee;
import dev.tjj.easi.entity.User;
import dev.tjj.easi.repository.EmployeeRepository;
import dev.tjj.easi.repository.UserRepository;
import java.util.Optional;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** Handles employee record business logic: registration, updates, and retrieval. */
@Service
public class EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final LogService logService;

    public EmployeeService(EmployeeRepository employeeRepository, UserRepository userRepository,
                           LogService logService) {
        this.employeeRepository = employeeRepository;
        this.userRepository = userRepository;
        this.logService = logService;
    }

    /** Creates and persists a new employee record. */
    @Transactional
    public EmployeeResponse register(EmployeeRequest request) {
        Employee employee = new Employee();
        applyRequest(employee, request);
        employee.setAddedOn(LocalDateTime.now());
        Employee saved = employeeRepository.save(employee);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "Employee", String.valueOf(saved.getEmployeeId()), "Registered employee #" + saved.getEmployeeId(), null);
        return toResponse(saved);
    }

    /** Updates an existing employee's information by ID. */
    @Transactional
    public EmployeeResponse update(Integer id, EmployeeRequest request) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found."));
        applyRequest(employee, request);
        Employee saved = employeeRepository.save(employee);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "Employee", String.valueOf(id), "Updated employee #" + id, null);
        return toResponse(saved);
    }

    /** Returns a page of employee records, optionally filtered by position (case-insensitive contains). */
    public Page<EmployeeResponse> getAll(Pageable pageable, String position) {
        return employeeRepository.findFiltered(position, pageable).map(this::toResponse);
    }

    /** Returns a page of employees whose linked user has the given role. */
    public Page<EmployeeResponse> getByRole(String role, Pageable pageable) {
        return employeeRepository.findByUserRole(role, pageable)
                .map(this::toResponse);
    }

    /** Returns a single employee record by ID. */
    public EmployeeResponse getById(Integer id) {
        return employeeRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found."));
    }

    /** Returns the employee record linked to the currently authenticated user. */
    public EmployeeResponse getByCurrentUser(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found."));
        return toResponse(user.getEmployee());
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    private void applyRequest(Employee employee, EmployeeRequest request) {
        employee.setLastName(request.lastName());
        employee.setFirstName(request.firstName());
        employee.setMiddleName(request.middleName());
        employee.setSuffixName(request.suffixName());
        employee.setGender(request.gender());
        employee.setBirthdate(request.birthdate());
        employee.setContactNumber(request.contactNumber());
        employee.setPosition(request.position());
        if (request.status() != null) {
            employee.setStatus(request.status());
        }
    }

    private EmployeeResponse toResponse(Employee e) {
        Optional<User> userOpt = userRepository.findByEmployeeId(e.getEmployeeId());
        return new EmployeeResponse(
                e.getEmployeeId(),
                e.getLastName(),
                e.getFirstName(),
                e.getMiddleName(),
                e.getSuffixName(),
                e.getGender(),
                e.getBirthdate(),
                e.getContactNumber(),
                e.getPosition(),
                e.getStatus(),
                e.getAddedOn(),
                userOpt.isPresent(),
                userOpt.map(User::getUserId).orElse(null),
                userOpt.map(User::getEmail).orElse(null),
                userOpt.map(User::getRole).orElse(null),
                userOpt.map(User::getStatus).orElse(null),
                userOpt.map(User::getAddedOn).orElse(null)
        );
    }
}
