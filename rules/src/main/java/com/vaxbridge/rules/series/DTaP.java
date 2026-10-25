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
import java.util.ArrayList;

/**
 * Diphtheria, tetanus, pertussis. DTaP before age 7; Tdap or Td from age 7.
 * Also covers the adolescent Tdap booster at age 11-12.
 */
public class DTaP extends Series {
    public String key() { return "DTaP"; }
    public String name() { return "Diphtheria, tetanus, pertussis (DTaP / Tdap)"; }
    public Set<Antigen> antigens() { return Set.of(Antigen.DTaP, Antigen.DT, Antigen.Tdap, Antigen.Td); }

    protected String check(List<LocalDate> valid, LocalDate date, LocalDate dob) {
        int n = valid.size();
        if (n == 0) return ageReason(dob, date, weeks(6), "6 weeks");
        boolean under7 = !ageAtLeast(dob, date, years(7));
        boolean firstBefore1 = valid.get(0).isBefore(dob.plus(years(1)));
        if (n == 1 || (n == 2 && (under7 || firstBefore1))) {
            return intervalReason(last(valid), date, weeks(4), "4 weeks");
        }
        if (n == 2) {  // age 7+, first dose at or after the 1st birthday
            return intervalReason(last(valid), date, months(6), "6 months");
        }
        if (n == 3) {
            String reason = intervalReason(last(valid), date, months(6), "6 months");
            if (reason.isEmpty() && under7) reason = ageReason(dob, date, months(12), "12 months for dose 4");
            return reason;
        }
        if (n == 4) {
            return firstOf(intervalReason(last(valid), date, months(6), "6 months"),
                    ageReason(dob, date, years(4), "4 years for dose 5"));
        }
        return "";
    }

    boolean childhoodComplete(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        int n = valid.size();
        if (ageAtLeast(dob, on, years(7))) {
            if (n == 0) return false;
            int needed = valid.get(0).isBefore(dob.plus(years(1))) ? 4 : 3;
            return n >= needed;
        }
        if (n >= 5) return true;
        // Dose 5 isn't needed if dose 4 was given at age 4+ and 6+ months after dose 3.
        return n == 4 && atLeast(dob, valid.get(3), years(4)) && spaced(valid.get(2), valid.get(3), months(6));
    }

    protected boolean complete(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        if (!childhoodComplete(valid, dob, on)) return false;
        if (ageAtLeast(dob, on, years(11))) {
            // Adolescent Tdap: a dose at age 10 or older counts.
            return valid.stream().anyMatch(d -> atLeast(dob, d, years(10)));
        }
        return true;
    }

    protected LocalDate earliestNext(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        int n = valid.size();
        if (n > 0 && childhoodComplete(valid, dob, on)) {
            return latest(dob.plus(years(11)), last(valid).plus(weeks(4)));
        }
        if (n == 0) return dob.plus(weeks(6));
        boolean age7 = ageAtLeast(dob, on, years(7));
        boolean firstBefore1 = valid.get(0).isBefore(dob.plus(years(1)));
        if (n == 1 || (n == 2 && (!age7 || firstBefore1))) return last(valid).plus(weeks(4));
        if (n == 2) return last(valid).plus(months(6));
        if (n == 3) return latest(last(valid).plus(months(6)), dob.plus(months(12)));
        return latest(last(valid).plus(months(6)), dob.plus(years(4)));
    }

    @Override
    public SeriesResult evaluate(List<Dose> doses, LocalDate dob, LocalDate today, List<LocalDate> liveDates) {
        SeriesResult result = super.evaluate(doses, dob, today, liveDates);
        if (result.status != Status.COMPLETE && ageAtLeast(dob, today, years(7))) {
            result.notes.add(0, "At age 7+, catch-up doses are Tdap or Td (not DTaP). "
                    + "The first catch-up dose should be Tdap.");
        }
        if (result.status == Status.COMPLETE && !ageAtLeast(dob, today, years(11))) {
            result.notes.add(0, "Adolescent Tdap booster will be due at age 11-12 (on or after "
                    + format(dob.plus(years(11))) + ").");
        }
        return result;
    }

    protected List<String> notes(List<Dose> doses, LocalDate dob, LocalDate today) {
        List<String> notes = new ArrayList<>();
        if (doses.stream().anyMatch(d -> d.antigen() == Antigen.DT)) {
            notes.add("Record includes DT (no pertussis component). It counts toward tetanus/diphtheria; "
                    + "provider may confirm whether pertussis protection is adequate.");
        }
        return notes;
    }
}
