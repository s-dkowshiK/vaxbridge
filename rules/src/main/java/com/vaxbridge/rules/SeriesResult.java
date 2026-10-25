package com.vaxbridge.rules;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** The result for one vaccine (for example, polio) for one child. */
public class SeriesResult {
    public final String key;
    public final String name;
    public Status status = Status.COMPLETE;
    public String summary = "";
    public final List<DoseResult> doses;
    /** Earliest allowed date for each dose still needed (the catch-up plan). */
    public final List<LocalDate> nextDoses = new ArrayList<>();
    public final List<String> notes = new ArrayList<>();

    public SeriesResult(String key, String name, List<DoseResult> doses) {
        this.key = key;
        this.name = name;
        this.doses = doses;
    }
}
