package dev.tjj.easi.config;

import java.time.LocalDate;
import java.time.LocalDateTime;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import dev.tjj.easi.entity.Employee;
import dev.tjj.easi.entity.Role;
import dev.tjj.easi.entity.User;
import dev.tjj.easi.repository.EmployeeRepository;
import dev.tjj.easi.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/** Seeds the database with a default admin user on first startup. */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final PasswordEncoder passwordEncoder;

    /** Creates the default admin employee and user if they do not yet exist. */
    @Override
    public void run(String... args) {
        createAdminUser();
        createJosephUser();
    }

    private void createAdminUser() {
        if (userRepository.findByEmail("admin@easi.com").isPresent()) {
            log.info("Admin user already exists, skipping initialization.");
            return;
        }

        Employee adminEmployee = new Employee();
        adminEmployee.setLastName("Admin");
        adminEmployee.setFirstName("System");
        adminEmployee.setMiddleName("");
        adminEmployee.setSuffixName("");
        adminEmployee.setGender("N/A");
        adminEmployee.setBirthdate(LocalDate.of(2000, 1, 1));
        adminEmployee.setContactNumber("N/A");
        adminEmployee.setPosition("Admin");
        adminEmployee.setStatus("active");
        adminEmployee.setAddedOn(LocalDateTime.now());
        adminEmployee = employeeRepository.save(adminEmployee);

        User admin = new User();
        admin.setEmail("admin@easi.com");
        admin.setPassword(passwordEncoder.encode("admin123"));
        admin.setRole(Role.ADMIN.name());
        admin.setEmployee(adminEmployee);
        admin.setStatus(1);
        admin.setAddedOn(LocalDateTime.now());
        userRepository.save(admin);

        log.info("Default admin user created: admin@easi.com / admin123");
    }

    private void createJosephUser() {
        if (userRepository.findByEmail("josence22@gmail.com").isPresent()) {
            log.info("Joseph (Admin) user already exists, skipping initialization.");
            return;
        }

        Employee adminEmployee = new Employee();
        adminEmployee.setLastName("Parayaoan");
        adminEmployee.setFirstName("Joseph Clarence");
        adminEmployee.setMiddleName("Cabacungan");
        adminEmployee.setSuffixName("");
        adminEmployee.setGender("Male");
        adminEmployee.setBirthdate(LocalDate.of(2001, 7, 22));
        adminEmployee.setContactNumber("N/A");
        adminEmployee.setPosition("Admin");
        adminEmployee.setStatus("active");
        adminEmployee.setAddedOn(LocalDateTime.now());
        adminEmployee = employeeRepository.save(adminEmployee);

        User admin = new User();
        admin.setEmail("josence22@gmail.com");
        admin.setPassword(passwordEncoder.encode("1488"));
        admin.setRole(Role.ADMIN.name());
        admin.setEmployee(adminEmployee);
        admin.setStatus(1);
        admin.setAddedOn(LocalDateTime.now());
        userRepository.save(admin);

        log.info("Default admin user created: josence22@gmail.com / 1488");
    }

}
