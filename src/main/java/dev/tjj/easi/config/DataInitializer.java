package dev.tjj.easi.config;

import java.time.LocalDate;
import java.time.LocalDateTime;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import dev.tjj.easi.entity.AirConditioningUnit;
import dev.tjj.easi.entity.Employee;
import dev.tjj.easi.entity.Project;
import dev.tjj.easi.entity.Role;
import dev.tjj.easi.entity.ServiceReport;
import dev.tjj.easi.entity.ServiceReportFinding;
import dev.tjj.easi.entity.ServiceSchedule;
import dev.tjj.easi.entity.User;
import dev.tjj.easi.repository.AirConditioningUnitRepository;
import dev.tjj.easi.repository.EmployeeRepository;
import dev.tjj.easi.repository.ProjectRepository;
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

    /** Creates the default admin employee and user if they do not yet exist. */
    @Override
    public void run(String... args) {
        createAdminUser();
        createJosephUser();
        seedProjectData();
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
        report(p1, ss1,  "Unit not cooling properly in 3rd floor east wing",  "Replaced capacitor and recharged refrigerant",                          "3rd Floor East Wing, ABC Corp",       "cash",  LocalDate.of(2026, 1, 9),  null, "paid",    LocalDateTime.of(2026, 1, 8, 14, 0));
        report(p1, ss2,  "Noisy compressor on rooftop unit A",                "Tightened mounting bolts and lubricated moving parts",                  "Rooftop, ABC Corp",                   "gcash", LocalDate.of(2026, 1, 23), null, "paid",    LocalDateTime.of(2026, 1, 22, 15, 0));
        report(p1, ss3,  "Water dripping from ceiling cassette unit",         "Cleared blocked drain line and cleaned air filter",                     "2nd Floor Lobby, ABC Corp",           "cash",  LocalDate.of(2026, 2, 13), null, "paid",    LocalDateTime.of(2026, 2, 12, 11, 0));
        report(p1, ss4,  "Routine preventive maintenance check",              "Full system inspection, coil cleaning, filter replacement",             "All Floors, ABC Corp",                "check", null,                      null, "unpaid",  LocalDateTime.of(2026, 3, 5, 9, 0));
        report(p1, ss5,  "Thermostat reading inaccurate",                     "Recalibrated thermostat sensor and tested operation",                   "1st Floor Office, ABC Corp",          "unset", null,                      null, "unpaid",  LocalDateTime.of(2026, 4, 10, 10, 0));

        // Project 2 — 5 reports
        report(p2, ss6,  "Split unit not turning on after power outage",      "Reset circuit breaker and replaced blown fuse on PCB",                  "Master Bedroom, Santos Residence",    "cash",  LocalDate.of(2026, 1, 15), null, "paid",    LocalDateTime.of(2026, 1, 14, 13, 0));
        report(p2, ss7,  "Foul smell from indoor unit",                       "Deep cleaned evaporator coil and applied anti-fungal treatment",         "Living Room, Santos Residence",       "cash",  LocalDate.of(2026, 2, 6),  null, "paid",    LocalDateTime.of(2026, 2, 5, 10, 0));
        report(p2, ss8,  "Unit leaking water indoors",                        "Fixed clogged condensate drain and re-sealed drain pan",                 "2nd Floor Hallway, Santos Residence", "gcash", LocalDate.of(2026, 2, 26), null, "paid",    LocalDateTime.of(2026, 2, 25, 14, 0));
        report(p2, ss9,  "Compressor overheating and shutting off",           "Cleaned condenser coil and topped up refrigerant to spec",               "Outdoor Unit, Santos Residence",      "check", null,                      null, "partial", LocalDateTime.of(2026, 3, 18, 9, 30));
        report(p2, ss10, "Remote control not working and unit unresponsive",  "Replaced faulty receiver module and tested remote pairing",              "Guest Room, Santos Residence",        "unset", null,                      null, "unpaid",  LocalDateTime.of(2026, 4, 22, 11, 0));

        // Project 3 — 6 reports
        report(p3, ss11, "Multiple units tripping breaker simultaneously",    "Identified overloaded circuit; redistributed unit loads across panels",  "Main Electrical Room, Greenfield B",  "cash",  LocalDate.of(2026, 1, 8),  null, "paid",    LocalDateTime.of(2026, 1, 7, 9, 0));
        report(p3, ss12, "Evaporator coil frozen on unit B2",                 "Defrosted coil, replaced air filter, checked refrigerant level",         "Unit B2 Server Room, Greenfield B",   "cash",  LocalDate.of(2026, 1, 29), null, "paid",    LocalDateTime.of(2026, 1, 28, 15, 0));
        report(p3, ss13, "Loud rattling noise from ductwork",                 "Secured loose duct sections with sheet metal screws and tape",           "Ceiling Duct, Wing C, Greenfield B",  "check", LocalDate.of(2026, 2, 19), null, "paid",    LocalDateTime.of(2026, 2, 18, 10, 0));
        report(p3, ss14, "Central AHU fan motor failure",                     "Replaced fan motor and capacitor; tested rotation and airflow",          "AHU Room, Basement, Greenfield B",    "check", LocalDate.of(2026, 3, 12), null, "paid",    LocalDateTime.of(2026, 3, 11, 8, 0));
        report(p3, ss15, "Routine preventive maintenance — all units",        "Full cleaning, belt inspection, coil washing, and refrigerant check",    "All Areas, Greenfield B",             "cash",  null,                      null, "unpaid",  LocalDateTime.of(2026, 3, 31, 9, 0));
        report(p3, ss16, "Post-maintenance follow-up inspection",             "Verified all units operating within spec after March PM",                "All Areas, Greenfield B",             "unset", null,                      null, "unpaid",  LocalDateTime.of(2026, 4, 15, 13, 0));

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

    /** Creates and saves a ServiceReport. */
    private void report(Project project, ServiceSchedule schedule, String complaint, String workDone,
                        String location, String paymentMethod, LocalDate receiptDate,
                        Integer docuId, String status, LocalDateTime addedOn) {
        ServiceReport r = new ServiceReport();
        r.setProject(project);
        r.setServiceSchedule(schedule);
        r.setComplaint(complaint);
        r.setWorkDone(workDone);
        r.setLocation(location);
        r.setPaymentMethod(paymentMethod);
        r.setReceiptReceiveDate(receiptDate);
        r.setDocument(null);
        r.setStatus(status);
        r.setAddedOn(addedOn);
        serviceReportRepository.save(r);
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

        var p1Reports = serviceReportRepository.findAllByProject_ProjNum(projects.get(0).getProjNum(), srPage).getContent();
        var p2Reports = serviceReportRepository.findAllByProject_ProjNum(projects.get(1).getProjNum(), srPage).getContent();
        var p3Reports = serviceReportRepository.findAllByProject_ProjNum(projects.get(2).getProjNum(), srPage).getContent();

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

}
