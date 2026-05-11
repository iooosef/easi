package dev.tjj.easi.service;

import dev.tjj.easi.dto.EmployeeRequest;
import dev.tjj.easi.dto.EmployeeResponse;
import dev.tjj.easi.entity.Employee;
import dev.tjj.easi.entity.User;
import dev.tjj.easi.repository.EmployeeRepository;
import dev.tjj.easi.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** Handles employee record business logic: registration, updates, and retrieval. */
@Service
public class EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;

    public EmployeeService(EmployeeRepository employeeRepository, UserRepository userRepository) {
        this.employeeRepository = employeeRepository;
        this.userRepository = userRepository;
    }

    /** Creates and persists a new employee record. */
    @Transactional
    public EmployeeResponse register(EmployeeRequest request) {
        Employee employee = new Employee();
        applyRequest(employee, request);
        employee.setAddedOn(LocalDateTime.now());
        return toResponse(employeeRepository.save(employee));
    }

    /** Updates an existing employee's information by ID. */
    @Transactional
    public EmployeeResponse update(Integer id, EmployeeRequest request) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found."));
        applyRequest(employee, request);
        return toResponse(employeeRepository.save(employee));
    }

    /** Returns all employee records. */
    public List<EmployeeResponse> getAll() {
        return employeeRepository.findAll().stream().map(this::toResponse).toList();
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
                e.getAddedOn()
        );
    }
}
