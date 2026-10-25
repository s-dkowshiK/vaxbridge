package com.vaxbridge.rules;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class VaccineRulesTest {
    static final LocalDate DOB = LocalDate.of(2018, 3, 10);
    static final LocalDate TODAY = LocalDate.of(2026, 10, 22);  // child is 8

    static LocalDate d(int y, int m, int day) {
        return LocalDate.of(y, m, day);
    }

    static List<Dose> doses(Antigen antigen, LocalDate... dates) {
        List<Dose> list = new ArrayList<>();
        for (LocalDate date : dates) {
            list.add(new Dose(antigen, date));
        }
        return list;
    }

    static SeriesResult series(Report report, String key) {
        return report.series().stream().filter(s -> s.key.equals(key)).findFirst().orElseThrow();
    }

    static List<Boolean> validity(SeriesResult s) {
        return s.doses.stream().map(DoseResult::valid).toList();
    }

    @Test
    void fullyVaccinatedChildFromTypicalForeignSchedule() {
        // Hexavalent at 2, 4, 6 months and booster at 18 months; extra polio and DTaP at age 4.
        List<Dose> record = new ArrayList<>();
        for (LocalDate date : List.of(d(2018, 5, 10), d(2018, 7, 10), d(2018, 9, 10), d(2019, 9, 10))) {
            for (Antigen a : List.of(Antigen.DTaP, Antigen.IPV, Antigen.Hib, Antigen.HepB)) {
                record.add(new Dose(a, date));
            }
        }
        record.add(new Dose(Antigen.IPV, d(2022, 4, 1)));
        record.add(new Dose(Antigen.DTaP, d(2022, 4, 1)));
        record.addAll(doses(Antigen.MMR, d(2019, 3, 15), d(2023, 3, 15)));
        record.addAll(doses(Antigen.VAR, d(2019, 3, 15), d(2023, 3, 15)));
        record.addAll(doses(Antigen.HepA, d(2019, 4, 1), d(2019, 10, 1)));

        Report r = VaccineRules.evaluate(record, DOB, TODAY);
        for (String key : List.of("DTaP", "Polio", "MMR", "VAR", "HepB", "HepA", "Hib")) {
            assertEquals(Status.COMPLETE, series(r, key).status, key + ": " + series(r, key).summary);
        }
        assertEquals(Status.NOT_NEEDED, series(r, "PCV").status);
        assertEquals(Status.NOT_NEEDED, series(r, "MenACWY").status);
    }

    @Test
    void noRecordsAtAge8NeedsFullCatchUp() {
        Report r = VaccineRules.evaluate(List.of(), DOB, TODAY);
        assertEquals(Status.DUE, series(r, "MMR").status);
        assertEquals(2, series(r, "MMR").nextDoses.size());
        assertEquals(3, series(r, "HepB").nextDoses.size());
        assertEquals(3, series(r, "Polio").nextDoses.size());  // age 4+: 3 doses
        assertEquals(3, series(r, "DTaP").nextDoses.size());  // age 7+, first dose after 1st birthday
        assertEquals(Status.NOT_NEEDED, series(r, "Hib").status);
    }

    @Test
    void mmrBeforeFirstBirthdayDoesNotCount() {
        Report r = VaccineRules.evaluate(doses(Antigen.MMR, d(2019, 1, 10), d(2019, 4, 10)), DOB, TODAY);
        SeriesResult mmr = series(r, "MMR");
        assertEquals(List.of(false, true), validity(mmr));
        assertEquals(Status.DUE, mmr.status);
        assertEquals(1, mmr.nextDoses.size());
    }

    @Test
    void fourDayGracePeriod() {
        // 4 weeks minus 3 days is accepted; minus 5 days is not.
        Report ok = VaccineRules.evaluate(doses(Antigen.HepB, d(2020, 1, 1), d(2020, 1, 26), d(2020, 6, 1)), DOB, TODAY);
        assertEquals(List.of(true, true, true), validity(series(ok, "HepB")));
        Report early = VaccineRules.evaluate(doses(Antigen.HepB, d(2020, 1, 1), d(2020, 1, 24)), DOB, TODAY);
        assertFalse(series(early, "HepB").doses.get(1).valid());
    }

    @Test
    void opvAfterApril2016DoesNotCount() {
        LocalDate dob = d(2015, 1, 1);
        Report r = VaccineRules.evaluate(
                doses(Antigen.OPV, d(2015, 3, 1), d(2015, 5, 1), d(2016, 6, 1), d(2019, 6, 1)), dob, TODAY);
        SeriesResult polio = series(r, "Polio");
        assertEquals(List.of(true, true, false, false), validity(polio));
        assertEquals(Status.DUE, polio.status);
    }

    @Test
    void polioNeedsDoseAfterFourthBirthday() {
        Report r = VaccineRules.evaluate(doses(Antigen.IPV, d(2018, 5, 10), d(2018, 7, 10), d(2018, 9, 10)), DOB, TODAY);
        assertEquals(Status.DUE, series(r, "Polio").status);
        assertEquals(1, series(r, "Polio").nextDoses.size());
    }

    @Test
    void liveVaccinesLessThan28DaysApart() {
        List<Dose> record = List.of(new Dose(Antigen.MMR, d(2019, 4, 1)), new Dose(Antigen.VAR, d(2019, 4, 15)));
        Report r = VaccineRules.evaluate(record, DOB, TODAY);
        assertTrue(series(r, "MMR").doses.get(0).valid());
        assertFalse(series(r, "VAR").doses.get(0).valid());
    }

    @Test
    void measlesOnlyVaccineIsFlagged() {
        Report r = VaccineRules.evaluate(doses(Antigen.Measles, d(2019, 4, 1)), DOB, TODAY);
        DoseResult dose = series(r, "MMR").doses.get(0);
        assertFalse(dose.valid());
        assertTrue(dose.reason().contains("Measles-only"));
    }

    @Test
    void teenNeedsTdapAndMenACWY() {
        LocalDate dob = d(2012, 2, 1);  // age 14
        Report r = VaccineRules.evaluate(doses(Antigen.DTaP,
                d(2012, 4, 1), d(2012, 6, 1), d(2012, 8, 1), d(2013, 8, 1), d(2016, 3, 1)), dob, TODAY);
        assertEquals(Status.DUE, series(r, "DTaP").status);
        assertEquals(1, series(r, "DTaP").nextDoses.size());
        SeriesResult men = series(r, "MenACWY");
        assertEquals(Status.DUE, men.status);
        assertEquals(2, men.nextDoses.size());  // a dose now plus the booster at 16
    }

    @Test
    void infantOnTrackIsUpcomingNotDue() {
        LocalDate dob = d(2026, 6, 1);
        LocalDate today = d(2026, 8, 5);
        List<Dose> record = new ArrayList<>(doses(Antigen.HepB, d(2026, 6, 1)));
        record.addAll(doses(Antigen.DTaP, d(2026, 8, 1)));
        record.addAll(doses(Antigen.IPV, d(2026, 8, 1)));
        Report r = VaccineRules.evaluate(record, dob, today);
        assertEquals(Status.UPCOMING, series(r, "DTaP").status);
        assertEquals(Status.DUE, series(r, "HepB").status);  // 2nd HepB is 4+ weeks after the birth dose
        assertEquals(Status.UPCOMING, series(r, "MMR").status);
    }

    @Test
    void hibToddlerCatchUp() {
        LocalDate dob = d(2025, 1, 1);
        LocalDate today = d(2026, 3, 1);  // 14 months
        Report r = VaccineRules.evaluate(doses(Antigen.Hib, d(2025, 3, 1), d(2025, 5, 1), d(2025, 7, 1)), dob, today);
        SeriesResult hib = series(r, "Hib");
        assertEquals(Status.DUE, hib.status);
        assertEquals(1, hib.nextDoses.size());
    }

    @Test
    void hpvTwoDoseSeriesIfStartedBefore15() {
        LocalDate dob = d(2012, 1, 1);
        Report done = VaccineRules.evaluate(doses(Antigen.HPV, d(2023, 3, 1), d(2023, 10, 1)), dob, TODAY);
        assertEquals(Status.COMPLETE, series(done, "HPV").status);
        Report tooClose = VaccineRules.evaluate(doses(Antigen.HPV, d(2023, 3, 1), d(2023, 6, 1)), dob, TODAY);
        assertEquals(Status.DUE, series(tooClose, "HPV").status);
    }

    @Test
    void incompleteHibAtAge9IsNotNeededRatherThanComplete() {
        Report r = VaccineRules.evaluate(doses(Antigen.Hib, d(2018, 5, 10), d(2018, 7, 10)), DOB, TODAY);
        assertEquals(Status.NOT_NEEDED, series(r, "Hib").status);
    }

    @Test
    void bcgIsListedButIgnored() {
        Report r = VaccineRules.evaluate(doses(Antigen.BCG, DOB), DOB, TODAY);
        assertEquals(1, r.ignored().size());
    }
}
