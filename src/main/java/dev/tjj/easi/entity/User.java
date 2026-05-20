1package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    @Getter
    @Setter
    private Integer userId;

    @Column(name = "email", length = 255, nullable = false)
    @Getter
    @Setter
    private String email;

    @Column(name = "password", length = 255, nullable = false)
    @Getter
    @Setter
    private String password;

    @Column(name = "role", length = 30, nullable = false)
    @Getter
    @Setter
    private String role;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    @Getter
    @Setter
    private Employee employee;

    @Column(name = "status", nullable = false, columnDefinition = "integer DEFAULT 1")
    @Getter
    @Setter
    private Integer status = 1;

    @Column(name = "added_on", nullable = false)
    @Getter
    @Setter
    private LocalDateTime addedOn;
}