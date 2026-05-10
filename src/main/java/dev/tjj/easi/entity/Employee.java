package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "employees")
public class Employee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "employee_id")
    @Getter
    @Setter
    private Integer employeeId;

    @Column(name = "last_name", length = 255, nullable = false)
    @Getter
    @Setter
    private String lastName;

    @Column(name = "first_name", length = 255, nullable = false)
    @Getter
    @Setter
    private String firstName;

    @Column(name = "middle_name", length = 255, nullable = false)
    @Getter
    @Setter
    private String middleName;

    @Column(name = "suffix_name", length = 255, nullable = false)
    @Getter
    @Setter
    private String suffixName;

    @Column(name = "gender", length = 60, nullable = false)
    @Getter
    @Setter
    private String gender;

    @Column(name = "birthdate", nullable = false)
    @Getter
    @Setter
    private LocalDate birthdate;

    @Column(name = "contact_number", length = 16, nullable = false)
    @Getter
    @Setter
    private String contactNumber;

    @Column(name = "position", length = 30, nullable = false)
    @Getter
    @Setter
    private String position;

    @Column(name = "status", length = 16, nullable = false, columnDefinition = "varchar(16) DEFAULT 'unset'")
    @Getter
    @Setter
    private String status = "unset";

    @Column(name = "added_on", nullable = false)
    @Getter
    @Setter
    private LocalDateTime addedOn;
}