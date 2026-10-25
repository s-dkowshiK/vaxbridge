package com.vaxbridge.server;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxbridge.rules.Report;
import com.vaxbridge.rules.SeriesResult;
import com.vaxbridge.rules.Status;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Saved records for the signed-in user. Each user only ever sees their own records.
 *
 * <ul>
 *   <li>GET    /api/records                - summaries for the dashboard, newest first</li>
 *   <li>POST   /api/records                - multipart: "record" (reviewed entries as JSON), optional "state" and "files"</li>
 *   <li>GET    /api/records/{id}           - the record, its report as of today, and its files</li>
 *   <li>PUT    /api/records/{id}?state=... - replace the reviewed entries, and the state if given (files are kept)</li>
 *   <li>DELETE /api/records/{id}</li>
 *   <li>GET    /api/records/{id}/files/{f} - an original photo or PDF</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/records")
public class RecordsController {
    static final Set<String> FILE_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf");

    private final UserRepository users;
    private final RecordRepository records;
    private final RecordFileRepository files;
    private final ObjectMapper json;

    public RecordsController(UserRepository users, RecordRepository records,
                             RecordFileRepository files, ObjectMapper json) {
        this.users = users;
        this.records = records;
        this.files = files;
        this.json = json;
    }

    /** What the dashboard shows for one saved record. Counts are as of today. */
    public record Summary(Long id, String childName, String dateOfBirth, String country, String language, String state,
                          Instant savedAt, Instant updatedAt, int entryCount, int fileCount,
                          Map<Status, Integer> counts, List<String> dueVaccines, LocalDate nextDose) {
    }

    public record Detail(Summary summary, ExtractedRecord record, Report report, List<FileInfo> files) {
    }

    @GetMapping
    public List<Summary> list(HttpSession session) {
        AppUser user = AuthController.currentUser(session, users);
        return records.findByOwnerIdOrderByUpdatedAtDesc(user.id).stream().map(this::summary).toList();
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Summary save(@RequestPart("record") ExtractedRecord record,
                        @RequestPart(value = "state", required = false) String state,
                        @RequestPart(value = "files", required = false) List<MultipartFile> uploads,
                        HttpSession session) throws IOException {
        AppUser user = AuthController.currentUser(session, users);
        report(record);  // checks the date of birth before anything is stored
        for (MultipartFile f : uploads == null ? List.<MultipartFile>of() : uploads) {
            if (!FILE_TYPES.contains(f.getContentType())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Only photos (JPG, PNG, GIF, WebP) and PDFs can be saved.");
            }
        }
        SavedRecord unsaved = new SavedRecord(user.id, toJson(record));
        unsaved.state = cleanState(state);
        SavedRecord saved = records.save(unsaved);
        for (MultipartFile f : uploads == null ? List.<MultipartFile>of() : uploads) {
            files.save(new RecordFile(saved.id, f.getOriginalFilename(), f.getContentType(), f.getBytes()));
        }
        return summary(saved);
    }

    @GetMapping("/{id}")
    public Detail get(@PathVariable("id") Long id, HttpSession session) {
        SavedRecord saved = owned(id, session);
        ExtractedRecord record = fromJson(saved.recordJson);
        return new Detail(summary(saved), record, report(record), files.findInfoByRecordId(saved.id));
    }

    @PutMapping("/{id}")
    public Summary update(@PathVariable("id") Long id, @RequestBody ExtractedRecord record,
                          @RequestParam(value = "state", required = false) String state, HttpSession session) {
        SavedRecord saved = owned(id, session);
        report(record);
        saved.recordJson = toJson(record);
        if (state != null) {
            saved.state = cleanState(state);
        }
        saved.updatedAt = Instant.now();
        return summary(records.save(saved));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") Long id, HttpSession session) {
        SavedRecord saved = owned(id, session);
        files.deleteByRecordId(saved.id);
        records.delete(saved);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/files/{fileId}")
    public ResponseEntity<byte[]> file(@PathVariable("id") Long id, @PathVariable("fileId") Long fileId, HttpSession session) {
        SavedRecord saved = owned(id, session);
        RecordFile f = files.findByIdAndRecordId(fileId, saved.id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "File not found."));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(f.contentType))
                .header("Content-Disposition", ContentDisposition.inline()
                        .filename(Objects.requireNonNullElse(f.name, "record"), StandardCharsets.UTF_8)
                        .build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .body(f.data);
    }

    /** A state name from the website's list; anything else is dropped. */
    private static String cleanState(String state) {
        if (state == null || state.isBlank()) {
            return null;
        }
        String s = state.trim();
        if (s.length() > 60 || !s.matches("[A-Za-z .()']+")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Choose a state from the list.");
        }
        return s;
    }

    private SavedRecord owned(Long id, HttpSession session) {
        AppUser user = AuthController.currentUser(session, users);
        return records.findByIdAndOwnerId(id, user.id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Record not found."));
    }

    private Summary summary(SavedRecord saved) {
        ExtractedRecord record = fromJson(saved.recordJson);
        Report report = report(record);
        Map<Status, Integer> counts = new LinkedHashMap<>();
        for (Status s : Status.values()) {
            counts.put(s, 0);
        }
        List<String> due = new ArrayList<>();
        LocalDate next = null;
        for (SeriesResult s : report.series()) {
            counts.merge(s.status, 1, Integer::sum);
            if (s.status == Status.DUE) {
                due.add(s.name);
            }
            if ((s.status == Status.DUE || s.status == Status.UPCOMING) && !s.nextDoses.isEmpty()
                    && (next == null || s.nextDoses.get(0).isBefore(next))) {
                next = s.nextDoses.get(0);
            }
        }
        int entries = record.entries() == null ? 0 : record.entries().size();
        return new Summary(saved.id, record.childName(), record.dateOfBirth(), record.country(), record.language(), saved.state,
                saved.savedAt, saved.updatedAt, entries, files.findInfoByRecordId(saved.id).size(), counts, due, next);
    }

    /** The catch-up report for a reviewed record, as of today. */
    static Report report(ExtractedRecord record) {
        LocalDate dob = parseDate(record.dateOfBirth());
        if (dob == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Enter the child's date of birth before saving.");
        }
        List<ApiController.EntryInput> entries = new ArrayList<>();
        for (ExtractedRecord.Entry e : record.entries() == null ? List.<ExtractedRecord.Entry>of() : record.entries()) {
            entries.add(new ApiController.EntryInput(e.antigens(), parseDate(e.date()), e.originalText()));
        }
        return ApiController.evaluate(dob, null, entries);
    }

    private static LocalDate parseDate(String s) {
        try {
            return s == null || s.isBlank() ? null : LocalDate.parse(s);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private String toJson(ExtractedRecord record) {
        try {
            return json.writeValueAsString(record);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private ExtractedRecord fromJson(String s) {
        try {
            return json.readValue(s, ExtractedRecord.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
