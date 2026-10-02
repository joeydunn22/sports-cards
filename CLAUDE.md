# Sports Card Collection

A private, mobile-first progressive web app (PWA) for cataloging my sports card collection. It has fast card entry, search, sort and filter, and it will later add photos, collection valuation and eBay listing.

## Goals & priorities
1. **Fast data entry from a phone, with the card in hand.** About 500–1,000 cards need to go in from scratch, so entry speed beats everything else in v1.
2. **Find anything quickly:** search, sort and filter on every field.
3. **Private:** single user. Nobody else can read my data.
4. **Flexible:** never hard-code sports, brands or sets. Use free text with autocomplete built from my own existing data.
5. **Definite facts are required, everything else is optional:** player, year, set, card number and sport are required, because every card has them. The yes/no flags are always recorded. Everything else, money fields included, can be left blank.
6. **Consistent card identity:** set, insert and parallel are distinct concepts and must never blur together. See "Card identity" below.

## Tech stack
- **Frontend:** Vite + React + TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Data table:** TanStack Table (sort, filter, column visibility)
- **Data fetching/cache:** TanStack Query
- **Routing:** React Router with `HashRouter` (GitHub Pages has no SPA fallback)
- **Forms/validation:** React Hook Form + Zod
- **PWA:** `vite-plugin-pwa` (manifest, service worker, installable on iOS and Android)
- **Backend:** Supabase: Postgres, Auth (email + password; no emails are sent, so no SMTP setup is needed), Storage (photos, phase 2), Edge Functions (eBay and pricing, phases 3–4)
- **Hosting:** GitHub Pages from the repo `sports-cards`, deployed by a GitHub Actions workflow on push to `main`. Vite `base` is `/sports-cards/`.
- **Linting:** oxlint
- **Tests:** Vitest + React Testing Library

## Commands
- `npm run dev` starts the local dev server.
- `npm run build` runs the type-check and production build.
- `npm run preview` serves the production build locally (use it to test PWA behavior).
- `npm run lint` runs oxlint (the Vite template default).
- `npm run test` runs Vitest.
- `npm run gen:types` regenerates `src/lib/database.types.ts` from Supabase.

## Project structure
```
src/
  components/      shared UI (inputs, toggles, autocomplete, layout)
  features/
    cards/         card list, card form, card detail, filters
    auth/          login / session handling
    import-export/ CSV import & export
  lib/
    supabase.ts    Supabase client (single instance)
    database.types.ts  generated; do not hand-edit
  hooks/           data hooks wrapping TanStack Query
  types/           domain types (Card, CardInput) derived from DB types
supabase/
  migrations/      numbered SQL migrations; the source of truth for the schema
.github/
  workflows/
    deploy.yml     build + deploy to GitHub Pages on push to main
    keepalive.yml  scheduled ping so the Supabase free tier never pauses
  keepalive.txt    timestamp the keep-alive workflow commits to keep the repo "active"
```

## Data model: `cards` table
Card attributes live as columns on `cards`. Do **not** create separate set or player tables in v1. Autocomplete comes from `select distinct` over existing values.

| Column | Type | Req | Notes |
|---|---|---|---|
| id | uuid pk | ✓ | default `gen_random_uuid()` |
| user_id | uuid | ✓ | default `auth.uid()`, FK to auth.users |
| player | text | ✓ | |
| year | text | ✓ | text so it can hold "2023-24" for basketball and hockey seasons |
| set_name | text | ✓ | full product name, with no year and no color (see Card identity) |
| insert_name | text | | named insert or subset within the set; blank means a base card |
| parallel | text | | color or finish variant; blank means the base version |
| card_number | text | ✓ | text, because numbers can look like "RC-12" or "BDC-150" |
| sport | text | ✓ | free text with autocomplete; no enum |
| team | text | | |
| is_rookie | boolean | ✓ | default false |
| is_auto | boolean | ✓ | default false |
| is_patch | boolean | ✓ | default false |
| is_relic | boolean | ✓ | default false (non-patch memorabilia) |
| serial_number | int | | the "23" in 23/99 |
| print_run | int | | the "99" in 23/99; a 1/1 is serial 1, print_run 1 |
| quantity | int | ✓ | default 1 |
| is_graded | boolean | ✓ | default false |
| grade_company | text | | PSA, BGS, SGC, CGC… free text with suggestions |
| grade | text | | text so it can hold "10", "9.5" or "Authentic" |
| cert_number | text | | |
| raw_condition | text | | for ungraded cards (e.g. NM, EX) |
| purchase_price | numeric(10,2) | | optional |
| purchase_date | date | | optional |
| estimated_value | numeric(10,2) | | optional; filled in manually now, by the pricing integration later |
| sold_price | numeric(10,2) | | optional |
| sold_date | date | | optional |
| created_at / updated_at | timestamptz | ✓ | `updated_at` maintained by a trigger |

**Display convention:** a serial number shows as `23/99`. Show `print_run` alone as `/99` when the exact number is unknown.

## Card identity: set vs insert vs parallel
These three fields identify a card exactly, and the app must keep them separate:

| Field | What it is | Examples | Never put here |
|---|---|---|---|
| **Set** | The product, as Beckett and eBay list it, minus the year | Topps Finest, Bowman Chrome, Panini Prizm, Donruss Optic, Upper Deck Series 1 | the year, colors, "Refractor", insert names |
| **Insert** | A named subset within the set. Blank means a base card. | Rookie Autographs, Prospect Autographs, Future Stars, Young Guns | parallel colors |
| **Parallel** | A color or finish variant. Blank means the base version. | Refractor, Red Refractor, Silver, Gold Wave | the set name |

