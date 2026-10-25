package com.vaxbridge.server;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxbridge.rules.Antigen;
import com.vaxbridge.rules.Dose;
import com.vaxbridge.rules.Report;
import com.vaxbridge.rules.VaccineRules;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * JSON API used by the website. A future mobile app can call the same endpoints.
 *
 * <ul>
 *   <li>POST /api/extract  - upload photos/PDF of a record, get the entries the AI read</li>
 *   <li>POST /api/evaluate - send the nurse-reviewed entries, get the catch-up report</li>
 *   <li>GET  /api/sample   - a made-up record for demos (no API key needed)</li>
 *   <li>GET  /api/antigens - the antigen codes and their names</li>
 * </ul>
 */
@RestController
@RequestMapping("/api")
public class ApiController {
    private final RecordReader reader;
    private final ObjectMapper json;

    public ApiController(RecordReader reader, ObjectMapper json) {
        this.reader = reader;
        this.json = json;
    }

    public record EntryInput(List<String> antigens, LocalDate date, String originalText) {
    }

    public record EvaluateRequest(LocalDate dateOfBirth, LocalDate asOf, List<EntryInput> entries) {
    }

    @GetMapping("/antigens")
    public Map<String, String> antigens() {
        Map<String, String> result = new LinkedHashMap<>();
        for (Antigen a : Antigen.values()) {
            result.put(a.name(), a.label);
        }
        return result;
    }

    @GetMapping("/sample")
    public ExtractedRecord sample() throws IOException {
        try (InputStream in = getClass().getResourceAsStream("/sample-record.json")) {
            return json.readValue(in, ExtractedRecord.class);
        }
    }

    @PostMapping("/extract")
    public ExtractedRecord extract(@RequestParam("files") List<MultipartFile> files) throws IOException {
        List<RecordReader.Upload> uploads = new ArrayList<>();
        for (MultipartFile f : files) {
            uploads.add(new RecordReader.Upload(f.getBytes(), f.getContentType()));
        }
        return reader.read(uploads);
    }

    @PostMapping("/evaluate")
    public Report evaluate(@RequestBody EvaluateRequest request) {
        return evaluate(request.dateOfBirth(), request.asOf(), request.entries());
    }

    /** Runs the rules engine on reviewed entries. Entries without a date are skipped. */
    static Report evaluate(LocalDate dateOfBirth, LocalDate asOf, List<EntryInput> entries) {
        if (dateOfBirth == null) {
            throw new IllegalArgumentException("Date of birth is required.");
        }
        List<Dose> doses = new ArrayList<>();
        for (EntryInput entry : entries) {
            if (entry.date() == null || entry.antigens() == null) {
                continue;
            }
            for (String code : entry.antigens()) {
                Antigen antigen = parseAntigen(code);
                if (antigen != null) {
                    doses.add(new Dose(antigen, entry.date(), entry.originalText() == null ? "" : entry.originalText()));
                }
            }
        }
        return VaccineRules.evaluate(doses, dateOfBirth, asOf);
    }

    private static Antigen parseAntigen(String code) {
        try {
            return Antigen.valueOf(code);
        } catch (IllegalArgumentException | NullPointerException e) {
            return null;
        }
    }

    @ExceptionHandler(RecordReader.ReadException.class)
    public ResponseEntity<Map<String, String>> readFailed(RecordReader.ReadException e) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> badRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
}
