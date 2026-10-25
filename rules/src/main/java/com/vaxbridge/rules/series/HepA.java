package com.vaxbridge.rules.series;

import static com.vaxbridge.rules.Series.*;

import com.vaxbridge.rules.Antigen;
import com.vaxbridge.rules.Dose;
import com.vaxbridge.rules.Series;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/** Hepatitis A: 2 doses, 6 months apart, from 12 months. */
public class HepA extends Series {
    public String key() { return "HepA"; }
    public String name() { return "Hepatitis A"; }
    public Set<Antigen> antigens() { return Set.of(Antigen.HepA); }

    protected String check(List<LocalDate> valid, LocalDate date, LocalDate dob) {
        if (valid.isEmpty()) return ageReason(dob, date, months(12), "12 months");
        return intervalReason(last(valid), date, months(6), "6 months");
    }

    protected boolean complete(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        return valid.size() >= 2;
    }

    protected LocalDate earliestNext(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        return valid.isEmpty() ? dob.plus(months(12)) : last(valid).plus(months(6));
    }
}
