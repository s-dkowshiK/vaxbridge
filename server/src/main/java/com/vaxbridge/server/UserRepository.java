package com.vaxbridge.server;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Database access for accounts. Spring Data writes the queries from the method names. */
public interface UserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByEmail(String email);
}
