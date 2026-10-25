package com.vaxbridge.server;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** An original photo or PDF of a saved record, kept so the nurse can compare against it later. */
@Entity
public class RecordFile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(nullable = false)
    Long recordId;

    String name;
    String contentType;
    long size;

    @JdbcTypeCode(SqlTypes.LONG32VARBINARY)  // "bytea" in PostgreSQL
    @Column(nullable = false)
    byte[] data;

    protected RecordFile() {
    }

    RecordFile(Long recordId, String name, String contentType, byte[] data) {
        this.recordId = recordId;
        this.name = name;
        this.contentType = contentType;
        this.size = data.length;
        this.data = data;
    }
}
