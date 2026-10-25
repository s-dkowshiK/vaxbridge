package com.vaxbridge.rules.series;

import static com.vaxbridge.rules.Series.*;

import com.vaxbridge.rules.Antigen;
import com.vaxbridge.rules.Dose;
import com.vaxbridge.rules.Series;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/**
 * Hib, for children under 5. Assumes PRP-T Hib, which is what almost all
 * combination vaccines outside the US contain.
 */
public class Hib extends Series {
    public String key() { return "Hib"; }
    public String name() { return "Haemophilus influenzae type b (Hib)"; }
    public Set<Antigen> antigens() { return Set.of(Antigen.Hib); }

    protected String notApplicable(LocalDate dob, LocalDate today) {
        return ageAtLeast(dob, today, years(5)) ? "Not routinely needed for healthy children age 5 and older." : "";
    }

    protected String check(List<LocalDate> valid, LocalDate date, LocalDate dob) {
        if (valid.isEmpty()) return ageReason(dob, date, weeks(6), "6 weeks");
        return intervalReason(last(valid), date, weeks(4), "4 weeks");
    }

    protected boolean complete(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        // Any dose at 15+ months finishes the series.
        if (valid.stream().anyMatch(d -> atLeast(dob, d, months(15)))) return true;
        // First dose at 12-14 months, then one more 8 weeks later.
        if (valid.size() >= 2 && atLeast(dob, valid.get(0), months(12)) && spaced(valid.get(0), valid.get(1), weeks(8))) {
            return true;
        }
        // Otherwise a booster at 12+ months, 8+ weeks after the previous dose, after at least 2 infant doses.
        int n = valid.size();
        return n >= 3 && atLeast(dob, last(valid), months(12)) && spaced(valid.get(n - 2), last(valid), weeks(8));
    }

    protected LocalDate earliestNext(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        int n = valid.size();
        if (n == 0) return dob.plus(weeks(6));
        boolean under1 = !ageAtLeast(dob, on, months(12));
        if (n == 1 && valid.get(0).isBefore(dob.plus(months(12)))) return last(valid).plus(weeks(4));
        if (n == 2 && under1 && valid.get(0).isBefore(dob.plus(months(7)))) return last(valid).plus(weeks(4));
        // The remaining dose is the final booster: 8 weeks later and at 12+ months.
        return latest(last(valid).plus(weeks(8)), dob.plus(months(12)));
    }
}
