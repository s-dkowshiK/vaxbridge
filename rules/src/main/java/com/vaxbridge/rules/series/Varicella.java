package com.vaxbridge.rules.series;

import static com.vaxbridge.rules.Series.*;

import com.vaxbridge.rules.Antigen;
import com.vaxbridge.rules.Dose;
import com.vaxbridge.rules.Series;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/** Varicella (chickenpox): 2 doses from 12 months. */
public class Varicella extends Series {
    public String key() { return "VAR"; }
    public String name() { return "Varicella (chickenpox)"; }
    public Set<Antigen> antigens() { return Set.of(Antigen.VAR); }

    protected String check(List<LocalDate> valid, LocalDate date, LocalDate dob) {
        if (valid.isEmpty()) return ageReason(dob, date, months(12), "12 months");
        // Recommended 3 months apart under age 13, but a dose 4+ weeks later is accepted as valid.
        return intervalReason(last(valid), date, weeks(4), "4 weeks");
    }

    protected boolean complete(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        return valid.size() >= 2;
    }

    protected LocalDate earliestNext(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        if (valid.isEmpty()) return dob.plus(months(12));
        if (ageAtLeast(dob, on, years(13))) return last(valid).plus(weeks(4));
        return latest(last(valid).plus(months(3)), dob.plus(years(4)));
    }

    protected List<String> notes(List<Dose> doses, LocalDate dob, LocalDate today) {
        return List.of("If the child has had chickenpox, a provider can document this as evidence of immunity "
                + "instead of vaccination.");
    }
}
