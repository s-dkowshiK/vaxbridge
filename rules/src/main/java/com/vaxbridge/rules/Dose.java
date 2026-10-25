package com.vaxbridge.rules;

import java.time.LocalDate;

/** One antigen given on one date, as read from the child's record. */
public record Dose(Antigen antigen, LocalDate given, String sourceText) {
    public Dose(Antigen antigen, LocalDate given) {
        this(antigen, given, "");
    }
}
