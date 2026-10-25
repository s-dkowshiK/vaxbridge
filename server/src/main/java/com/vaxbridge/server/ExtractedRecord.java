package com.vaxbridge.server;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import java.util.List;

/**
 * What the AI reads off a vaccine record. The nurse reviews and corrects this
 * before the rules engine uses it. The same shape is used for the sample record.
 */
public record ExtractedRecord(
        @JsonPropertyDescription("Child's name as written, or empty if not visible") String childName,
        @JsonPropertyDescription("Date of birth as YYYY-MM-DD, or empty if not visible") String dateOfBirth,
        @JsonPropertyDescription("Country that issued the record, or empty") String country,
        @JsonPropertyDescription("Language of the record, or empty") String language,
        @JsonPropertyDescription("Problems the nurse should know about, such as unreadable parts") List<String> warnings,
        List<Entry> entries) {

    public record Entry(
            @JsonPropertyDescription("Vaccine name exactly as written on the record") String originalText,
            @JsonPropertyDescription("English translation of the vaccine name") String englishName,
            @JsonPropertyDescription("Antigen codes this vaccine contains") List<String> antigens,
            @JsonPropertyDescription("Date given as YYYY-MM-DD, or empty if unreadable") String date,
            @JsonPropertyDescription("Date exactly as written on the record") String dateAsWritten,
            @JsonPropertyDescription("high, or low if any part was guessed") String confidence,
            @JsonPropertyDescription("Explanation of any guess, or empty") String notes) {
    }
}
