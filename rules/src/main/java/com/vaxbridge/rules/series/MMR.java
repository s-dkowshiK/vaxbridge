package com.vaxbridge.rules.series;

import static com.vaxbridge.rules.Series.*;

import com.vaxbridge.rules.Antigen;
import com.vaxbridge.rules.Dose;
import com.vaxbridge.rules.Series;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/** Measles, mumps, rubella: 2 doses from 12 months. */
public class MMR extends Series {
    public String key() { return "MMR"; }
    public String name() { return "Measles, mumps, rubella (MMR)"; }
    public Set<Antigen> antigens() { return Set.of(Antigen.MMR, Antigen.Measles, Antigen.MR); }

    protected String neverCounts(Dose dose) {
        if (dose.antigen() == Antigen.Measles || dose.antigen() == Antigen.MR) {
            return "Measles-only or measles-rubella vaccine. The US requires MMR, so this dose is not "
                    + "counted; provider may consider it for measles immunity.";
        }
        return "";
    }

    protected String check(List<LocalDate> valid, LocalDate date, LocalDate dob) {
        if (valid.isEmpty()) return ageReason(dob, date, months(12), "12 months");
        return intervalReason(last(valid), date, weeks(4), "4 weeks");
    }

    protected boolean complete(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        return valid.size() >= 2;
    }

    protected LocalDate earliestNext(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        if (valid.isEmpty()) return dob.plus(months(12));
        if (valid.size() == 1 && !ageAtLeast(dob, on, years(4))) {
            // Routine dose 2 is at age 4-6 (it may be given earlier, 4+ weeks after dose 1).
            return latest(last(valid).plus(weeks(4)), dob.plus(years(4)));
        }
        return last(valid).plus(weeks(4));
    }

    protected List<String> notes(List<Dose> doses, LocalDate dob, LocalDate today) {
        boolean early = doses.stream()
                .anyMatch(d -> d.antigen() == Antigen.MMR && !atLeast(dob, d.given(), months(12)));
        return early ? List.of("Measles-containing doses before age 12 months do not count toward the US series.")
                : List.of();
    }
}
