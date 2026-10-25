package com.vaxbridge.server;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Database access for saved records. Every lookup includes the owner, so users only see their own. */
public interface RecordRepository extends JpaRepository<SavedRecord, Long> {
    List<SavedRecord> findByOwnerIdOrderByUpdatedAtDesc(Long ownerId);

    Optional<SavedRecord> findByIdAndOwnerId(Long id, Long ownerId);
}
