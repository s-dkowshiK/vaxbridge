package com.vaxbridge.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ApiControllerTest {
    @Autowired
    MockMvc mvc;

    @Test
    void sampleRecordLoads() throws Exception {
        mvc.perform(get("/api/sample"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dateOfBirth").value("2017-09-14"));
    }

    @Test
    void evaluateReturnsReport() throws Exception {
        String body = """
                {"dateOfBirth": "2017-09-14", "asOf": "2026-10-22",
                 "entries": [{"antigens": ["MMR"], "date": "2018-09-20", "originalText": "SPR 1a"},
                             {"antigens": ["OPV"], "date": "2018-01-15", "originalText": "bOPV"}]}
                """;
        mvc.perform(post("/api/evaluate").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.series[?(@.key == 'MMR')].status").value("DUE"))
                .andExpect(jsonPath("$.series[?(@.key == 'Polio')].doses[0].valid").value(false));
    }

    @Test
    void aiRequestBuildsWithoutCallingTheApi() {
        // Checks the structured-output schema and image block are accepted by the SDK.
        byte[] png = {(byte) 0x89, 'P', 'N', 'G'};
        var params = RecordReader.buildRequest(List.of(new RecordReader.Upload(png, "image/png")));
        assertThat(params.rawParams().model().asString()).isEqualTo("claude-opus-5-5");
    }
}
