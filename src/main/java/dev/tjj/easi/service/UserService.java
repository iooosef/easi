package dev.tjj.easi.service;

import dev.tjj.easi.dto.RegisterUserRequest;
import dev.tjj.easi.dto.RegisterUserResponse;
import dev.tjj.easi.dto.UpdateUserRequest;
import dev.tjj.easi.entity.Employee;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import dev.tjj.easi.entity.Role;
import dev.tjj.easi.entity.User;
import dev.tjj.easi.repository.EmployeeRepository;
import dev.tjj.easi.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;

/** Handles user account operations such as registration and password management. */
@Service
public class UserService {

    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final PasswordEncoder passwordEncoder;
    private final LogService logService;

    public UserService(UserRepository userRepository,
                       EmployeeRepository employeeRepository,
                       PasswordEncoder passwordEncoder,
                       LogService logService) {
        this.userRepository = userRepository;
        this.employeeRepository = employeeRepository;
        this.passwordEncoder = passwordEncoder;
        this.logService = logService;
    }

    /**
     * Resets a target user's password directly without OTP.
     * ADMIN can reset any user; HR cannot reset accounts with the ADMIN role.
     */
    @Transactional
    public void adminResetPassword(Integer targetUserId, String newPassword, UserDetails currentUser) {
        String callerRole = currentUser.getAuthorities().stream()
                .findFirst()
                .map(a -> a.getAuthority().replace("ROLE_", ""))
                .orElseThrow(() -> new IllegalArgumentException("Access denied."));

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found."));

        if ("HR".equals(callerRole) && "ADMIN".equals(target.getRole())) {
            throw new IllegalArgumentException("HR cannot reset an admin's password.");
        }

        target.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(target);
        logService.logByEmail(currentUser.getUsername(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "User", String.valueOf(targetUserId), "Admin reset password for user #" + targetUserId, null);
    }

    /**
     * Registers a new user account linked to an existing employee.
     * ADMIN can assign any role; HR cannot register accounts with the ADMIN role.
     */
    @Transactional
    public RegisterUserResponse registerUser(RegisterUserRequest request, UserDetails currentUser) {
        String callerRole = currentUser.getAuthorities().stream()
                .findFirst()
                .map(a -> a.getAuthority().replace("ROLE_", ""))
                .orElseThrow(() -> new IllegalArgumentException("Access denied."));

        Role role;
        try {
            role = Role.valueOf(request.role().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid role: " + request.role());
        }

        if ("HR".equals(callerRole) && role == Role.ADMIN) {
            throw new IllegalArgumentException("HR cannot register an admin account.");
        }

        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new IllegalArgumentException("Email is already in use.");
        }

        Employee employee = employeeRepository.findById(request.employeeId())
                .orElseThrow(() -> new IllegalArgumentException("Employee not found."));

        User user = new User();
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(role.name());
        user.setEmployee(employee);
        user.setAddedOn(LocalDateTime.now());

        User saved = userRepository.save(user);
        logService.logByEmail(currentUser.getUsername(), LogType.AUDIT, LogSeverity.INFO, "CREATE", "User", String.valueOf(saved.getUserId()), "Registered user #" + saved.getUserId() + " with role " + role.name(), null);

        return new RegisterUserResponse(
                saved.getUserId(),
                saved.getEmail(),
                saved.getRole(),
                employee.getEmployeeId(),
                saved.getAddedOn()
        );
    }

    /**
     * Updates a user account's email, role, and status.
     * ADMIN can modify any account; HR cannot modify ADMIN accounts or assign the ADMIN role.
     */
    @Transactional
    public RegisterUserResponse updateUser(Integer userId, UpdateUserRequest request, UserDetails currentUser) {
        String callerRole = currentUser.getAuthorities().stream()
                .findFirst()
                .map(a -> a.getAuthority().replace("ROLE_", ""))
                .orElseThrow(() -> new IllegalArgumentException("Access denied."));

        Role newRole;
        try {
            newRole = Role.valueOf(request.role().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid role: " + request.role());
        }

        User target = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found."));

        if ("HR".equals(callerRole) && "ADMIN".equals(target.getRole())) {
            throw new IllegalArgumentException("HR cannot modify an admin account.");
        }
        if ("HR".equals(callerRole) && newRole == Role.ADMIN) {
            throw new IllegalArgumentException("HR cannot assign the ADMIN role.");
        }

        if (!target.getEmail().equalsIgnoreCase(request.email()) &&
                userRepository.findByEmail(request.email()).isPresent()) {
            throw new IllegalArgumentException("Email is already in use.");
        }

        target.setEmail(request.email());
        target.setRole(newRole.name());
        target.setStatus(request.status());
        if (request.password() != null && !request.password().isBlank()) {
            target.setPassword(passwordEncoder.encode(request.password()));
        }
        User saved = userRepository.save(target);
        logService.logByEmail(currentUser.getUsername(), LogType.AUDIT, LogSeverity.INFO, "UPDATE", "User",
                String.valueOf(userId), "Updated user #" + userId, null);

        return new RegisterUserResponse(
                saved.getUserId(),
                saved.getEmail(),
                saved.getRole(),
                saved.getEmployee().getEmployeeId(),
                saved.getAddedOn()
        );
    }

}
