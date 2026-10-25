package com.vaxbridge.server;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import java.time.Instant;

/**
 * A reviewed vaccine record saved to a user's account. Only the nurse-reviewed entries are stored;
 * the report is recalculated whenever the record is opened, so it is always current as of today.
 */
@Entity
public class SavedRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(nullable = false)
    Long ownerId;

    /** The {@link ExtractedRecord} after the nurse's review, as JSON. */
    @Lob
    @Column(nullable = false)
    String recordJson;

    Instant savedAt;
    Instant updatedAt;

    protected SavedRecord() {
    }

    SavedRecord(Long ownerId, String recordJson) {
        this.ownerId = ownerId;
        this.recordJson = recordJson;
        this.savedAt = Instant.now();
        this.updatedAt = savedAt;
    }
}
