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

/** Meningococcal ACWY: one dose at 11-12, booster at 16. */
public class MenACWY extends Series {
    public String key() { return "MenACWY"; }
    public String name() { return "Meningococcal ACWY"; }
    public Set<Antigen> antigens() { return Set.of(Antigen.MenACWY); }

    protected String notApplicable(LocalDate dob, LocalDate today) {
        return ageAtLeast(dob, today, years(11)) ? "" : "Not due until age 11-12.";
    }

    protected String check(List<LocalDate> valid, LocalDate date, LocalDate dob) {
        if (valid.isEmpty()) return "";  // doses before age 10 are allowed but don't count (see complete)
        return intervalReason(last(valid), date, weeks(8), "8 weeks");
    }

    private List<LocalDate> teenDoses(List<LocalDate> valid, LocalDate dob) {
        return valid.stream().filter(d -> atLeast(dob, d, years(10))).toList();
    }

    protected boolean complete(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        List<LocalDate> teen = teenDoses(valid, dob);
        if (ageAtLeast(dob, on, years(16))) {
            return teen.stream().anyMatch(d -> atLeast(dob, d, years(16)));
        }
        return !teen.isEmpty();
    }

    protected LocalDate earliestNext(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        List<LocalDate> teen = teenDoses(valid, dob);
        if (teen.isEmpty()) {
            return valid.isEmpty() ? dob.plus(years(11)) : latest(dob.plus(years(11)), last(valid).plus(weeks(8)));
        }
        return latest(dob.plus(years(16)), last(teen).plus(weeks(8)));
    }

    @Override
    public SeriesResult evaluate(List<Dose> doses, LocalDate dob, LocalDate today, List<LocalDate> liveDates) {
        SeriesResult result = super.evaluate(doses, dob, today, liveDates);
        if (result.status == Status.NOT_NEEDED || ageAtLeast(dob, today, years(16))) {
            return result;
        }
        LocalDate booster = dob.plus(years(16));
        if (result.status == Status.COMPLETE) {
            result.status = Status.UPCOMING;
            result.summary = "Up to date for now. Booster dose on or after " + format(booster) + " (age 16).";
            result.nextDoses.add(booster);
        } else {
            result.nextDoses.add(booster);
            result.notes.add("A booster dose is also due at age 16.");
        }
        return result;
    }
}
