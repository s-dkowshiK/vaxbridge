package com.vaxbridge.rules.series;

import static com.vaxbridge.rules.Series.*;

import com.vaxbridge.rules.Antigen;
import com.vaxbridge.rules.Dose;
import com.vaxbridge.rules.Series;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/** Polio. The final dose must be on or after the 4th birthday. */
public class Polio extends Series {
    /** Only trivalent OPV, used before this date, counts toward the US polio series. */
    public static final LocalDate OPV_CUTOFF = LocalDate.of(2016, 4, 1);

    public String key() { return "Polio"; }
    public String name() { return "Polio (IPV)"; }
    public Set<Antigen> antigens() { return Set.of(Antigen.IPV, Antigen.OPV); }

    protected String notApplicable(LocalDate dob, LocalDate today) {
        return ageAtLeast(dob, today, years(18))
                ? "Polio catch-up is not routinely recommended at age 18 and older." : "";
    }

    protected String neverCounts(Dose dose) {
        if (dose.antigen() == Antigen.OPV && !dose.given().isBefore(OPV_CUTOFF)) {
            return "Oral polio given on or after April 1, 2016 was bivalent OPV and does not count "
                    + "toward the US polio series.";
        }
        return "";
    }

    protected String check(List<LocalDate> valid, LocalDate date, LocalDate dob) {
        if (valid.isEmpty()) return ageReason(dob, date, weeks(6), "6 weeks");
        return intervalReason(last(valid), date, weeks(4), "4 weeks");
    }

    protected boolean complete(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        // At least 3 doses, and the last one on/after the 4th birthday and 6+ months after the one before.
        if (valid.size() < 3) return false;
        LocalDate lastDose = last(valid);
        LocalDate prev = valid.get(valid.size() - 2);
        return atLeast(dob, lastDose, years(4)) && spaced(prev, lastDose, months(6));
    }

    protected LocalDate earliestNext(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        int n = valid.size();
        if (n == 0) return dob.plus(weeks(6));
        if (n == 1) return last(valid).plus(weeks(4));
        if (n == 2 && !ageAtLeast(dob, on, years(4))) return last(valid).plus(weeks(4));
        return latest(last(valid).plus(months(6)), dob.plus(years(4)));
    }

    protected List<String> notes(List<Dose> doses, LocalDate dob, LocalDate today) {
        if (doses.stream().anyMatch(d -> d.antigen() == Antigen.OPV && d.given().isBefore(OPV_CUTOFF))) {
            return List.of("Oral polio before April 1, 2016 counts only if it was trivalent OPV (tOPV). "
                    + "Provider should confirm the record is plausible.");
        }
        return List.of();
    }
}
