PRODUCT: JADIJCB, a Moroccan platform connecting heavy-machinery owners with contractors and individuals who want to rent or buy machines and spare parts. Mission: make finding, comparing, contacting, booking and paying simple and smooth, in Arabic (RTL, default) and French, mobile-first on mid-range Android phones over weak networks.

USERS: Owner (pays a subscription), Customer (contractor or individual, searches and contacts; customer side is built after the owner side is stable), Admin (approves payments, supervises).

REVENUE MODEL: owners get a 72h trial, then a soft lock until they pay by offline RIB/Wafacash, approved by admin. Plans and prices are editable by admin. Nothing else is monetized for now.

PRINCIPLES: simple beats feature-rich; one primary action per screen; WhatsApp is the main contact channel; trust signals (verified owner, real photos, real numbers); speed on slow networks; no mock data, no demo mode; never show a fake success; every Supabase call checks `error`; all text in ar.json/fr.json.

IMMUTABLE: stack (React + Vite + TS + Tailwind + Supabase). Never edit supabase/config.toml, .github/workflows/*, vercel.json/_redirects, or any already-applied migration. Database changes go in ONE NEW migration with a higher timestamp, idempotent, RLS on every table. Keep existing column names. Latin digits, MAD currency.

ITERATION PROTOCOL (every run):
1. Read BRIEF, PROGRESS, AUDIT. Audit ONLY the FOCUS area.
2. Walk the real user journeys through the code, step by step: owner (sign up -> first machine -> first lead -> pay -> unlock), customer (search -> compare -> contact), admin (approve payment). At each step check: runtime errors, unhandled promises, missing i18n keys, RTL breaks, mismatch between code and supabase/migrations (columns, enums, RLS), dead buttons, missing loading/empty/error states, type errors, slow-network cost (image size, pagination), security (RLS gaps, XSS, unvalidated input, exposed keys), conversion blockers (extra steps, unclear copy, no CTA). If you can run the preview or read the console, do it.
3. Score each finding: P0 blocks signup/payment/data or is a security hole; P1 broken feature; P2 friction or lost revenue; P3 polish. Write them to docs/AUDIT.md (id, file, issue, severity, status).
4. Fix all P0, then P1, then as many P2 as the token budget allows. Smallest change that fixes the root cause. No refactor unless required. Output ONLY changed files, each COMPLETE.
5. Verify: re-read every changed file for syntax, imports and types; confirm any DB change has a new migration; confirm no immutable file changed.
6. Report in max 20 lines: fixed IDs, remaining IDs, top 3 next steps ranked by revenue impact, and a 5-step manual test for me on a real phone.
7. Update docs/PROGRESS.md (DONE / REMAINING / DECISIONS) and docs/AUDIT.md.

REVENUE LENS: every iteration, name the single change that most increases paying owners or reduces drop-off, and implement it if it is small.

DECISIONS: if a requirement is unclear, pick the simplest sensible default and record it under DECISIONS. Ask me only for irreversible choices (deleting data, paid services).

TOKEN ECONOMY: no explanations beyond the report, never reprint unchanged files. If the budget runs out, stop at a file boundary and end with CONTINUE_FROM: <next file>.
