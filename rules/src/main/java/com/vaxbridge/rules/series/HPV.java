package com.vaxbridge.rules.series;

import static com.vaxbridge.rules.Series.*;

import com.vaxbridge.rules.Antigen;
import com.vaxbridge.rules.Dose;
import com.vaxbridge.rules.Series;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/** HPV: 2 doses if started before age 15, otherwise 3. */
public class HPV extends Series {
    public String key() { return "HPV"; }
    public String name() { return "Human papillomavirus (HPV)"; }
    public Set<Antigen> antigens() { return Set.of(Antigen.HPV); }

    protected String notApplicable(LocalDate dob, LocalDate today) {
        return ageAtLeast(dob, today, years(11)) ? "" : "Not due until age 11-12 (may start at age 9).";
    }

    protected String check(List<LocalDate> valid, LocalDate date, LocalDate dob) {
        if (valid.isEmpty()) return ageReason(dob, date, years(9), "9 years");
        if (valid.size() == 1) return intervalReason(last(valid), date, weeks(4), "4 weeks");
        return firstOf(intervalReason(last(valid), date, weeks(12), "12 weeks"),
                intervalReason(valid.get(0), date, months(5), "5 months after dose 1"));
    }

    protected boolean complete(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        if (valid.isEmpty()) return false;
        boolean startedBefore15 = valid.get(0).isBefore(dob.plus(years(15)));
        if (startedBefore15 && valid.size() >= 2 && spaced(valid.get(0), valid.get(1), months(5))) return true;
        return valid.size() >= 3;
    }

    protected LocalDate earliestNext(List<LocalDate> valid, LocalDate dob, LocalDate on) {
        int n = valid.size();
        if (n == 0) return dob.plus(years(9));
        if (n == 1) {
            // 2-dose series (started before 15): 6-12 months apart. 3-dose series: 4 weeks.
            return valid.get(0).isBefore(dob.plus(years(15))) ? valid.get(0).plus(months(6)) : valid.get(0).plus(weeks(4));
        }
        return latest(last(valid).plus(weeks(12)), valid.get(0).plus(months(5)));
    }

    protected List<String> notes(List<Dose> doses, LocalDate dob, LocalDate today) {
        return List.of("HPV is recommended but is not required for school entry in most states.");
    }
}
