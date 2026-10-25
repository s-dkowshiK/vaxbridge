package com.vaxbridge.server;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.Locale;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Accounts. Signing in stores the user's id in the server session (a cookie in the browser).
 *
 * <ul>
 *   <li>POST /api/auth/signup - {name, email, password} creates an account and signs in</li>
 *   <li>POST /api/auth/login  - {email, password}</li>
 *   <li>POST /api/auth/logout</li>
 *   <li>GET  /api/auth/me     - the signed-in user, or 401</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    static final String SESSION_KEY = "userId";
    private static final BCryptPasswordEncoder PASSWORDS = new BCryptPasswordEncoder();

    private final UserRepository users;

    public AuthController(UserRepository users) {
        this.users = users;
    }

    public record SignupRequest(String name, String email, String password) {
    }

    public record LoginRequest(String email, String password) {
    }

    public record UserInfo(Long id, String name, String email) {
        static UserInfo of(AppUser u) {
            return new UserInfo(u.id, u.name, u.email);
        }
    }

    @PostMapping("/signup")
    public UserInfo signup(@RequestBody SignupRequest req, HttpServletRequest http) {
        String name = req.name() == null ? "" : req.name().trim();
        String email = normalize(req.email());
        if (name.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Enter your name.");
        }
        if (!email.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
        }
        if (req.password() == null || req.password().length() < 8) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Use a password with at least 8 characters.");
        }
        if (users.findByEmail(email).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "An account with this email already exists. Sign in instead.");
        }
        AppUser user = users.save(new AppUser(name, email, PASSWORDS.encode(req.password())));
        signIn(http, user);
        return UserInfo.of(user);
    }

    @PostMapping("/login")
    public UserInfo login(@RequestBody LoginRequest req, HttpServletRequest http) {
        AppUser user = users.findByEmail(normalize(req.email()))
                .filter(u -> req.password() != null && PASSWORDS.matches(req.password(), u.passwordHash))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect."));
        signIn(http, user);
        return UserInfo.of(user);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest http) {
        HttpSession session = http.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public UserInfo me(HttpSession session) {
        return UserInfo.of(currentUser(session, users));
    }

    /** The signed-in user, or a 401 error. */
    static AppUser currentUser(HttpSession session, UserRepository users) {
        if (session.getAttribute(SESSION_KEY) instanceof Long userId) {
            Optional<AppUser> user = users.findById(userId);
            if (user.isPresent()) {
                return user.get();
            }
        }
        throw new ApiException(HttpStatus.UNAUTHORIZED, "Sign in to see saved records.");
    }

    private static void signIn(HttpServletRequest http, AppUser user) {
        http.getSession(true);
        http.changeSessionId();  // a fresh session id at sign-in, so an old cookie can't be reused
        http.getSession().setAttribute(SESSION_KEY, user.id);
    }

    private static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
