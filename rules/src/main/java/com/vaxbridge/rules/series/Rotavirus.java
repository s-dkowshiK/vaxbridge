package com.vaxbridge.rules.series;

import static com.vaxbridge.rules.Series.*;

import com.vaxbridge.rules.Antigen;
import com.vaxbridge.rules.Dose;
import com.vaxbridge.rules.Series;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import com.vaxbridge.rules.SeriesResult;
import com.vaxbridge.rules.Status;

/** Rotavirus: only for babies; no dose after 8 months of age. */
public class Rotavirus extends Series {
    public String key() { return "RV"; }
    public String name() { return "Rotavirus"; }
    public Set<Antigen> antigens() { return Set.of(Antigen.RV); }

    protected String notApplicable(LocalDate dob, LocalDate today) {
        return ageAtLeast(dob, today, months(8)) ? "Not given after 8 months of age." : "";
    }

    protected String check(List<LocalDate> valid, LocalDate date, LocalDate dob) {
        if (valid.isEmpty()) return ageReason(dob, date, weeks(6), "6 weeks");
        return intervalReason(last(valid), date, weeks(4), "4 weeks");
    }

    protected boolean complete(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        return valid.size() >= 3;
    }

    protected LocalDate earliestNext(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        return valid.isEmpty() ? dob.plus(weeks(6)) : last(valid).plus(weeks(4));
    }

    @Override
    public SeriesResult evaluate(List<Dose> doses, LocalDate dob, LocalDate today, List<LocalDate> liveDates) {
        SeriesResult result = super.evaluate(doses, dob, today, liveDates);
        LocalDate cutoff = dob.plus(months(8));
        result.nextDoses.removeIf(d -> !d.isBefore(cutoff));
        if (result.status == Status.DUE || result.status == Status.UPCOMING) {
            result.notes.add("Brand matters (2 doses for RV1, 3 for RV5); 3 doses assumed. "
                    + "No rotavirus dose may be given after 8 months of age.");
        }
        return result;
    }
}
