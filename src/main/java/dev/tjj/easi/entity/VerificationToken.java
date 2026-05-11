package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "verification_tokens")
public class VerificationToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Getter
    @Setter
    private Long id;

    @Column(nullable = false, unique = true, length = 10)
    @Getter
    @Setter
    private String token;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @Getter
    @Setter
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Getter
    @Setter
    private TokenPurpose purpose;

    @Column(name = "expires_at", nullable = false)
    @Getter
    @Setter
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    @Getter
    @Setter
    private boolean used = false;
}
