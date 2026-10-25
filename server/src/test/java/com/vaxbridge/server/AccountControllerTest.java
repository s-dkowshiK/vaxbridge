package com.vaxbridge.server;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

// MockMvc keeps sessions itself, so these tests use plain servlet sessions instead of Spring Session.
@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:account-test",
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.session.SessionAutoConfiguration"})
@AutoConfigureMockMvc
class AccountControllerTest {
    @Autowired
    MockMvc mvc;

    private MockHttpSession signUp(String email) throws Exception {
        MockHttpSession session = new MockHttpSession();
        mvc.perform(post("/api/auth/signup").session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Pat Nurse\", \"email\": \"" + email + "\", \"password\": \"correct horse\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasAvatar").value(false));
        return session;
    }

    private static String email() {
        return UUID.randomUUID() + "@school.example";
    }

    @Test
    void savesNameEmailAndTheme() throws Exception {
        MockHttpSession session = signUp(email());
        String newEmail = email();
        mvc.perform(put("/api/account").session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \" Nurse Pat \", \"email\": \"" + newEmail.toUpperCase()
                                + "\", \"theme\": {\"accent\": \"#4F46E5\", \"radius\": 8}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Nurse Pat"))
                .andExpect(jsonPath("$.email").value(newEmail));

        mvc.perform(get("/api/auth/me").session(session))
                .andExpect(jsonPath("$.theme.accent").value("#4F46E5"))
                .andExpect(jsonPath("$.theme.radius").value(8));

        // Leaving fields out keeps them; a null theme resets to the default look
        mvc.perform(put("/api/account").session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Nurse Pat\"}"))
                .andExpect(jsonPath("$.theme.accent").value("#4F46E5"));
        mvc.perform(put("/api/account").session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"theme\": null}"))
                .andExpect(jsonPath("$.name").value("Nurse Pat"))
                .andExpect(jsonPath("$.theme").isEmpty());
    }

    @Test
    void emailMustBeFreeAndValid() throws Exception {
        String taken = email();
        signUp(taken);
        MockHttpSession session = signUp(email());
        mvc.perform(put("/api/account").session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"" + taken + "\"}"))
                .andExpect(status().isConflict());
        mvc.perform(put("/api/account").session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"not an email\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/account").session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"  \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void changesPasswordOnlyWithTheCurrentOne() throws Exception {
        String email = email();
        MockHttpSession session = signUp(email);
        mvc.perform(put("/api/account/password").session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\": \"wrong\", \"newPassword\": \"battery staple\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Your current password is incorrect."));
        mvc.perform(put("/api/account/password").session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\": \"correct horse\", \"newPassword\": \"battery staple\"}"))
                .andExpect(status().isNoContent());

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"" + email + "\", \"password\": \"correct horse\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"" + email + "\", \"password\": \"battery staple\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void uploadsShowsAndRemovesAProfilePicture() throws Exception {
        MockHttpSession session = signUp(email());
        mvc.perform(multipart(HttpMethod.PUT, "/api/account/avatar").file(new MockMultipartFile("file", "me.png", "image/png", new byte[] {7, 8, 9})).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasAvatar").value(true));
        mvc.perform(get("/api/account/avatar").session(session))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(content().bytes(new byte[] {7, 8, 9}));

        mvc.perform(multipart(HttpMethod.PUT, "/api/account/avatar").file(new MockMultipartFile("file", "me.pdf", "application/pdf", new byte[] {1})).session(session))
                .andExpect(status().isBadRequest());
        mvc.perform(multipart(HttpMethod.PUT, "/api/account/avatar").file(new MockMultipartFile("file", "big.png", "image/png", new byte[3 * 1024 * 1024])).session(session))
                .andExpect(status().isBadRequest());

        mvc.perform(delete("/api/account/avatar").session(session))
                .andExpect(jsonPath("$.hasAvatar").value(false));
        mvc.perform(get("/api/account/avatar").session(session)).andExpect(status().isNotFound());
    }

    @Test
    void settingsNeedSignIn() throws Exception {
        mvc.perform(put("/api/account").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/account/avatar")).andExpect(status().isUnauthorized());
    }
}
