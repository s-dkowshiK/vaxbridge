package com.vaxbridge.rules.series;

import static com.vaxbridge.rules.Series.*;

import com.vaxbridge.rules.Antigen;
import com.vaxbridge.rules.Dose;
import com.vaxbridge.rules.Series;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/** Hepatitis B: 3 doses. */
public class HepB extends Series {
    public String key() { return "HepB"; }
    public String name() { return "Hepatitis B"; }
    public Set<Antigen> antigens() { return Set.of(Antigen.HepB); }

    protected String check(List<LocalDate> valid, LocalDate date, LocalDate dob) {
        if (valid.size() == 1) {
            return intervalReason(valid.get(0), date, weeks(4), "4 weeks");
        }
        if (valid.size() == 2) {
            return firstOf(
                    intervalReason(valid.get(1), date, weeks(8), "8 weeks"),
                    intervalReason(valid.get(0), date, weeks(16), "16 weeks after dose 1"),
                    ageReason(dob, date, weeks(24), "24 weeks for the final dose"));
        }
        return "";
    }

    protected boolean complete(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        return valid.size() >= 3;
    }

    protected LocalDate earliestNext(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        if (valid.isEmpty()) return dob;
        if (valid.size() == 1) return valid.get(0).plus(weeks(4));
        return latest(valid.get(1).plus(weeks(8)), valid.get(0).plus(weeks(16)), dob.plus(weeks(24)));
    }
}
