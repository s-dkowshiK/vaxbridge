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

4. **Save.** Signed-in staff can save the reviewed record, with the original photos, to their account.
   The dashboard lists saved children and who has doses due. Opening a saved record re-checks it as of
   today, so due dates stay current.
5. **State format.** Pick a US state and VaxBridge lays the checked record out the way state school
   immunization forms and registries expect: a vaccine-by-dose grid with US names and MM/DD/YYYY dates,
   plus files a clinic can use (HL7 2.5.1 VXU for the state registry, FHIR R4, CSV) with CDC CVX codes.
   These are transcriptions for a provider to verify and sign. VaxBridge is not a state agency, never
   sends anything to a state, and does not issue SMART Health Cards (only registered issuers can sign those).

Settings let each user change their name, email, password and profile picture, and the look of the
app (accent color, light/warm/cool/dark background, corner roundness, text size). They are saved to the
account, so they follow the user to any device.

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
    AuthController.java   accounts: sign up, sign in, sign out (BCrypt password hashes, server session)
    RecordsController.java  saved records and their original photos, per account
    AccountController.java  Settings: profile, password, profile picture, appearance
  src/main/resources/static/   the website (index.html, app.js, style.css, exports.js for state formats)
  src/main/resources/sample-record.json   made-up record for demos
```

## Running it

You need Java 21 and Maven.

```bash
mvn package                      # builds and runs all tests
export ANTHROPIC_API_KEY=sk-ant-...   # only needed for reading real photos
java -jar server/target/vaxbridge-server-0.1.0.jar
```

Open http://localhost:8080, create an account, and click **Try a sample record** to see the whole flow
without an API key. Accounts and saved records are kept in a small database file in `./data/` next to
where you run the app.
Get a key at https://console.anthropic.com.

## Putting it online

So saved records follow you to any device, the server runs on [Render](https://render.com) with a free
[Neon](https://neon.tech) PostgreSQL database. Both are free and sign in with GitHub.

1. **Database (Neon):** create a project, then copy its connection string
   (`postgresql://user:password@host/dbname?sslmode=require`).
2. **Server (Render):** New → Blueprint → pick this repository. Render reads `render.yaml`, builds the
   `Dockerfile`, and asks for:
   - `DATABASE_URL`: the Neon connection string
   - `ANTHROPIC_API_KEY`: optional; without it only the sample record can be read
3. Open the `https://….onrender.com` address Render shows.

On Render's free plan the server sleeps after 15 minutes without visits, so the first visit after that
takes about a minute. Accounts, records and sign-ins are all kept in the database, so nothing is lost when
it sleeps or restarts.

| Setting | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | local file in `./data` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | none | needed to read real photos |
| `PORT` | 8080 | port to listen on (set by Render) |
| `COOKIE_SECURE` | false | `true` when served over HTTPS |

## API (for a future mobile app)

| Method | Path | What it does |
|---|---|---|
| POST | `/api/extract` | multipart `files` (JPG/PNG/WEBP/GIF/PDF) → entries the AI read |
| POST | `/api/evaluate` | `{dateOfBirth, asOf?, entries:[{antigens, date, originalText}]}` → report |
| GET | `/api/sample` | sample record |
| GET | `/api/antigens` | antigen codes and names |
| POST | `/api/auth/signup` | `{name, email, password}` → creates an account and signs in |
| POST | `/api/auth/login` | `{email, password}` → signs in (session cookie) |
| POST | `/api/auth/logout` | signs out |
| GET | `/api/auth/me` | the signed-in user, or 401 |
| GET | `/api/records` | saved records with counts as of today (signed in) |
| POST | `/api/records` | multipart `record` (reviewed record JSON) + optional `files` → saves |
| GET | `/api/records/{id}` | the record, its report as of today, and its files |
| PUT | `/api/records/{id}` | replace the reviewed record (files kept) |
| DELETE | `/api/records/{id}` | delete the record and its files |
| GET | `/api/records/{id}/files/{fileId}` | an original photo or PDF |
| PUT | `/api/account` | `{name, email, theme}` (any left out are kept; `theme: null` resets the look) |
| PUT | `/api/account/password` | `{currentPassword, newPassword}` |
| GET/PUT/DELETE | `/api/account/avatar` | the profile picture; PUT is multipart `file` (JPEG, PNG, GIF or WebP, up to 2 MB) |

## Limits (say these out loud in the demo)

- Covers healthy children 0-18 on the routine CDC catch-up schedule. It does not cover high-risk
  conditions, flu, COVID-19, MenB, or travel vaccines.
- Hib is assumed to be PRP-T (true for nearly all vaccines given outside the US).
- State school requirements vary; the report follows the CDC schedule. State formats are transcriptions:
  a provider has to verify and sign them, and a clinic enrolled with the state registry submits HL7 files.
- Results are decision support only. A provider must verify the original record.
- Accounts are a working demo, not a certified system for children's health records. Real use would need
  HTTPS hosting, encrypted storage and backups, password reset, and a privacy review (FERPA/HIPAA).

## Live app

The real app runs at https://vaxbridge.onrender.com (Render + Neon, see above).

https://s-dkowshik.github.io/vaxbridge/ is a demo copy of the website that runs entirely in the browser
(`docs/index.html`). Accounts and saved records there are stored only in that browser, and only the sample
record can be read. The first version is kept at https://s-dkowshik.github.io/vaxbridge/v1/.

Sources: CDC Catch-up Immunization Schedule for Persons Aged 4 Months-18 Years; CDC General Best
Practice Guidelines for Immunization.
