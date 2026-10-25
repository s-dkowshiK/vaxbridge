package com.vaxbridge.server;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.util.Set;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Settings for the signed-in user.
 *
 * <ul>
 *   <li>PUT    /api/account          - {name, email, theme} (any field left out is kept)</li>
 *   <li>PUT    /api/account/password - {currentPassword, newPassword}</li>
 *   <li>GET    /api/account/avatar   - the profile picture</li>
 *   <li>PUT    /api/account/avatar   - multipart "file": a JPEG, PNG, GIF or WebP up to 2 MB</li>
 *   <li>DELETE /api/account/avatar</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/account")
public class AccountController {
    static final Set<String> AVATAR_TYPES = Set.of("image/jpeg", "image/png", "image/gif", "image/webp");
    static final long AVATAR_MAX_BYTES = 2 * 1024 * 1024;
    static final int THEME_MAX_CHARS = 4000;

    private final UserRepository users;

    public AccountController(UserRepository users) {
        this.users = users;
    }

    public record ProfileRequest(String name, String email, JsonNode theme) {
    }

    public record PasswordRequest(String currentPassword, String newPassword) {
    }

    @PutMapping
    public AuthController.UserInfo update(@RequestBody ProfileRequest req, HttpSession session) {
        AppUser user = AuthController.currentUser(session, users);
        if (req.name() != null) {
            String name = req.name().trim();
            if (name.isEmpty()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Enter your name.");
            }
            user.name = name;
        }
        if (req.email() != null) {
            String email = AuthController.normalize(req.email());
            if (!email.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
            }
            if (!email.equals(user.email) && users.findByEmail(email).isPresent()) {
                throw new ApiException(HttpStatus.CONFLICT, "Another account already uses this email.");
            }
            user.email = email;
        }
        if (req.theme() != null) {
            if (req.theme().isNull()) {
                user.themeJson = null;  // back to the default look
            } else if (!req.theme().isObject() || req.theme().toString().length() > THEME_MAX_CHARS) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Those appearance settings couldn't be saved.");
            } else {
                user.themeJson = req.theme().toString();
            }
        }
        return AuthController.UserInfo.of(users.save(user));
    }

    @PutMapping("/password")
    public ResponseEntity<Void> password(@RequestBody PasswordRequest req, HttpSession session) {
        AppUser user = AuthController.currentUser(session, users);
        if (req.currentPassword() == null || !AuthController.PASSWORDS.matches(req.currentPassword(), user.passwordHash)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Your current password is incorrect.");
        }
        if (req.newPassword() == null || req.newPassword().length() < 8) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Use a new password with at least 8 characters.");
        }
        user.passwordHash = AuthController.PASSWORDS.encode(req.newPassword());
        users.save(user);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/avatar")
    public ResponseEntity<byte[]> avatar(HttpSession session) {
        AppUser user = AuthController.currentUser(session, users);
        if (user.avatar == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "No profile picture.");
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(user.avatarType))
                .cacheControl(CacheControl.noCache().cachePrivate())
                .header("X-Content-Type-Options", "nosniff")
                .body(user.avatar);
    }

    @PutMapping("/avatar")
    public AuthController.UserInfo setAvatar(@RequestPart("file") MultipartFile file, HttpSession session)
            throws IOException {
        AppUser user = AuthController.currentUser(session, users);
        if (file.getContentType() == null || !AVATAR_TYPES.contains(file.getContentType())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Use a JPEG, PNG, GIF or WebP picture.");
        }
        if (file.isEmpty() || file.getSize() > AVATAR_MAX_BYTES) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Use a picture smaller than 2 MB.");
        }
        user.avatar = file.getBytes();
        user.avatarType = file.getContentType();
        return AuthController.UserInfo.of(users.save(user));
    }

    @DeleteMapping("/avatar")
    public AuthController.UserInfo removeAvatar(HttpSession session) {
        AppUser user = AuthController.currentUser(session, users);
        user.avatar = null;
        user.avatarType = null;
        return AuthController.UserInfo.of(users.save(user));
    }
}
