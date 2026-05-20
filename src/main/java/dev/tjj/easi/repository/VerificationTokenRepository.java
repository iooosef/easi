package dev.tjj.easi.repository;

import dev.tjj.easi.entity.TokenPurpose;
import dev.tjj.easi.entity.User;
import dev.tjj.easi.entity.VerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import java.util.Optional;

public interface VerificationTokenRepository extends JpaRepository<VerificationToken, Long> {
    Optional<VerificationToken> findByUserAndTokenAndPurpose(User user, String token, TokenPurpose purpose);

    @Modifying
    void deleteByUserAndPurpose(User user, TokenPurpose purpose);
}
