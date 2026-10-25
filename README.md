# VaxBridge

VaxBridge reads a child's vaccination record from another country (a photo or scan, in any
language) and checks it against the US catch-up immunization schedule. It produces a report a
school nurse or pediatrician can review, print, and sign.

**Why:** Immigrant and refugee children often arrive with records US schools and clinics can't easily
read, which leads to weeks of enrollment delays or unnecessary re-vaccination. VaxBridge does the
tedious translation and date math. It never makes the medical decision: a licensed provider reviews
every entry and signs off.

## How it works

1. **Upload.** A photo or PDF of the record is sent to Claude (Anthropic's AI), which reads and
   translates it, splits combination vaccines (like "Pentavalente") into their parts, and converts
   dates to one format. Hard-to-read entries are flagged.
2. **Review.** The nurse compares each row with the original record and fixes anything wrong.
3. **Report.** A rules engine written in plain Java checks every dose against the CDC catch-up
   schedule (minimum ages, minimum intervals, the 4-day grace period, live-vaccine spacing, the 2016
   oral polio switch, and so on) and lists what is complete, what is due now, and the earliest date
   for each remaining dose.

The AI only reads the record. All the vaccine logic is ordinary, tested Java code, so anyone can see
exactly why a dose did or didn't count.

## Project layout

```
rules/    Plain Java vaccine rules (no web code). Can be reused as-is in an Android app.
  src/main/java/com/vaxbridge/rules/
    VaccineRules.java     entry point: evaluate(doses, dateOfBirth, asOf)
    Series.java           shared logic: validating doses and projecting the catch-up plan
    series/*.java         one class per vaccine (HepB, DTaP, Polio, MMR, ...)
  src/test/...            unit tests for the rules
server/   Spring Boot web server
  src/main/java/com/vaxbridge/server/
    RecordReader.java     sends the photo to Claude and gets structured entries back
    ApiController.java    JSON API used by the website (and later a mobile app)
  src/main/resources/static/   the website (index.html, app.js, style.css)
  src/main/resources/sample-record.json   made-up record for demos
```

## Running it

You need Java 21 and Maven.

```bash
mvn package                      # builds and runs all tests
export ANTHROPIC_API_KEY=sk-ant-...   # only needed for reading real photos
java -jar server/target/vaxbridge-server-0.1.0.jar
```

Open http://localhost:8080. Click **Try a sample record** to see the whole flow without an API key.
Get a key at https://console.anthropic.com.

## API (for a future mobile app)

| Method | Path | What it does |
|---|---|---|
| POST | `/api/extract` | multipart `files` (JPG/PNG/WEBP/GIF/PDF) → entries the AI read |
| POST | `/api/evaluate` | `{dateOfBirth, asOf?, entries:[{antigens, date, originalText}]}` → report |
| GET | `/api/sample` | sample record |
| GET | `/api/antigens` | antigen codes and names |

## Limits (say these out loud in the demo)

- Covers healthy children 0-18 on the routine CDC catch-up schedule. It does not cover high-risk
  conditions, flu, COVID-19, MenB, or travel vaccines.
- Hib is assumed to be PRP-T (true for nearly all vaccines given outside the US).
- State school requirements vary; the report follows the CDC schedule.
- Results are decision support only. A provider must verify the original record.

Sources: CDC Catch-up Immunization Schedule for Persons Aged 4 Months-18 Years; CDC General Best
Practice Guidelines for Immunization.
