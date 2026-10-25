package com.vaxbridge.rules;

import java.time.LocalDate;

/** Whether a recorded dose counts toward the US series, and if not, why. */
public record DoseResult(LocalDate given, Antigen antigen, boolean valid, String reason, String sourceText) {
}