Worked example: a red /5 Finest refractor is **Set** `Topps Finest`, **Insert** blank, **Parallel** `Red Refractor`, **Numbered** `/5`. It is *not* set `Topps Finest Refractor` with subset `Red`.

Rules:
- Sets include the brand as printed (`Bowman Chrome`, not `Chrome`), so set names are unambiguous on their own.
- The form shows inline hints with these examples under the Set, Insert and Parallel fields.
- Show a soft, non-blocking warning when the Set field contains a likely parallel word (Refractor, or a color such as Silver, Gold, Red, Blue, Green, Orange, Purple or Black). Some real sets contain those words (such as Topps Gold Label), so the user can always dismiss it.
- Autocomplete for each field draws only from that field's own past values, so a parallel is never suggested as a set.
- **Card title** (used in lists and for future eBay listings): `{year} {set} {insert} {parallel} {player} #{card_number} {serial}`. Empty parts are skipped, and RC, Auto, Patch and the grade are appended where they apply. Example: `2023 Topps Finest Red Refractor Shohei Ohtani #12 3/5`.

## Security rules (non-negotiable)
- Row-level security is **enabled on every table**, and every policy is `user_id = auth.uid()`.
- Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (the `sb_publishable_…` key; safe to expose because of RLS) go to the client. Never put the service-role key, eBay secrets or pricing API keys in frontend code or in the repo. Those belong in Supabase Edge Function secrets.
- `.env.local` is git-ignored. In CI, values come from GitHub Actions secrets.
- The GitHub repo can be public (Pages needs that on the free plan), so assume the code is readable by anyone. All collection data stays in Supabase.

## Supabase keep-alive
Free Supabase projects pause after about 7 days of inactivity. `keepalive.yml` prevents that:
- It runs on a schedule (every 3 days) and also supports `workflow_dispatch` for manual runs.
- It makes a lightweight read-only request to the Supabase REST API using the publishable key from repo secrets. Under RLS that returns nothing, but it still counts as activity.
- It then commits an updated timestamp to `.github/keepalive.txt`. GitHub turns off scheduled workflows in public repos after 60 days without repo activity, and the commit prevents that.
- Keep-alive commits must not trigger the Pages deploy. Add `paths-ignore` for `.github/keepalive.txt` in `deploy.yml`.

## Connectivity
The app is online-only by design. The PWA caches the app shell for fast loading and home-screen install, but all reads and writes go straight to Supabase. Don't build offline sync.

## UX conventions
- **Mobile-first.** Design at 375px width first. Tap targets are at least 44px.
- **Quick-add flow:** "Save & add another" keeps year, set, insert and sport filled in, because cards are usually entered in batches from one set. The cursor returns to the player field.
- Booleans (RC, Auto, Patch, Relic, Graded) are one-tap toggle chips, not checkboxes buried in the form.
- Grading fields appear only when Graded is on. Money fields sit in a collapsed "Value" section.
- Free-text fields use autocomplete drawn from my existing values. A new value is accepted without friction.
- The list view shows cards on mobile and a sortable table on desktop. Filters cover sport, year, set, insert, parallel, player, team, the boolean flags, graded and serial-numbered.
- Edits are optimistic through TanStack Query, and deletes need a confirmation.

## Roadmap
- **Phase 0: Setup.** Git repo, Vite scaffold, Tailwind, oxlint, Supabase project plus the first migration with RLS, email + password login (account created in the dashboard, sign-ups disabled), the GitHub Pages deploy workflow, and the Supabase keep-alive workflow.
- **Phase 1: MVP.** Card CRUD, quick-add form, list with search/sort/filter, CSV export and import (export doubles as a backup), PWA install, and a collection summary (count, plus total estimated value where one is entered).
- **Phase 2: Photos.** Private Supabase Storage bucket. Front and back images per card, compressed on the client to WebP (max about 1600px, about 150 KB) with a thumbnail. Photos are taken with the phone camera via `<input capture>`. Add `front_image_path` and `back_image_path` columns through a migration.
- **Phase 3: Valuation.** A value dashboard (total, by sport and by player, top cards). Then evaluate a pricing source (SportsCardsPro/PriceCharting API is the leading candidate; eBay sold-comps data is restricted). Calls go through a Supabase Edge Function, and value history goes in a `price_history` table.
- **Phase 4: eBay listing.** Connect eBay through OAuth via an Edge Function, using the eBay Sell Inventory API. Create a listing from a card, prefilling the title from the card's fields and attaching its photos. Track the listing status on the card (add status columns at that point).
- **Later ideas:** tracking fields (storage location, tags, notes, want list), bulk edit, duplicate detection, OCR-assisted entry from a photo.

## Working conventions for Claude
- Stay inside this project folder. Sibling folders, such as other projects in the same parent directory, are unrelated: don't read, search or edit them.
- The schema changes only through new files in `supabase/migrations/`. Never edit an applied migration. Regenerate types after every schema change.
- Keep components small. Data access goes in `hooks/`, never directly in components.
- Don't add libraries beyond the stack above without asking.
- Each phase ends with: `npm run build` and `npm run test` passing, a manual check on a phone-sized viewport, and a check that RLS blocks access without a session.
- Ask before taking outward-facing actions: creating repos, pushing, or deploying.
