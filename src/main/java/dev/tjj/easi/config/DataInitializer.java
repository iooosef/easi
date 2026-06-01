package dev.tjj.easi.config;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import dev.tjj.easi.entity.AirConditioningUnit;
import dev.tjj.easi.entity.Vehicle;
import dev.tjj.easi.entity.VehicleGasLog;
import dev.tjj.easi.entity.VehicleLog;
import dev.tjj.easi.entity.Employee;
import dev.tjj.easi.entity.Project;
import dev.tjj.easi.entity.Role;
import dev.tjj.easi.entity.ServiceAssignment;
import dev.tjj.easi.entity.ServiceReport;
import dev.tjj.easi.entity.ServiceReportFinding;
import dev.tjj.easi.entity.ServiceSchedule;
import dev.tjj.easi.entity.User;
import dev.tjj.easi.repository.AirConditioningUnitRepository;
import dev.tjj.easi.repository.VehicleRepository;
import dev.tjj.easi.repository.VehicleGasLogRepository;
import dev.tjj.easi.entity.Part;
import dev.tjj.easi.entity.PartUsage;
import dev.tjj.easi.entity.PurchaseOrder;
import dev.tjj.easi.entity.PurchaseOrderDeliveryContact;
import dev.tjj.easi.entity.PaymentLog;
import dev.tjj.easi.entity.ServiceReportBillingItem;
import dev.tjj.easi.entity.Supplier;
import dev.tjj.easi.repository.PartRepository;
import dev.tjj.easi.repository.PartUsageRepository;
import dev.tjj.easi.repository.PaymentLogRepository;
import dev.tjj.easi.repository.PurchaseOrderDeliveryContactRepository;
import dev.tjj.easi.repository.PurchaseOrderRepository;
import dev.tjj.easi.repository.ServiceReportBillingItemRepository;
import dev.tjj.easi.repository.SupplierRepository;
import dev.tjj.easi.repository.VehicleLogRepository;
import dev.tjj.easi.repository.EmployeeRepository;
import dev.tjj.easi.repository.ProjectRepository;
import dev.tjj.easi.repository.ServiceAssignmentRepository;
import dev.tjj.easi.repository.ServiceReportFindingRepository;
import dev.tjj.easi.repository.ServiceReportRepository;
import dev.tjj.easi.repository.ServiceScheduleRepository;
import dev.tjj.easi.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/** Seeds the database with a default admin user and sample project data on first startup. */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final PasswordEncoder passwordEncoder;
    private final ProjectRepository projectRepository;
    private final ServiceScheduleRepository serviceScheduleRepository;
    private final ServiceReportRepository serviceReportRepository;
    private final AirConditioningUnitRepository acUnitRepository;
    private final ServiceReportFindingRepository findingRepository;
    private final ServiceAssignmentRepository serviceAssignmentRepository;
    private final VehicleRepository vehicleRepository;
    private final VehicleLogRepository vehicleLogRepository;
    private final VehicleGasLogRepository vehicleGasLogRepository;
    private final SupplierRepository supplierRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final PartRepository partRepository;
    private final PartUsageRepository partUsageRepository;
    private final PurchaseOrderDeliveryContactRepository poDeliveryContactRepository;
    private final ServiceReportBillingItemRepository billingItemRepository;
    private final PaymentLogRepository paymentLogRepository;

    /** Creates the default admin employee and user if they do not yet exist. */
    @Override
    public void run(String... args) {
        createAdminUser();
        createJosephUser();
        seedRoleAccounts();
        seedCrewmateAccounts();
        seedProjectData();
        seedServiceAssignments();
        seedVehicles();
        seedSuppliers();
        seedPurchaseOrders();
        seedBillingItems();
        seedPaymentLogs();
        seedPartUsages();
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

    /** Seeds one employee+user per remaining role, plus one userless CREW employee. */
    private void seedRoleAccounts() {
        record RoleSeed(String firstName, String lastName, String position, String role) {}

        RoleSeed[] seeds = {
            new RoleSeed("Accounting",  "User",    "Accountant",      "ACCOUNTING"),
            new RoleSeed("HR",          "User",    "HR Officer",      "HR"),
            new RoleSeed("Staff",       "User",    "Field Staff",     "STAFF"),
            new RoleSeed("Crew",        "User",    "Field Crew",      "CREW"),
        };

        for (RoleSeed seed : seeds) {
            String email = "josene22+easi_" + seed.role().toLowerCase() + "@gmail.com";
            if (userRepository.findByEmail(email).isPresent()) {
                log.info("Seed user {} already exists, skipping.", email);
                continue;
            }

            Employee emp = new Employee();
            emp.setFirstName(seed.firstName());
            emp.setLastName(seed.lastName());
            emp.setMiddleName("");
            emp.setSuffixName("");
            emp.setGender("N/A");
            emp.setBirthdate(LocalDate.of(2000, 1, 1));
            emp.setContactNumber("N/A");
            emp.setPosition(seed.position());
            emp.setStatus("active");
            emp.setAddedOn(LocalDateTime.now());
            emp = employeeRepository.save(emp);

            User user = new User();
            user.setEmail(email);
            user.setPassword(passwordEncoder.encode("148888"));
            user.setRole(seed.role());
            user.setEmployee(emp);
            user.setStatus(1);
            user.setAddedOn(LocalDateTime.now());
            userRepository.save(user);

            log.info("Seed user created: {} / 148888 ({})", email, seed.role());
        }

        // One CREW employee with no user account
        String markerName = "Unregistered";
        boolean exists = employeeRepository.findAll().stream()
                .anyMatch(e -> markerName.equals(e.getFirstName()) && "Crew".equals(e.getPosition()));
        if (!exists) {
            Employee emp = new Employee();
            emp.setFirstName("Unregistered");
            emp.setLastName("Crew");
            emp.setMiddleName("");
            emp.setSuffixName("");
            emp.setGender("N/A");
            emp.setBirthdate(LocalDate.of(2000, 1, 1));
            emp.setContactNumber("N/A");
            emp.setPosition("Crew");
            emp.setStatus("active");
            emp.setAddedOn(LocalDateTime.now());
            employeeRepository.save(emp);
            log.info("Seed employee (no user) created: Unregistered Crew");
        }
    }

    /** Seeds five crew employees with user accounts (surname Crewmate) if none exist. */
    private void seedCrewmateAccounts() {
        boolean exists = employeeRepository.findAll().stream()
                .anyMatch(e -> "Crewmate".equals(e.getLastName()));
        if (exists) {
            log.info("Crewmate employees already exist, skipping.");
            return;
        }

        String[] firstNames = { "Alpha", "Bravo", "Charlie", "Delta", "Echo" };
        for (int i = 0; i < firstNames.length; i++) {
            int n = i + 1;
            Employee emp = new Employee();
            emp.setFirstName(firstNames[i]);
            emp.setLastName("Crewmate");
            emp.setMiddleName("");
            emp.setSuffixName("");
            emp.setGender("N/A");
            emp.setBirthdate(LocalDate.of(2000, 1, 1));
            emp.setContactNumber("N/A");
            emp.setPosition("Field Crew");
            emp.setStatus("active");
            emp.setAddedOn(LocalDateTime.now());
            emp = employeeRepository.save(emp);

            String email = "watashiwajosephdesu+crew" + n + "@gmail.com";
            User user = new User();
            user.setEmail(email);
            user.setPassword(passwordEncoder.encode("148888"));
            user.setRole(Role.CREW.name());
            user.setEmployee(emp);
            user.setStatus(1);
            user.setAddedOn(LocalDateTime.now());
            userRepository.save(user);

            log.info("Crewmate seed user created: {} / 148888 (CREW)", email);
        }
    }

    /** Seeds sample projects, service schedules, and service reports if none exist. */
    private void seedProjectData() {
        if (projectRepository.count() > 0) {
            log.info("Project data already exists, skipping project/schedule/report seed.");
            seedAcUnits();
            seedFindings();
            return;
        }

        // --- Projects ---
        Project p1 = new Project();
        p1.setName("ABC Corporation HVAC");
        p1.setAddress("123 Ayala Avenue, Makati City, Metro Manila");
        p1.setType("ESTABLISHMENT");
        p1.setContactName("Maria Santos");
        p1.setContactNumber("+639171234567");
        p1.setContactEmail("maria.santos@abccorp.com");
        p1.setInstallationProgress(100);
        p1.setWarrantyStatus(1);
        p1.setWarrantyDate(LocalDate.of(2027, 3, 15));
        p1.setStatus("active");
        p1.setAddedOn(LocalDateTime.of(2025, 11, 10, 9, 0));
        p1 = projectRepository.save(p1);

        Project p2 = new Project();
        p2.setName("Santos Residence");
        p2.setAddress("45 Sampaguita St., Quezon City, Metro Manila");
        p2.setType("HOUSEHOLD");
        p2.setContactName("Roberto Santos");
        p2.setContactNumber("+639281234567");
        p2.setContactEmail("roberto@santos.ph");
        p2.setInstallationProgress(100);
        p2.setWarrantyStatus(1);
        p2.setWarrantyDate(LocalDate.of(2027, 1, 20));
        p2.setStatus("active");
        p2.setAddedOn(LocalDateTime.of(2025, 12, 5, 10, 30));
        p2 = projectRepository.save(p2);

        Project p3 = new Project();
        p3.setName("Greenfield Mall Unit B");
        p3.setAddress("Greenfield District, Mandaluyong City, Metro Manila");
        p3.setType("ESTABLISHMENT");
        p3.setContactName("Liza Reyes");
        p3.setContactNumber("+639391234567");
        p3.setContactEmail("liza.reyes@greenfield.com.ph");
        p3.setInstallationProgress(100);
        p3.setWarrantyStatus(1);
        p3.setWarrantyDate(LocalDate.of(2026, 12, 1));
        p3.setStatus("completed");
        p3.setAddedOn(LocalDateTime.of(2025, 10, 20, 8, 0));
        p3 = projectRepository.save(p3);

        // --- Past service schedules (Jan–Apr 2026) for each project ---
        // Project 1 schedules
        ServiceSchedule ss1 = sched(p1, "Preventive Maintenance", LocalDate.of(2026, 1, 8), "completed");
        ServiceSchedule ss2 = sched(p1, "Repair",                 LocalDate.of(2026, 1, 22), "completed");
        ServiceSchedule ss3 = sched(p1, "Inspection",             LocalDate.of(2026, 2, 12), "completed");
        ServiceSchedule ss4 = sched(p1, "Preventive Maintenance", LocalDate.of(2026, 3, 5),  "completed");
        ServiceSchedule ss5 = sched(p1, "Cleaning",               LocalDate.of(2026, 4, 10), "completed");

        // Project 2 schedules
        ServiceSchedule ss6  = sched(p2, "Repair",                 LocalDate.of(2026, 1, 14), "completed");
        ServiceSchedule ss7  = sched(p2, "Preventive Maintenance", LocalDate.of(2026, 2, 5),  "completed");
        ServiceSchedule ss8  = sched(p2, "Cleaning",               LocalDate.of(2026, 2, 25), "completed");
        ServiceSchedule ss9  = sched(p2, "Inspection",             LocalDate.of(2026, 3, 18), "completed");
        ServiceSchedule ss10 = sched(p2, "Repair",                 LocalDate.of(2026, 4, 22), "completed");

        // Project 3 schedules
        ServiceSchedule ss11 = sched(p3, "Preventive Maintenance", LocalDate.of(2026, 1, 7),  "completed");
        ServiceSchedule ss12 = sched(p3, "Inspection",             LocalDate.of(2026, 1, 28), "completed");
        ServiceSchedule ss13 = sched(p3, "Cleaning",               LocalDate.of(2026, 2, 18), "completed");
        ServiceSchedule ss14 = sched(p3, "Repair",                 LocalDate.of(2026, 3, 11), "completed");
        ServiceSchedule ss15 = sched(p3, "Preventive Maintenance", LocalDate.of(2026, 3, 31), "completed");
        ServiceSchedule ss16 = sched(p3, "Inspection",             LocalDate.of(2026, 4, 15), "completed");

        // --- 2 upcoming schedules (Jul–Aug 2026) ---
        ServiceSchedule upcoming1 = sched(p1, "Preventive Maintenance", LocalDate.of(2026, 7, 9),  "pending");
        ServiceSchedule upcoming2 = sched(p2, "Preventive Maintenance", LocalDate.of(2026, 8, 6),  "pending");

        // --- Service reports (Jan–Apr 2026) ---
        // Project 1 — 5 reports
        report(ss1,  "Unit not cooling properly in 3rd floor east wing",  "Replaced capacitor and recharged refrigerant",                          "3rd Floor East Wing, ABC Corp",       LocalDateTime.of(2026, 1, 8, 14, 0));
        report(ss2,  "Noisy compressor on rooftop unit A",                "Tightened mounting bolts and lubricated moving parts",                  "Rooftop, ABC Corp",                   LocalDateTime.of(2026, 1, 22, 15, 0));
        report(ss3,  "Water dripping from ceiling cassette unit",         "Cleared blocked drain line and cleaned air filter",                     "2nd Floor Lobby, ABC Corp",           LocalDateTime.of(2026, 2, 12, 11, 0));
        report(ss4,  "Routine preventive maintenance check",              "Full system inspection, coil cleaning, filter replacement",             "All Floors, ABC Corp",                LocalDateTime.of(2026, 3, 5, 9, 0));
        report(ss5,  "Thermostat reading inaccurate",                     "Recalibrated thermostat sensor and tested operation",                   "1st Floor Office, ABC Corp",          LocalDateTime.of(2026, 4, 10, 10, 0));

        // Project 2 — 5 reports
        report(ss6,  "Split unit not turning on after power outage",      "Reset circuit breaker and replaced blown fuse on PCB",                  "Master Bedroom, Santos Residence",    LocalDateTime.of(2026, 1, 14, 13, 0));
        report(ss7,  "Foul smell from indoor unit",                       "Deep cleaned evaporator coil and applied anti-fungal treatment",         "Living Room, Santos Residence",       LocalDateTime.of(2026, 2, 5, 10, 0));
        report(ss8,  "Unit leaking water indoors",                        "Fixed clogged condensate drain and re-sealed drain pan",                 "2nd Floor Hallway, Santos Residence", LocalDateTime.of(2026, 2, 25, 14, 0));
        report(ss9,  "Compressor overheating and shutting off",           "Cleaned condenser coil and topped up refrigerant to spec",               "Outdoor Unit, Santos Residence",      LocalDateTime.of(2026, 3, 18, 9, 30));
        report(ss10, "Remote control not working and unit unresponsive",  "Replaced faulty receiver module and tested remote pairing",              "Guest Room, Santos Residence",        LocalDateTime.of(2026, 4, 22, 11, 0));

        // Project 3 — 6 reports
        report(ss11, "Multiple units tripping breaker simultaneously",    "Identified overloaded circuit; redistributed unit loads across panels",  "Main Electrical Room, Greenfield B",  LocalDateTime.of(2026, 1, 7, 9, 0));
        report(ss12, "Evaporator coil frozen on unit B2",                 "Defrosted coil, replaced air filter, checked refrigerant level",         "Unit B2 Server Room, Greenfield B",   LocalDateTime.of(2026, 1, 28, 15, 0));
        report(ss13, "Loud rattling noise from ductwork",                 "Secured loose duct sections with sheet metal screws and tape",           "Ceiling Duct, Wing C, Greenfield B",  LocalDateTime.of(2026, 2, 18, 10, 0));
        report(ss14, "Central AHU fan motor failure",                     "Replaced fan motor and capacitor; tested rotation and airflow",          "AHU Room, Basement, Greenfield B",    LocalDateTime.of(2026, 3, 11, 8, 0));
        report(ss15, "Routine preventive maintenance — all units",        "Full cleaning, belt inspection, coil washing, and refrigerant check",    "All Areas, Greenfield B",             LocalDateTime.of(2026, 3, 31, 9, 0));
        report(ss16, "Post-maintenance follow-up inspection",             "Verified all units operating within spec after March PM",                "All Areas, Greenfield B",             LocalDateTime.of(2026, 4, 15, 13, 0));

        seedAcUnitsForProjects(p1, p2, p3);
        seedFindings();

        log.info("Sample project data seeded: 3 projects, 18 service schedules, 16 service reports, 11 AC units, 12 findings.");
    }

    /** Creates and saves a ServiceSchedule. */
    private ServiceSchedule sched(Project project, String purpose, LocalDate date, String status) {
        ServiceSchedule s = new ServiceSchedule();
        s.setProject(project);
        s.setPurpose(purpose);
        s.setDate(date);
        s.setStatus(status);
        s.setAddedOn(date.minusDays(3).atTime(8, 0));
        return serviceScheduleRepository.save(s);
    }

    /**
     * Seeds AC units when projects already exist (e.g. app restarted after initial seed).
     * Looks up the first three projects by insertion order and seeds units for each.
     */
    private void seedAcUnits() {
        if (acUnitRepository.count() > 0) {
            log.info("AC unit data already exists, skipping AC seed.");
            return;
        }
        var projects = projectRepository.findAll(
                org.springframework.data.domain.PageRequest.of(0, 3,
                        org.springframework.data.domain.Sort.by("projNum").ascending()))
                .getContent();
        if (projects.size() < 3) {
            log.warn("Not enough projects found to seed AC units, skipping.");
            return;
        }
        seedAcUnitsForProjects(projects.get(0), projects.get(1), projects.get(2));
        log.info("AC unit seed completed: 11 units added.");
    }

    /** Seeds the 11 AC units across three projects. */
    private void seedAcUnitsForProjects(Project p1, Project p2, Project p3) {
        // Project 1 — ABC Corporation HVAC (establishment, 4 units)
        acUnit(p1, "Daikin",      "VRV IV S",         "SN-DAI-2025-001", "active",            LocalDateTime.of(2025, 11, 10, 9, 30));
        acUnit(p1, "Daikin",      "VRV IV S",         "SN-DAI-2025-002", "active",            LocalDateTime.of(2025, 11, 10, 9, 30));
        acUnit(p1, "Carrier",     "42XQ018",          "SN-CAR-2025-003", "active",            LocalDateTime.of(2025, 11, 10, 10, 0));
        acUnit(p1, "Carrier",     "42XQ018",          "SN-CAR-2025-004", "maintenance", LocalDateTime.of(2025, 11, 10, 10, 0));

        // Project 2 — Santos Residence (household, 3 units)
        acUnit(p2, "LG",          "S12EQ",            "SN-LG-2025-101",  "active",            LocalDateTime.of(2025, 12, 5, 11, 0));
        acUnit(p2, "LG",          "S09EQ",            "SN-LG-2025-102",  "active",            LocalDateTime.of(2025, 12, 5, 11, 0));
        acUnit(p2, "Panasonic",   "CS-S13SKUA",       "SN-PAN-2025-103", "inactive",          LocalDateTime.of(2025, 12, 5, 11, 30));

        // Project 3 — Greenfield Mall Unit B (establishment, 4 units)
        acUnit(p3, "Mitsubishi",  "PEFY-P200VMH-E",   "SN-MIT-2025-201", "active",            LocalDateTime.of(2025, 10, 20, 8, 30));
        acUnit(p3, "Mitsubishi",  "PEFY-P200VMH-E",   "SN-MIT-2025-202", "active",            LocalDateTime.of(2025, 10, 20, 8, 30));
        acUnit(p3, "Fujitsu",     "ART24LUAS",        "SN-FUJ-2025-203", "inactive",          LocalDateTime.of(2025, 10, 20, 9, 0));
        acUnit(p3, "Toshiba",     "RAV-SM1104AT-E",   "SN-TOS-2025-204", "active",            LocalDateTime.of(2025, 10, 20, 9, 0));
    }

    /** Creates and saves an AirConditioningUnit. */
    private void acUnit(Project project, String brand, String model, String serialNum,
                        String status, LocalDateTime addedOn) {
        AirConditioningUnit u = new AirConditioningUnit();
        u.setProject(project);
        u.setBrand(brand);
        u.setModel(model);
        u.setSerialNum(serialNum);
        u.setStatus(status);
        u.setAddedOn(addedOn);
        acUnitRepository.save(u);
    }

    /** Creates and saves a ServiceReport. Status is computed dynamically from payment logs. */
    private ServiceReport report(ServiceSchedule schedule, String complaint,
                                 String workDone, String location, LocalDateTime addedOn) {
        ServiceReport r = new ServiceReport();
        r.setServiceSchedule(schedule);
        r.setComplaint(complaint);
        r.setWorkDone(workDone);
        r.setLocation(location);
        r.setDocument(null);
        r.setAddedOn(addedOn);
        return serviceReportRepository.save(r);
    }

    /** Seeds sample findings across service reports if none exist. */
    private void seedFindings() {
        if (findingRepository.count() > 0) {
            log.info("Finding data already exists, skipping findings seed.");
            return;
        }
        var pageReq = org.springframework.data.domain.PageRequest.of(0, 3,
                org.springframework.data.domain.Sort.by("projNum").ascending());
        var projects = projectRepository.findAll(pageReq).getContent();
        if (projects.size() < 3) {
            log.warn("Not enough projects to seed findings, skipping.");
            return;
        }
        var srPage = org.springframework.data.domain.PageRequest.of(0, 3,
                org.springframework.data.domain.Sort.by("srNumber").ascending());
        var acPage = org.springframework.data.domain.PageRequest.of(0, 10,
                org.springframework.data.domain.Sort.by("acNum").ascending());

        var p1Reports = serviceReportRepository.findByServiceSchedule_Project_ProjNum(projects.get(0).getProjNum(), srPage).getContent();
        var p2Reports = serviceReportRepository.findByServiceSchedule_Project_ProjNum(projects.get(1).getProjNum(), srPage).getContent();
        var p3Reports = serviceReportRepository.findByServiceSchedule_Project_ProjNum(projects.get(2).getProjNum(), srPage).getContent();

        var p1Ac = acUnitRepository.findByProjectProjNum(projects.get(0).getProjNum(), acPage).getContent();
        var p2Ac = acUnitRepository.findByProjectProjNum(projects.get(1).getProjNum(), acPage).getContent();
        var p3Ac = acUnitRepository.findByProjectProjNum(projects.get(2).getProjNum(), acPage).getContent();

        // Project 1 findings
        if (!p1Reports.isEmpty() && p1Ac.size() >= 2) {
            finding(p1Reports.get(0), "DEFECT", "Capacitor 35/5 MFD", p1Ac.get(0),
                    "Capacitor found bulging; refrigerant pressure below spec. Replaced capacitor and recharged system.");
            finding(p1Reports.get(0), "GOOD",   null,                  p1Ac.get(1),
                    "Unit operating within normal parameters. No issues found.");
        }
        if (p1Reports.size() >= 2 && p1Ac.size() >= 4) {
            finding(p1Reports.get(1), "WORN",   "Compressor Mount",    p1Ac.get(2),
                    "Mounting bolts loose; rubber isolators worn. Tightened bolts and lubricated moving parts.");
            finding(p1Reports.get(1), "GOOD",   null,                  p1Ac.get(3),
                    "No abnormalities detected during inspection.");
        }
        if (p1Reports.size() >= 3 && !p1Ac.isEmpty()) {
            finding(p1Reports.get(2), "DIRTY",  "Air Filter",          p1Ac.get(0),
                    "Drain line blocked by algae buildup; air filter heavily clogged. Cleared drain and cleaned filter.");
        }

        // Project 2 findings
        if (!p2Reports.isEmpty() && !p2Ac.isEmpty()) {
            finding(p2Reports.get(0), "DEFECT", "PCB Fuse 15A",        p2Ac.get(0),
                    "Blown fuse on PCB after power surge. Circuit breaker tripped. Replaced fuse and reset breaker.");
        }
        if (p2Reports.size() >= 2 && p2Ac.size() >= 2) {
            finding(p2Reports.get(1), "DIRTY",  "Evaporator Coil",     p2Ac.get(1),
                    "Evaporator coil fouled with mold and dust buildup. Deep cleaned and applied anti-fungal treatment.");
        }
        if (p2Reports.size() >= 3 && !p2Ac.isEmpty()) {
            finding(p2Reports.get(2), "LEAK",   "Drain Pan",           p2Ac.get(0),
                    "Drain pan cracked; condensate drain clogged causing indoor leak. Fixed drain and re-sealed pan.");
        }

        // Project 3 findings
        if (!p3Reports.isEmpty() && !p3Ac.isEmpty()) {
            finding(p3Reports.get(0), "DEFECT", "Circuit Breaker 20A", p3Ac.get(0),
                    "Overloaded circuit causing breaker trips. Redistributed unit loads across available panels.");
        }
        if (p3Reports.size() >= 2 && p3Ac.size() >= 2) {
            finding(p3Reports.get(1), "WORN",   "Air Filter",          p3Ac.get(1),
                    "Evaporator coil frozen due to restricted airflow. Defrosted coil and replaced clogged air filter.");
            finding(p3Reports.get(1), "GOOD",   null,                  p3Ac.get(0),
                    "Refrigerant level within spec after defrost procedure. Unit fully operational.");
        }
        if (p3Reports.size() >= 3 && p3Ac.size() >= 2) {
            finding(p3Reports.get(2), "WORN",   "Duct Hanger",         p3Ac.get(0),
                    "Loose duct hangers causing loud rattling. Secured with sheet metal screws and sealed joints with tape.");
            finding(p3Reports.get(2), "GOOD",   null,                  p3Ac.get(1),
                    "Adjacent unit operating normally; no issues detected.");
        }

        log.info("Sample finding data seeded: 12 findings across service reports.");
    }

    /**
     * Seeds 2 crew assignments per schedule. Crew members are rotated across schedules
     * and a per-date busy set ensures no crew member is double-booked on the same day.
     */
    private void seedServiceAssignments() {
        if (serviceAssignmentRepository.count() > 0) {
            log.info("Service assignment data already exists, skipping.");
            return;
        }

        java.util.List<Employee> crew = userRepository.findAll().stream()
                .filter(u -> Role.CREW.name().equals(u.getRole()))
                .map(User::getEmployee)
                .filter(e -> e != null)
                .collect(java.util.stream.Collectors.toList());

        if (crew.size() < 2) {
            log.warn("Not enough CREW employees to seed assignments, skipping.");
            return;
        }

        // Track employee IDs already assigned per calendar date to prevent same-day double-booking
        java.util.Map<LocalDate, java.util.Set<Integer>> busyByDate = new java.util.HashMap<>();

        java.util.List<ServiceSchedule> schedules = serviceScheduleRepository.findAll();
        schedules.sort(java.util.Comparator.comparing(ServiceSchedule::getDate)
                .thenComparingInt(ServiceSchedule::getSchedId));

        int assigned = 0;
        int startIdx = 0;

        for (ServiceSchedule schedule : schedules) {
            LocalDate date = schedule.getDate();
            java.util.Set<Integer> busy = busyByDate.computeIfAbsent(date, k -> new java.util.HashSet<>());

            int picked = 0;
            for (int i = 0; i < crew.size() && picked < 2; i++) {
                Employee e = crew.get((startIdx + i) % crew.size());
                if (!busy.contains(e.getEmployeeId())) {
                    assign(e, schedule);
                    busy.add(e.getEmployeeId());
                    picked++;
                    assigned++;
                }
            }
            startIdx = (startIdx + 2) % crew.size();
        }

        log.info("Service assignment seed completed: {} assignments created.", assigned);
    }

    /** Creates and saves a ServiceAssignment linking a crew employee to a schedule. */
    private void assign(Employee employee, ServiceSchedule schedule) {
        ServiceAssignment sa = new ServiceAssignment();
        sa.setEmployee(employee);
        sa.setServiceSchedule(schedule);
        sa.setAddedOn(schedule.getAddedOn());
        serviceAssignmentRepository.save(sa);
    }

    /**
     * Seeds two vehicles (van and flatbed truck) with vehicle logs and gas logs if none exist.
     * Drivers are picked from CREW-role users; projects are the first three seeded projects.
     */
    private void seedVehicles() {
        if (vehicleRepository.count() > 0) {
            log.info("Vehicle data already exists, skipping vehicle seed.");
            return;
        }

        var projects = projectRepository.findAll(
                org.springframework.data.domain.PageRequest.of(0, 3,
                        org.springframework.data.domain.Sort.by("projNum").ascending()))
                .getContent();
        if (projects.size() < 3) {
            log.warn("Not enough projects to seed vehicle logs, skipping.");
            return;
        }

        java.util.List<Employee> crew = userRepository.findAll().stream()
                .filter(u -> Role.CREW.name().equals(u.getRole()))
                .map(User::getEmployee)
                .filter(e -> e != null)
                .toList();
        if (crew.size() < 2) {
            log.warn("Not enough CREW employees to seed vehicle logs, skipping.");
            return;
        }

        Project p1 = projects.get(0);
        Project p2 = projects.get(1);
        Project p3 = projects.get(2);
        Employee d1 = crew.get(0);
        Employee d2 = crew.get(1);
        Employee d3 = crew.size() > 2 ? crew.get(2) : crew.get(0);
        Employee d4 = crew.size() > 3 ? crew.get(3) : crew.get(1);

        // --- Van ---
        Vehicle van = vehicle("Toyota HiAce", "AAA 1234", LocalDateTime.of(2025, 11, 15, 8, 0));

        VehicleLog vl1 = vehicleLog(van, "Material Delivery",    null, "123 Ayala Ave, Makati City",           d1, 12500, 12563, "completed", LocalDateTime.of(2026, 1,  9, 7, 30));
        VehicleLog vl2 = vehicleLog(van, "Personnel Transport",  null, "ABC Corporation, Makati City",          d2, 12563, 12598, "completed", LocalDateTime.of(2026, 1, 22, 7, 0));
        VehicleLog vl3 = vehicleLog(van, "Material Delivery",    null, "45 Sampaguita St, Quezon City",         d1, 12598, 12671, "completed", LocalDateTime.of(2026, 2,  5, 8, 0));
        VehicleLog vl4 = vehicleLog(van, "Personnel Transport",  null, "Santos Residence, Quezon City",         d2, 12671, 12704, "completed", LocalDateTime.of(2026, 2, 25, 7, 30));
        VehicleLog vl5 = vehicleLog(van, "Material Delivery",    null, "Greenfield District, Mandaluyong City", d1, 12704, 12789, "completed", LocalDateTime.of(2026, 3, 11, 8, 0));
        VehicleLog vl6 = vehicleLog(van, "Personnel Transport",  null, "ABC Corporation, Makati City",          d2, 12789, null,  "driving",   LocalDateTime.of(2026, 5, 20, 7, 0));

        vehicleGasLog(vl1, new BigDecimal("1500.00"), "INV-2026-VAN-001");
        vehicleGasLog(vl3, new BigDecimal("1200.00"), "INV-2026-VAN-012");
        vehicleGasLog(vl5, new BigDecimal("1800.00"), "INV-2026-VAN-023");

        // --- Flatbed Truck ---
        Vehicle truck = vehicle("Isuzu ELF Flatbed", "BBB 5678", LocalDateTime.of(2025, 11, 15, 8, 30));

        VehicleLog vt1 = vehicleLog(truck, "Equipment Transport", null, "123 Ayala Ave, Makati City",           d3, 45200, 45298, "completed", LocalDateTime.of(2026, 1, 10, 6, 0));
        VehicleLog vt2 = vehicleLog(truck, "Material Delivery",   null, "Greenfield District, Mandaluyong City", d4, 45298, 45421, "completed", LocalDateTime.of(2026, 1, 28, 6, 30));
        VehicleLog vt3 = vehicleLog(truck, "Equipment Transport", null, "45 Sampaguita St, Quezon City",         d3, 45421, 45489, "completed", LocalDateTime.of(2026, 2, 12, 6, 0));
        VehicleLog vt4 = vehicleLog(truck, "Material Delivery",   null, "ABC Corporation, Makati City",          d4, 45489, 45612, "completed", LocalDateTime.of(2026, 3,  5, 6, 30));
        VehicleLog vt5 = vehicleLog(truck, "Equipment Transport", null, "Greenfield District, Mandaluyong City", d3, 45612, 45778, "completed", LocalDateTime.of(2026, 4, 15, 6, 0));
        VehicleLog vt6 = vehicleLog(truck, "Material Delivery",   null, "Santos Residence, Quezon City",         d4, 45778, 45843, "completed", LocalDateTime.of(2026, 5, 18, 6, 30));

        vehicleGasLog(vt1, new BigDecimal("3200.00"), "INV-2026-TRK-003");
        vehicleGasLog(vt3, new BigDecimal("2800.00"), "INV-2026-TRK-015");
        vehicleGasLog(vt5, new BigDecimal("3500.00"), "INV-2026-TRK-031");

        log.info("Vehicle seed completed: 2 vehicles, 12 vehicle logs, 6 gas logs.");
    }

    /** Creates and saves a Vehicle. */
    private Vehicle vehicle(String model, String plateNum, LocalDateTime addedOn) {
        Vehicle v = new Vehicle();
        v.setVehicleModel(model);
        v.setVehiclePlateNum(plateNum);
        v.setAddedOn(addedOn);
        return vehicleRepository.save(v);
    }

    /** Creates and saves a VehicleLog. */
    private VehicleLog vehicleLog(Vehicle vehicle, String purpose, ServiceSchedule schedule,
                                  String destination, Employee driver,
                                  Integer odoStart, Integer odoEnd,
                                  String status, LocalDateTime addedOn) {
        VehicleLog vl = new VehicleLog();
        vl.setVehicle(vehicle);
        vl.setPurpose(purpose);
        vl.setServiceSchedule(schedule);
        vl.setDestination(destination);
        vl.setDriverEmployee(driver);
        vl.setOdometerStart(odoStart);
        vl.setOdometerEnd(odoEnd);
        vl.setStatus(status);
        vl.setAddedOn(addedOn);
        return vehicleLogRepository.save(vl);
    }

    /** Creates and saves a VehicleGasLog linked to a VehicleLog; document is null. */
    private void vehicleGasLog(VehicleLog vehicleLog, BigDecimal amount, String invoiceId) {
        VehicleGasLog gl = new VehicleGasLog();
        gl.setVehicleLog(vehicleLog);
        gl.setAmount(amount);
        gl.setInvoiceId(invoiceId);
        gl.setDocument(null);
        vehicleGasLogRepository.save(gl);
    }

    /** Creates and saves a ServiceReportFinding. */
    private void finding(ServiceReport report, String findingType, String partModel,
                         AirConditioningUnit ac, String remarks) {
        ServiceReportFinding f = new ServiceReportFinding();
        f.setServiceReport(report);
        f.setFindingType(findingType);
        f.setPartModel(partModel);
        f.setAirConditioningUnit(ac);
        f.setRemarks(remarks);
        f.setAddedOn(report.getAddedOn().plusHours(1));
        findingRepository.save(f);
    }

    /** Seeds four HVAC suppliers if none exist. */
    private void seedSuppliers() {
        if (supplierRepository.count() > 0) {
            log.info("Supplier data already exists, skipping supplier seed.");
            return;
        }

        record SupplierSeed(String name, String address) {}
        SupplierSeed[] seeds = {
            new SupplierSeed("CoolParts Philippines Inc.",
                    "Unit 4B, Northgate Cyberzone, Filinvest City, Alabang, Muntinlupa, Metro Manila"),
            new SupplierSeed("Refrigerant Supply Corp.",
                    "188 Kalayaan Avenue, Diliman, Quezon City, Metro Manila"),
            new SupplierSeed("HVAC Masters Depot",
                    "Block 7, Lot 12, Mandaue Industrial Estate, Mandaue City, Cebu"),
            new SupplierSeed("AirTech Components PH",
                    "2F Suntech iPark, Canlubang, Calamba City, Laguna"),
        };

        for (SupplierSeed s : seeds) {
            Supplier supplier = new Supplier();
            supplier.setName(s.name());
            supplier.setAddress(s.address());
            supplier.setAddedOn(LocalDate.of(2025, 10, 1));
            supplierRepository.save(supplier);
        }

        log.info("Supplier seed completed: 4 suppliers created.");
    }

    /**
     * Seeds purchase orders tied to existing service reports (at most one PO per report),
     * then seeds parts and delivery contacts for each PO.
     */
    private void seedPurchaseOrders() {
        if (purchaseOrderRepository.count() > 0) {
            log.info("Purchase order data already exists, skipping PO seed.");
            return;
        }

        var suppliers = supplierRepository.findAll(
                org.springframework.data.domain.Sort.by("supplierId").ascending());
        if (suppliers.size() < 4) {
            log.warn("Not enough suppliers to seed purchase orders, skipping.");
            return;
        }

        var projects = projectRepository.findAll(
                org.springframework.data.domain.PageRequest.of(0, 3,
                        org.springframework.data.domain.Sort.by("projNum").ascending()))
                .getContent();
        if (projects.size() < 3) {
            log.warn("Not enough projects to seed purchase orders, skipping.");
            return;
        }

        var srSort = org.springframework.data.domain.PageRequest.of(0, 6,
                org.springframework.data.domain.Sort.by("srNumber").ascending());

        var p1Reports = serviceReportRepository
                .findByServiceSchedule_Project_ProjNum(projects.get(0).getProjNum(), srSort).getContent();
        var p2Reports = serviceReportRepository
                .findByServiceSchedule_Project_ProjNum(projects.get(1).getProjNum(), srSort).getContent();
        var p3Reports = serviceReportRepository
                .findByServiceSchedule_Project_ProjNum(projects.get(2).getProjNum(), srSort).getContent();

        Supplier s1 = suppliers.get(0);
        Supplier s2 = suppliers.get(1);
        Supplier s3 = suppliers.get(2);
        Supplier s4 = suppliers.get(3);

        // One PO per service report — pick distinct reports from each project
        PurchaseOrder po1 = null, po2 = null, po3 = null, po4 = null, po5 = null, po6 = null;

        if (!p1Reports.isEmpty()) {
            po1 = po("PO-2026-001", p1Reports.get(0),
                    "Repair Parts", "net30",
                    "123 Ayala Avenue, Makati City, Metro Manila",
                    "Urgently needed for capacitor and refrigerant replacement.", "cash", null,
                    LocalDateTime.of(2026, 1, 6, 9, 0));
        }
        if (p1Reports.size() >= 3) {
            po2 = po("PO-2026-002", p1Reports.get(2),
                    "Maintenance Supplies", "net60",
                    "123 Ayala Avenue, Makati City, Metro Manila",
                    "Drain line cleaner and air filter stock.", "check", null,
                    LocalDateTime.of(2026, 2, 10, 9, 0));
        }
        if (!p2Reports.isEmpty()) {
            po3 = po("PO-2026-003", p2Reports.get(0),
                    "Replacement Parts", "cod",
                    "45 Sampaguita St., Quezon City, Metro Manila",
                    "PCB fuse and circuit breaker replacement.", "cash", null,
                    LocalDateTime.of(2026, 1, 12, 10, 0));
        }
        if (p2Reports.size() >= 3) {
            po4 = po("PO-2026-004", p2Reports.get(2),
                    "Cleaning Supplies", "net15",
                    "45 Sampaguita St., Quezon City, Metro Manila",
                    null, "gcash", "Paid via GCash business wallet.",
                    LocalDateTime.of(2026, 2, 23, 11, 0));
        }
        if (!p3Reports.isEmpty()) {
            po5 = po("PO-2026-005", p3Reports.get(0),
                    "Equipment Parts", "net30",
                    "Greenfield District, Mandaluyong City, Metro Manila",
                    "Circuit breakers and panel load redistribution parts.", "check", null,
                    LocalDateTime.of(2026, 1, 5, 8, 0));
        }
        if (p3Reports.size() >= 4) {
            po6 = po("PO-2026-006", p3Reports.get(3),
                    "AC Components", "net60",
                    "Greenfield District, Mandaluyong City, Metro Manila",
                    "AHU fan motor and capacitor for basement unit.", "cash", null,
                    LocalDateTime.of(2026, 3, 9, 8, 0));
        }

        // Parts — 2-3 per PO (references captured for usage seeding)
        if (po1 != null) {
            part("Capacitor 35/5 MFD",        2, "pcs",  new BigDecimal("650.00"),  s1, LocalDate.of(2026, 1, 6),  po1, "delivered");
            part("R-410A Refrigerant (10 kg)", 1, "tank", new BigDecimal("3200.00"), s2, LocalDate.of(2026, 1, 6),  po1, "delivered");
        }
        if (po2 != null) {
            part("Air Filter 24-inch",         4, "pcs",  new BigDecimal("420.00"),  s1, LocalDate.of(2026, 2, 10), po2, "delivered");
            part("Drain Line Cleaner (1L)",    2, "btl",  new BigDecimal("280.00"),  s3, LocalDate.of(2026, 2, 10), po2, "delivered");
            part("Anti-fungal Coil Spray",     2, "btl",  new BigDecimal("350.00"),  s3, LocalDate.of(2026, 2, 10), po2, "delivered");
        }
        if (po3 != null) {
            part("PCB Fuse 15A",               5, "pcs",  new BigDecimal("85.00"),   s4, LocalDate.of(2026, 1, 12), po3, "delivered");
            part("Circuit Breaker 20A",        2, "pcs",  new BigDecimal("750.00"),  s4, LocalDate.of(2026, 1, 12), po3, "delivered");
        }
        if (po4 != null) {
            part("Evaporator Coil Cleaner (1L)", 3, "btl", new BigDecimal("310.00"), s3, LocalDate.of(2026, 2, 23), po4, "delivered");
            part("Condensate Drain Pan Sealant", 1, "set", new BigDecimal("540.00"), s1, LocalDate.of(2026, 2, 23), po4, "ordered");
        }
        if (po5 != null) {
            part("Circuit Breaker 20A",        4, "pcs",  new BigDecimal("750.00"),  s4, LocalDate.of(2026, 1, 5),  po5, "delivered");
            part("Panel Busbar 100A",          1, "pcs",  new BigDecimal("1850.00"), s4, LocalDate.of(2026, 1, 5),  po5, "delivered");
            part("Cable Lug 35mm²",            10, "pcs", new BigDecimal("45.00"),   s4, LocalDate.of(2026, 1, 5),  po5, "delivered");
        }
        if (po6 != null) {
            part("AHU Fan Motor 1.5HP",        1, "pcs",  new BigDecimal("8500.00"), s2, LocalDate.of(2026, 3, 9),  po6, "ordered");
            part("Motor Run Capacitor 40MFD",  1, "pcs",  new BigDecimal("920.00"),  s1, LocalDate.of(2026, 3, 9),  po6, "ordered");
        }

        // Delivery contacts — 0 to 2 per PO
        if (po1 != null) {
            poContact(po1, "Maria Santos",   "+639171234567");
            poContact(po1, "Juan dela Cruz", "+639271234567");
        }
        if (po2 != null) {
            poContact(po2, "Maria Santos", "+639171234567");
        }
        if (po3 != null) {
            poContact(po3, "Roberto Santos",  "+639281234567");
            poContact(po3, "Ana Reyes",       "+639381234567");
        }
        // po4 — 0 contacts (intentionally omitted)
        if (po5 != null) {
            poContact(po5, "Liza Reyes", "+639391234567");
        }
        // po6 — 0 contacts (intentionally omitted)

        log.info("Purchase order seed completed: POs, parts, and delivery contacts created.");
    }

    /** Creates and saves a PurchaseOrder. */
    private PurchaseOrder po(String poNum, ServiceReport serviceReport,
                             String purpose, String terms, String deliveryAddress,
                             String remarks, String paymentMethod, String paymentDetails,
                             LocalDateTime addedOn) {
        PurchaseOrder po = new PurchaseOrder();
        po.setPoNum(poNum);
        po.setServiceReport(serviceReport);
        po.setPurpose(purpose);
        po.setTerms(terms);
        po.setDeliveryAddress(deliveryAddress);
        po.setRemarks(remarks);
        po.setPaymentMethod(paymentMethod);
        po.setPaymentDetails(paymentDetails);
        po.setAddedOn(addedOn);
        return purchaseOrderRepository.save(po);
    }

    /** Creates, saves, and returns a Part linked to a PurchaseOrder and Supplier. */
    private Part part(String name, int quantityOrdered, String quantityType, BigDecimal unitPrice,
                      Supplier supplier, LocalDate orderDate, PurchaseOrder purchaseOrder,
                      String status) {
        Part p = new Part();
        p.setName(name);
        p.setQuantityOrdered(quantityOrdered);
        p.setQuantityType(quantityType);
        p.setUnitPrice(unitPrice);
        p.setSupplier(supplier);
        p.setOrderDate(orderDate);
        p.setPurchaseOrder(purchaseOrder);
        p.setStatus(status);
        p.setAddedOn(purchaseOrder.getAddedOn());
        return partRepository.save(p);
    }

    /** Creates and saves a PurchaseOrderDeliveryContact. */
    private void poContact(PurchaseOrder purchaseOrder, String contactName, String contactNumber) {
        PurchaseOrderDeliveryContact c = new PurchaseOrderDeliveryContact();
        c.setPurchaseOrder(purchaseOrder);
        c.setContactName(contactName);
        c.setContactNumber(contactNumber);
        poDeliveryContactRepository.save(c);
    }

    /**
     * Seeds 2–3 billing items per service report.
     * Items are labor charges and service fees only — no materials or parts.
     */
    private void seedBillingItems() {
        if (billingItemRepository.count() > 0) {
            log.info("Billing item data already exists, skipping billing item seed.");
            return;
        }

        var allReports = serviceReportRepository.findAll(
                org.springframework.data.domain.Sort.by("srNumber").ascending());
        if (allReports.isEmpty()) {
            log.warn("No service reports found to seed billing items, skipping.");
            return;
        }

        // Billing data per SR in srNumber order (matches seeded SR order)
        record BillingEntry(String description, int quantity, String unitPrice) {}
        record SrBilling(BillingEntry[] items) {}

        SrBilling[] perSr = {
            // SR 1 — P1: Capacitor replacement & refrigerant recharge
            new SrBilling(new BillingEntry[]{
                new BillingEntry("Labor — Capacitor Replacement",              1, "800.00"),
                new BillingEntry("Labor — Refrigerant Recharge",               1, "600.00"),
                new BillingEntry("Service Call Fee",                           1, "500.00"),
            }),
            // SR 2 — P1: Noisy compressor tightening & lubrication
            new SrBilling(new BillingEntry[]{
                new BillingEntry("Labor — Compressor Mount Tightening",        1, "600.00"),
                new BillingEntry("Labor — Moving Parts Lubrication",           1, "300.00"),
                new BillingEntry("Service Call Fee",                           1, "500.00"),
            }),
            // SR 3 — P1: Drain line clearing & filter cleaning
            new SrBilling(new BillingEntry[]{
                new BillingEntry("Labor — Drain Line Clearing",                1, "700.00"),
                new BillingEntry("Labor — Air Filter Cleaning",                1, "350.00"),
                new BillingEntry("Service Call Fee",                           1, "500.00"),
            }),
            // SR 4 — P1: Routine preventive maintenance
            new SrBilling(new BillingEntry[]{
                new BillingEntry("Labor — Full System Inspection",             1, "1500.00"),
                new BillingEntry("Labor — Coil Cleaning & Filter Replacement", 4, "350.00"),
                new BillingEntry("Service Call Fee",                           1, "500.00"),
            }),
            // SR 5 — P1: Thermostat recalibration
            new SrBilling(new BillingEntry[]{
                new BillingEntry("Labor — Thermostat Recalibration",           1, "600.00"),
                new BillingEntry("Service Call Fee",                           1, "500.00"),
            }),
            // SR 6 — P2: PCB fuse & circuit breaker reset
            new SrBilling(new BillingEntry[]{
                new BillingEntry("Labor — PCB Fuse Replacement",               1, "700.00"),
                new BillingEntry("Labor — Circuit Breaker Reset",              1, "400.00"),
                new BillingEntry("Service Call Fee",                           1, "500.00"),
            }),
            // SR 7 — P2: Evaporator coil deep clean
            new SrBilling(new BillingEntry[]{
                new BillingEntry("Labor — Evaporator Coil Deep Clean",         1, "900.00"),
                new BillingEntry("Labor — Anti-fungal Treatment Application",  1, "400.00"),
                new BillingEntry("Service Call Fee",                           1, "500.00"),
            }),
            // SR 8 — P2: Drain pan & condensate fix
            new SrBilling(new BillingEntry[]{
                new BillingEntry("Labor — Condensate Drain Clearing",          1, "600.00"),
                new BillingEntry("Labor — Drain Pan Re-sealing",               1, "800.00"),
                new BillingEntry("Service Call Fee",                           1, "500.00"),
            }),
            // SR 9 — P2: Condenser coil cleaning & refrigerant top-up
            new SrBilling(new BillingEntry[]{
                new BillingEntry("Labor — Condenser Coil Cleaning",            1, "750.00"),
                new BillingEntry("Labor — Refrigerant Top-up",                 1, "600.00"),
                new BillingEntry("Service Call Fee",                           1, "500.00"),
            }),
            // SR 10 — P2: Receiver module replacement
            new SrBilling(new BillingEntry[]{
                new BillingEntry("Labor — Receiver Module Replacement",        1, "700.00"),
                new BillingEntry("Labor — Remote Pairing & Testing",           1, "300.00"),
                new BillingEntry("Service Call Fee",                           1, "500.00"),
            }),
            // SR 11 — P3: Circuit overload redistribution
            new SrBilling(new BillingEntry[]{
                new BillingEntry("Labor — Electrical Circuit Assessment",      1, "1200.00"),
                new BillingEntry("Labor — Panel Load Redistribution",          1, "2500.00"),
                new BillingEntry("Service Call Fee",                           1, "500.00"),
            }),
            // SR 12 — P3: Frozen coil defrost
            new SrBilling(new BillingEntry[]{
                new BillingEntry("Labor — Coil Defrost Service",               1, "800.00"),
                new BillingEntry("Labor — Air Filter Replacement",             2, "300.00"),
                new BillingEntry("Service Call Fee",                           1, "500.00"),
            }),
            // SR 13 — P3: Ductwork rattling fix
            new SrBilling(new BillingEntry[]{
                new BillingEntry("Labor — Ductwork Securing",                  1, "900.00"),
                new BillingEntry("Labor — Duct Joint Sealing",                 1, "500.00"),
                new BillingEntry("Service Call Fee",                           1, "500.00"),
            }),
            // SR 14 — P3: AHU fan motor replacement
            new SrBilling(new BillingEntry[]{
                new BillingEntry("Labor — Fan Motor Replacement",              1, "1500.00"),
                new BillingEntry("Labor — Rotation & Airflow Testing",         1, "600.00"),
                new BillingEntry("Service Call Fee",                           1, "500.00"),
            }),
            // SR 15 — P3: Routine preventive maintenance (all units)
            new SrBilling(new BillingEntry[]{
                new BillingEntry("Labor — Full System Cleaning",               1, "2000.00"),
                new BillingEntry("Labor — Belt & Coil Inspection",             4, "350.00"),
                new BillingEntry("Service Call Fee",                           1, "500.00"),
            }),
            // SR 16 — P3: Post-maintenance follow-up
            new SrBilling(new BillingEntry[]{
                new BillingEntry("Labor — Post-PM Inspection",           1, "600.00"),
                new BillingEntry("Service Call Fee",                     1, "500.00"),
            }),
        };

        int total = 0;
        for (int i = 0; i < allReports.size() && i < perSr.length; i++) {
            ServiceReport sr = allReports.get(i);
            for (BillingEntry entry : perSr[i].items()) {
                billingItem(sr, entry.description(), entry.quantity(), new BigDecimal(entry.unitPrice()));
                total++;
            }
        }

        log.info("Billing item seed completed: {} items across {} service reports.", total, Math.min(allReports.size(), perSr.length));
    }

    /** Creates and saves a ServiceReportBillingItem. */
    private void billingItem(ServiceReport serviceReport, String description, int quantity, BigDecimal unitPrice) {
        ServiceReportBillingItem item = new ServiceReportBillingItem();
        item.setServiceReport(serviceReport);
        item.setDescription(description);
        item.setQuantity(quantity);
        item.setUnitPrice(unitPrice);
        item.setAddedOn(serviceReport.getAddedOn().plusHours(2));
        billingItemRepository.save(item);
    }

    /**
     * Seeds payment logs for service reports that have been paid or partially paid.
     * Each log represents one receipt. Amounts match the billed billing item totals.
     */
    private void seedPaymentLogs() {
        if (paymentLogRepository.count() > 0) {
            log.info("Payment log data already exists, skipping payment log seed.");
            return;
        }

        var allReports = serviceReportRepository.findAll(
                org.springframework.data.domain.Sort.by("srNumber").ascending());
        if (allReports.size() < 14) {
            log.warn("Not enough service reports to seed payment logs, skipping.");
            return;
        }

        // SR indices (0-based): 0=SR1, 1=SR2, ..., 13=SR14
        // Paid SRs: 0,1,2,5,6,7,10,11,12,13  Partial: 8
        ServiceReport sr1  = allReports.get(0);
        ServiceReport sr2  = allReports.get(1);
        ServiceReport sr3  = allReports.get(2);
        ServiceReport sr6  = allReports.get(5);
        ServiceReport sr7  = allReports.get(6);
        ServiceReport sr8  = allReports.get(7);
        ServiceReport sr9  = allReports.get(8);
        ServiceReport sr11 = allReports.get(10);
        ServiceReport sr12 = allReports.get(11);
        ServiceReport sr13 = allReports.get(12);
        ServiceReport sr14 = allReports.get(13);

        // Project 1 — ABC Corporation
        payment(sr1,  new BigDecimal("1900.00"), "cash",  LocalDate.of(2026, 1, 9),  "OR-2026-P1-001", "ABC Corporation",          null);
        payment(sr2,  new BigDecimal("1400.00"), "gcash", LocalDate.of(2026, 1, 23), "OR-2026-P1-002", "ABC Corporation",          null);
        payment(sr3,  new BigDecimal("1550.00"), "cash",  LocalDate.of(2026, 2, 13), "OR-2026-P1-003", "ABC Corporation",          null);

        // Project 2 — Santos Residence
        payment(sr6,  new BigDecimal("1600.00"), "cash",  LocalDate.of(2026, 1, 15), "OR-2026-P2-001", "Roberto Santos",           null);
        payment(sr7,  new BigDecimal("1800.00"), "cash",  LocalDate.of(2026, 2, 6),  "OR-2026-P2-002", "Roberto Santos",           null);
        payment(sr8,  new BigDecimal("1900.00"), "gcash", LocalDate.of(2026, 2, 26), "OR-2026-P2-003", "Roberto Santos",           null);
        // SR 9 — partial: 1000 of 1850 billed
        payment(sr9,  new BigDecimal("1000.00"), "check", LocalDate.of(2026, 3, 25), "CHK-2026-P2-004", "Roberto Santos",          "Partial payment; balance to follow.");

        // Project 3 — Greenfield Mall Inc.
        payment(sr11, new BigDecimal("4200.00"), "cash",  LocalDate.of(2026, 1, 8),  "OR-2026-P3-001", "Greenfield Mall Inc.",     null);
        payment(sr12, new BigDecimal("1900.00"), "cash",  LocalDate.of(2026, 1, 29), "OR-2026-P3-002", "Greenfield Mall Inc.",     null);
        payment(sr13, new BigDecimal("1900.00"), "check", LocalDate.of(2026, 2, 19), "CHK-2026-P3-003", "Greenfield Mall Inc.",    null);
        payment(sr14, new BigDecimal("2600.00"), "check", LocalDate.of(2026, 3, 12), "CHK-2026-P3-004", "Greenfield Mall Inc.",    null);

        log.info("Payment log seed completed: 11 payment logs created.");
    }

    /** Creates and saves a PaymentLog for a service report. */
    private void payment(ServiceReport sr, BigDecimal amount, String paymentMethod,
                         LocalDate receiptDate, String receiptNumber, String paidBy, String notes) {
        PaymentLog pl = new PaymentLog();
        pl.setServiceReport(sr);
        pl.setAmount(amount);
        pl.setPaymentMethod(paymentMethod);
        pl.setReceiptDate(receiptDate);
        pl.setReceiptNumber(receiptNumber);
        pl.setPaidBy(paidBy);
        pl.setNotes(notes);
        pl.setAddedOn(receiptDate.atTime(10, 0));
        paymentLogRepository.save(pl);
    }

    /**
     * Seeds sample part usage records demonstrating single and split-leftover consumption.
     * Parts with "ordered" status are skipped — only delivered parts get usage records.
     */
    private void seedPartUsages() {
        if (partUsageRepository.count() > 0) {
            log.info("Part usage data already exists, skipping.");
            return;
        }

        var allParts = partRepository.findAll(
                org.springframework.data.domain.Sort.by("partId").ascending());
        if (allParts.isEmpty()) {
            log.warn("No parts found to seed part usages, skipping.");
            return;
        }

        var allReports = serviceReportRepository.findAll(
                org.springframework.data.domain.Sort.by("srNumber").ascending());
        if (allReports.size() < 11) {
            log.warn("Not enough service reports to seed part usages, skipping.");
            return;
        }

        // Resolve SRs by position (0-based index matches seeded order)
        ServiceReport sr1  = allReports.get(0);   // P1 — Jan 8  — capacitor & refrigerant
        ServiceReport sr2  = allReports.get(1);   // P1 — Jan 22 — noisy compressor
        ServiceReport sr3  = allReports.get(2);   // P1 — Feb 12 — drain & filter
        ServiceReport sr4  = allReports.get(3);   // P1 — Mar 5  — routine PM
        ServiceReport sr6  = allReports.get(5);   // P2 — Jan 14 — PCB fuse
        ServiceReport sr7  = allReports.get(6);   // P2 — Feb 5  — foul smell / coil clean
        ServiceReport sr8  = allReports.get(7);   // P2 — Feb 25 — drain pan leak
        ServiceReport sr11 = allReports.get(10);  // P3 — Jan 7  — circuit overload

        // Resolve parts by name + PO (handles duplicate names across POs)
        Part capacitor    = findPart("Capacitor 35/5 MFD",        "PO-2026-001");
        Part refrigerant  = findPart("R-410A Refrigerant (10 kg)", "PO-2026-001");
        Part airFilter    = findPart("Air Filter 24-inch",          "PO-2026-002");
        Part drainCleaner = findPart("Drain Line Cleaner (1L)",     "PO-2026-002");
        Part antiFungal   = findPart("Anti-fungal Coil Spray",      "PO-2026-002");
        Part pcbFuse      = findPart("PCB Fuse 15A",                "PO-2026-003");
        Part cbPo3        = findPart("Circuit Breaker 20A",         "PO-2026-003");
        Part coilCleaner  = findPart("Evaporator Coil Cleaner (1L)","PO-2026-004");
        Part cbPo5        = findPart("Circuit Breaker 20A",         "PO-2026-005");
        Part busbar       = findPart("Panel Busbar 100A",           "PO-2026-005");
        Part cableLug     = findPart("Cable Lug 35mm²",             "PO-2026-005");

        int count = 0;

        // PO-2026-001 — Capacitor (qty 2): 1 used in SR1, 1 used in SR2 (fully used)
        if (capacitor != null) {
            partUsage(capacitor, sr1, 1, null);
            partUsage(capacitor, sr2, 1, null);
            count += 2;
        }
        // PO-2026-001 — Refrigerant (qty 1): 1 used in SR1 (fully used)
        if (refrigerant != null) {
            partUsage(refrigerant, sr1, 1, null);
            count++;
        }
        // PO-2026-002 — Air Filter (qty 4): 2 used in SR3, 2 used in SR4 (fully used)
        if (airFilter != null) {
            partUsage(airFilter, sr3, 2, null);
            partUsage(airFilter, sr4, 2, null);
            count += 2;
        }
        // PO-2026-002 — Drain Line Cleaner (qty 2): 1 used in SR3 (1 leftover)
        if (drainCleaner != null) {
            partUsage(drainCleaner, sr3, 1, null);
            count++;
        }
        // PO-2026-002 — Anti-fungal Spray (qty 2): 2 used in SR7 (fully used)
        if (antiFungal != null) {
            partUsage(antiFungal, sr7, 2, null);
            count++;
        }
        // PO-2026-003 — PCB Fuse 15A (qty 5): 1 used in SR6 (4 leftover)
        if (pcbFuse != null) {
            partUsage(pcbFuse, sr6, 1, null);
            count++;
        }
        // PO-2026-003 — Circuit Breaker 20A (qty 2): 1 in SR6, 1 in SR11 (fully used; split leftover example)
        if (cbPo3 != null) {
            partUsage(cbPo3, sr6,  1, null);
            partUsage(cbPo3, sr11, 1, null);
            count += 2;
        }
        // PO-2026-004 — Evaporator Coil Cleaner (qty 3): 1 in SR7, 1 in SR8 (1 leftover; split leftover example)
        if (coilCleaner != null) {
            partUsage(coilCleaner, sr7, 1, null);
            partUsage(coilCleaner, sr8, 1, null);
            count += 2;
        }
        // PO-2026-005 — Circuit Breaker 20A (qty 4): 3 used in SR11 (1 leftover)
        if (cbPo5 != null) {
            partUsage(cbPo5, sr11, 3, null);
            count++;
        }
        // PO-2026-005 — Panel Busbar 100A (qty 1): 1 used in SR11 (fully used)
        if (busbar != null) {
            partUsage(busbar, sr11, 1, null);
            count++;
        }
        // PO-2026-005 — Cable Lug 35mm² (qty 10): 6 used in SR11 (4 leftover)
        if (cableLug != null) {
            partUsage(cableLug, sr11, 6, null);
            count++;
        }

        log.info("Part usage seed completed: {} usage records created.", count);
    }

    /** Looks up a saved part by name and PO number. Returns null if not found (seed skip-safe). */
    private Part findPart(String name, String poNum) {
        return partRepository.findAll().stream()
                .filter(p -> p.getName().equals(name)
                        && p.getPurchaseOrder().getPoNum().equals(poNum))
                .findFirst().orElse(null);
    }

    /** Creates and saves a PartUsage record linked to a service report. */
    private void partUsage(Part part, ServiceReport sr, int qtyUsed, String notes) {
        PartUsage u = new PartUsage();
        u.setPart(part);
        u.setServiceReport(sr);
        u.setQtyUsed(qtyUsed);
        u.setNotes(notes);
        u.setUsedOn(sr.getAddedOn().plusHours(1));
        partUsageRepository.save(u);
    }

}
