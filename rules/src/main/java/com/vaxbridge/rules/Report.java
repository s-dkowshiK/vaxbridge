package com.vaxbridge.rules;

import java.time.LocalDate;
import java.util.List;

/** Everything the nurse sees: one result per vaccine plus doses that aren't part of the US schedule. */
public record Report(LocalDate dateOfBirth, LocalDate asOf, List<SeriesResult> series, List<DoseResult> ignored) {
}
