package com.vaxbridge.rules;

import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

/**
 * One vaccine series (for example hepatitis B). Each subclass encodes the CDC
 * catch-up rules for that vaccine using three methods, all written in terms of the
 * list of valid doses so far:
 *
 * <ul>
 *   <li>{@link #check}: why a dose on a given date would not count, or "" if it counts</li>
 *   <li>{@link #complete}: is the series finished as of a date?</li>
 *   <li>{@link #earliestNext}: earliest date the next dose may be given</li>
 * </ul>
 *
 * The base class uses them to validate the child's history and project the
 * remaining catch-up doses.
 */
public abstract class Series {
    /** CDC: doses given up to 4 days early still count. */
    public static final int GRACE_DAYS = 4;
    /** Live vaccines must be given the same day or at least 28 days apart (no grace period). */
    public static final int LIVE_SPACING_DAYS = 28;

    private static final int MAX_PROJECTED_DOSES = 6;
    private static final DateTimeFormatter FORMAT = DateTimeFormatter.ofPattern("MMM d, yyyy");

    public abstract String key();

    public abstract String name();

    public abstract Set<Antigen> antigens();

    /** Return "" if the series applies to a child this age, otherwise why it doesn't. */
    protected String notApplicable(LocalDate dob, LocalDate today) {
        return "";
    }

    protected abstract String check(List<LocalDate> valid, LocalDate date, LocalDate dob);

    protected abstract boolean complete(List<LocalDate> valid, LocalDate dob, LocalDate on);

    protected abstract LocalDate earliestNext(List<LocalDate> valid, LocalDate dob, LocalDate on);

    /** For doses that never count, whatever the timing (for example OPV after 2016). */
    protected String neverCounts(Dose dose) {
        return "";
    }

    protected List<String> notes(List<Dose> doses, LocalDate dob, LocalDate today) {
        return List.of();
    }

    public SeriesResult evaluate(List<Dose> allDoses, LocalDate dob, LocalDate today, List<LocalDate> liveDates) {
        List<Dose> mine = allDoses.stream()
                .filter(d -> antigens().contains(d.antigen()))
                .sorted(Comparator.comparing(Dose::given))
                .toList();

        List<DoseResult> results = new ArrayList<>();
        List<LocalDate> valid = new ArrayList<>();
        for (Dose dose : mine) {
            String reason = neverCounts(dose);
            if (reason.isEmpty() && dose.given().isBefore(dob)) {
                reason = "Date is before the date of birth; please check the record.";
            }
            if (reason.isEmpty() && dose.given().isAfter(today)) {
                reason = "Date is in the future; please check the record.";
            }
            if (reason.isEmpty()) {
                reason = check(valid, dose.given(), dob);
            }
            if (reason.isEmpty() && dose.antigen().isLive()) {
                reason = liveConflict(dose.given(), liveDates);
            }
            results.add(new DoseResult(dose.given(), dose.antigen(), reason.isEmpty(), reason, dose.sourceText()));
            if (reason.isEmpty()) {
                valid.add(dose.given());
            }
        }

        SeriesResult result = new SeriesResult(key(), name(), results);
        result.notes.addAll(notes(mine, dob, today));

        String skip = notApplicable(dob, today);
        if (!skip.isEmpty() && valid.isEmpty()) {
            result.status = Status.NOT_NEEDED;
            result.summary = skip;
            return result;
        }
        if (complete(valid, dob, today)) {
            result.summary = "Complete: " + valid.size() + " valid dose(s).";
            return result;
        }
        if (!skip.isEmpty()) {
            result.status = Status.NOT_NEEDED;
            result.summary = skip;
            return result;
        }

        // Project the catch-up plan: each future dose at the earliest allowed date.
        List<LocalDate> projected = new ArrayList<>(valid);
        LocalDate on = today;
        for (int i = 0; i < MAX_PROJECTED_DOSES; i++) {
            LocalDate next = latest(earliestNext(projected, dob, on), today);
            projected.add(next);
            result.nextDoses.add(next);
            on = next;
            if (complete(projected, dob, next)) {
                break;
            }
        }

        LocalDate first = result.nextDoses.get(0);
        int count = result.nextDoses.size();
        if (!first.isAfter(today)) {
            result.status = Status.DUE;
            result.summary = "Needs " + count + " more dose(s). Next dose is due now.";
        } else {
            result.status = Status.UPCOMING;
            result.summary = "Up to date for now. Next dose on or after " + format(first)
                    + " (" + count + " more dose(s) in total).";
        }
        return result;
    }

    // --- helpers shared by the vaccine classes ---------------------------------

    public static Period weeks(int n) {
        return Period.ofWeeks(n);
    }

    public static Period months(int n) {
        return Period.ofMonths(n);
    }

    public static Period years(int n) {
        return Period.ofYears(n);
    }

    /** Was the child at least minAge old on this date (allowing the 4-day grace period)? */
    public static boolean atLeast(LocalDate dob, LocalDate on, Period minAge) {
        return !on.isBefore(dob.plus(minAge).minusDays(GRACE_DAYS));
    }

    /** Same as atLeast, but exact: used for "current age" rules, not dose validity. */
    public static boolean ageAtLeast(LocalDate dob, LocalDate on, Period age) {
        return !on.isBefore(dob.plus(age));
    }

    /** Was {@code later} at least {@code gap} after {@code earlier} (with grace)? */
    public static boolean spaced(LocalDate earlier, LocalDate later, Period gap) {
        return !later.isBefore(earlier.plus(gap).minusDays(GRACE_DAYS));
    }

    public static String intervalReason(LocalDate prev, LocalDate date, Period gap, String label) {
        if (!spaced(prev, date, gap)) {
            return "Too soon after the previous dose (" + format(prev) + "); needs at least " + label + ".";
        }
        return "";
    }

    public static String ageReason(LocalDate dob, LocalDate date, Period minAge, String label) {
        if (!atLeast(dob, date, minAge)) {
            return "Given before the minimum age of " + label + ".";
        }
        return "";
    }

    /** Returns the first non-empty reason. */
    public static String firstOf(String... reasons) {
        for (String r : reasons) {
            if (!r.isEmpty()) {
                return r;
            }
        }
        return "";
    }

    public static LocalDate latest(LocalDate... dates) {
        LocalDate max = dates[0];
        for (LocalDate d : dates) {
            if (d.isAfter(max)) {
                max = d;
            }
        }
        return max;
    }

    public static LocalDate last(List<LocalDate> dates) {
        return dates.get(dates.size() - 1);
    }

    public static String format(LocalDate date) {
        return date.format(FORMAT);
    }

    static String liveConflict(LocalDate date, List<LocalDate> liveDates) {
        for (LocalDate other : liveDates) {
            long days = java.time.temporal.ChronoUnit.DAYS.between(other, date);
            if (days > 0 && days < LIVE_SPACING_DAYS) {
                return "Given " + days + " days after another live vaccine (" + format(other) + "). "
                        + "Live vaccines must be given the same day or at least 28 days apart.";
            }
        }
        return "";
    }
}
