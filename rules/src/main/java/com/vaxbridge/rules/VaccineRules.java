package com.vaxbridge.rules;

import com.vaxbridge.rules.series.DTaP;
import com.vaxbridge.rules.series.HPV;
import com.vaxbridge.rules.series.HepA;
import com.vaxbridge.rules.series.HepB;
import com.vaxbridge.rules.series.Hib;
import com.vaxbridge.rules.series.MMR;
import com.vaxbridge.rules.series.MenACWY;
import com.vaxbridge.rules.series.PCV;
import com.vaxbridge.rules.series.Polio;
import com.vaxbridge.rules.series.Rotavirus;
import com.vaxbridge.rules.series.Varicella;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Entry point: compares a child's vaccine history with the US catch-up schedule.
 *
 * <p>Everything here is plain, deterministic Java so a nurse (or a judge) can see
 * exactly why a dose was or wasn't counted. No AI is used in this module.
 *
 * <p>Source: CDC Catch-up Immunization Schedule for ages 4 months-18 years and the
 * CDC General Best Practice Guidelines (4-day grace period, live vaccine spacing).
 * The output is decision support only; a licensed provider must review it.
 */
public final class VaccineRules {
    public static final List<Series> SERIES = List.of(
            new HepB(), new Rotavirus(), new DTaP(), new Hib(), new PCV(), new Polio(),
            new MMR(), new Varicella(), new HepA(), new MenACWY(), new HPV());

    private VaccineRules() {
    }

    public static Report evaluate(List<Dose> doses, LocalDate dateOfBirth, LocalDate asOf) {
        LocalDate today = asOf != null ? asOf : LocalDate.now();
        List<LocalDate> liveDates = doses.stream()
                .filter(d -> d.antigen().isLive())
                .map(Dose::given)
                .distinct()
                .sorted()
                .toList();

        List<SeriesResult> results = SERIES.stream()
                .map(s -> s.evaluate(doses, dateOfBirth, today, liveDates))
                .toList();

        Set<Antigen> known = EnumSet.noneOf(Antigen.class);
        SERIES.forEach(s -> known.addAll(s.antigens()));
        List<DoseResult> ignored = doses.stream()
                .filter(d -> !known.contains(d.antigen()))
                .map(d -> new DoseResult(d.given(), d.antigen(), false,
                        d.antigen() == Antigen.BCG
                                ? "BCG is not part of the US schedule; no action needed."
                                : "Not part of the US routine childhood schedule.",
                        d.sourceText()))
                .toList();

        return new Report(dateOfBirth, today, results, ignored);
    }
}
