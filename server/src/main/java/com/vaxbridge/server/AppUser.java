package com.vaxbridge.server;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** A nurse or other staff member who signs in to save records. Passwords are stored only as BCrypt hashes. */
@Entity
@Table(name = "app_user")
public class AppUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(nullable = false)
    String name;

    @Column(nullable = false, unique = true)
    String email;

    @Column(nullable = false)
    String passwordHash;

    Instant createdAt;

    /** Profile picture, if the user added one (up to 2 MB). */
    // Plain VARBINARY/VARCHAR rather than the LONG32 types: these are often null, and the PostgreSQL
    // driver can't send a null of the LONG32 types ("Unknown Types value").
    @JdbcTypeCode(SqlTypes.VARBINARY)  // "bytea" in PostgreSQL
    @Column(length = 3 * 1024 * 1024)
    byte[] avatar;
    String avatarType;

    /** Appearance settings chosen in Settings, as JSON the website reads (colors, corner radius, text size). */
    @Column(length = AccountController.THEME_MAX_CHARS)
    String themeJson;

    protected AppUser() {
    }

    AppUser(String name, String email, String passwordHash) {
        this.name = name;
        this.email = email;
        this.passwordHash = passwordHash;
        this.createdAt = Instant.now();
    }
}
