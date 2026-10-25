package com.vaxbridge.server;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

// MockMvc keeps sessions itself, so these tests use plain servlet sessions instead of Spring Session.
@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:records-test",
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.session.SessionAutoConfiguration"})
@AutoConfigureMockMvc
class RecordsControllerTest {
    @Autowired
    MockMvc mvc;
    @Autowired
    ObjectMapper json;

    private MockHttpSession signUp(String email) throws Exception {
        MockHttpSession session = new MockHttpSession();
        mvc.perform(post("/api/auth/signup").session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Pat Nurse\", \"email\": \"" + email + "\", \"password\": \"correct horse\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Pat Nurse"));
        return session;
    }

    private byte[] sampleRecord() throws Exception {
        try (InputStream in = getClass().getResourceAsStream("/sample-record.json")) {
            return in.readAllBytes();
        }
    }

    private static String email() {
        return UUID.randomUUID() + "@school.example";
    }

    @Test
    void savesListsOpensUpdatesAndDeletesARecord() throws Exception {
        MockHttpSession session = signUp(email());
        MockMultipartFile record = new MockMultipartFile("record", "", "application/json", sampleRecord());
        MockMultipartFile photo = new MockMultipartFile("files", "card.png", "image/png", new byte[] {1, 2, 3});

        String saved = mvc.perform(multipart("/api/records").file(record).file(photo).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.childName").value("Sofía Ejemplo (sample)"))
                .andExpect(jsonPath("$.fileCount").value(1))
                .andExpect(jsonPath("$.counts.DUE").isNumber())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(saved).get("id").asLong();

        mvc.perform(get("/api/records").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));

        String detail = mvc.perform(get("/api/records/" + id).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.record.entries", hasSize(19)))
                .andExpect(jsonPath("$.report.series").isArray())
                .andExpect(jsonPath("$.files[0].name").value("card.png"))
                .andReturn().getResponse().getContentAsString();
        long fileId = json.readTree(detail).at("/files/0/id").asLong();

        mvc.perform(get("/api/records/" + id + "/files/" + fileId).session(session))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"))
                .andExpect(content().bytes(new byte[] {1, 2, 3}));

        String edited = new String(sampleRecord(), "UTF-8").replace("Sofía Ejemplo (sample)", "Sofía E.");
        mvc.perform(put("/api/records/" + id).session(session).contentType(MediaType.APPLICATION_JSON).content(edited))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.childName").value("Sofía E."))
                .andExpect(jsonPath("$.fileCount").value(1));

        mvc.perform(delete("/api/records/" + id).session(session)).andExpect(status().isNoContent());
        mvc.perform(get("/api/records").session(session)).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void usersOnlySeeTheirOwnRecords() throws Exception {
        MockHttpSession owner = signUp(email());
        String saved = mvc.perform(multipart("/api/records")
                        .file(new MockMultipartFile("record", "", "application/json", sampleRecord())).session(owner))
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(saved).get("id").asLong();

        MockHttpSession other = signUp(email());
        mvc.perform(get("/api/records").session(other)).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get("/api/records/" + id).session(other)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/records/" + id).session(other)).andExpect(status().isNotFound());
    }

    @Test
    void recordsNeedSignIn() throws Exception {
        mvc.perform(get("/api/records")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void signInChecksPasswordAndSignOutEndsSession() throws Exception {
        String email = email();
        signUp(email);

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"" + email + "\", \"password\": \"wrong password\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Email or password is incorrect."));

        MockHttpSession session = new MockHttpSession();
        mvc.perform(post("/api/auth/login").session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"" + email.toUpperCase() + "\", \"password\": \"correct horse\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").session(session)).andExpect(jsonPath("$.email").value(email));

        mvc.perform(post("/api/auth/logout").session(session)).andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void duplicateEmailAndShortPasswordAreRejected() throws Exception {
        String email = email();
        signUp(email);
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"A\", \"email\": \"" + email + "\", \"password\": \"another one\"}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"A\", \"email\": \"new@school.example\", \"password\": \"short\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void savingNeedsADateOfBirth() throws Exception {
        MockHttpSession session = signUp(email());
        byte[] noDob = new String(sampleRecord(), "UTF-8").replace("\"2017-09-14\",\n  \"country\"", "\"\",\n  \"country\"")
                .replaceFirst("\"dateOfBirth\"\\s*:\\s*\"2017-09-14\"", "\"dateOfBirth\": \"\"").getBytes("UTF-8");
        mvc.perform(multipart("/api/records")
                        .file(new MockMultipartFile("record", "", "application/json", noDob)).session(session))
                .andExpect(status().isBadRequest());
    }
}
