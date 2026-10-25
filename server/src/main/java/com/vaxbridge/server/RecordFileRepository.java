package com.vaxbridge.server;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

/** Database access for the original photos and PDFs of saved records. */
public interface RecordFileRepository extends JpaRepository<RecordFile, Long> {
    /** File details for lists, without loading the file bytes. */
    @Query("select new com.vaxbridge.server.FileInfo(f.id, f.name, f.contentType, f.size)"
            + " from RecordFile f where f.recordId = ?1 order by f.id")
    List<FileInfo> findInfoByRecordId(Long recordId);

    Optional<RecordFile> findByIdAndRecordId(Long id, Long recordId);

    @Transactional
    void deleteByRecordId(Long recordId);
}
