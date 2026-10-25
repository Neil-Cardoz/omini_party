# celebrAItions — GenAI Event Planning Assistant · Project Blueprint

> **Vertical:** Event Planning Assistant (weddings, birthdays, community events)
> **One-liner:** A smart, context-aware assistant that turns "I'm throwing a party" into a costed, scheduled, vendor-ready plan, with personalized ideas, QR invites and a printable report. Every decision can be revisited and changed.

---

## 0. Table of Contents
1. Goals & evaluation mapping
2. Tech stack & architecture
3. User journey (end-to-end)
4. Screen-by-screen spec
   - 4.1 Login / Sign-up
   - 4.2 Onboarding questionnaire
   - 4.3 Party Hall (Dashboard)
   - 4.4 Party Detail (tasks by subcategory)
   - 4.5 New Party Wizard (11 steps)
   - 4.6 Invites, QR & +1 RSVP
   - 4.7 Check-in scanner
   - 4.8 Cost report (printable)
5. The "Options + Go Back & Change" system
6. Decision logic (the "smart" part)
7. GenAI integration
8. Data model
9. API surface
10. Security
11. Accessibility
12. Efficiency
13. Testing strategy
14. Folder structure
15. Extra features (beyond the brief)
16. Build plan (fits the 3-attempt rule)
17. README outline & assumptions

---

## 1. Goals & Evaluation Mapping

| Evaluation area | Impact | How celebrAItions addresses it |
|---|---|---|
| Problem-statement alignment | High | Budgets, timelines, vendor checklists and personalized ideas for weddings, birthdays and community events are all core features, not add-ons |
| Smart, dynamic assistant | High | A rules engine plus an LLM that adapts to event type, guest count, budget, culture, diet, age group and season |
| Logical decisions from context | High | Explicit decision tables (§6): e.g. no bar for a kids' birthday, gift registry for weddings, permit checklist for community events |
| Code quality | Medium | Layered architecture, typed (TypeScript), linted, small pure functions, documented modules |
| Security | Medium | Hashed passwords, httpOnly JWT cookies, input validation (zod), rate limits, signed QR tokens, no secrets in the repo |
| Testing | Medium | Unit tests (engine), API tests (supertest), component tests, an a11y test (axe), CI-ready |
| Accessibility | Low/Med | WCAG 2.2 AA: keyboard flow, ARIA, contrast, reduced motion, screen-reader-friendly wizard |
| Efficiency | Low/Med | Deterministic engine first, LLM only for creative text; caching; lazy-loaded routes; tiny bundle |

**Hard constraints:** repo < 10 MB, public, **single branch (`main`)**, at most 3 submission attempts.

---

## 2. Tech Stack & Architecture

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript, React Router | Fast, small, familiar to graders |
| Styling | Plain CSS modules + CSS variables (light/dark) | No heavy UI kit, keeps the repo small |
| Backend | Node 24 + Express + TypeScript | Simple, testable |
| Database | SQLite via built-in `node:sqlite` (file DB, auto-seeded) | Zero native deps, zero setup for graders |
| Auth | bcrypt + JWT in an httpOnly, SameSite=Strict cookie | Secure and simple |
| Validation | `zod` (shared schemas client and server) | One source of truth |
| GenAI | Anthropic Claude API (`claude-sonnet-5-5`), server-side only | Creative ideas, themes, invite copy |
| Fallback | Deterministic suggestion engine plus a template library | **App works fully without an API key** (important for graders) |
| QR | `qrcode` (generate) + `html5-qrcode` or `BarcodeDetector` (scan) | Entry check-in |
| Print | Print-optimized route + `@media print` CSS → browser "Save as PDF" | No PDF lib bloat |
| Tests | Vitest, Supertest, React Testing Library, vitest-axe | One runner for everything |

```
┌──────────────────────── Browser (React SPA) ────────────────────────┐
│ Login · Onboarding · Party Hall · Party Detail · Wizard · Report    │
│        │ fetch (JSON, cookie auth)                                  │
└────────┼────────────────────────────────────────────────────────────┘
         ▼
┌──────────────────────── Express API ─────────────────────────────────┐
│ routes → controllers → services                                      │
│   ├─ authService        ├─ partyService      ├─ inviteService (QR)   │
│   ├─ suggestionEngine   ├─ costEstimator     ├─ timelineBuilder      │
│   │   (rules, pure fns) │   (pure fns)       │   (pure fns)          │
│   └─ aiService ──► Claude API (optional) ──► fallback templates      │
│ repositories → SQLite (node:sqlite)   seed: venues, caterers, themes │
└──────────────────────────────────────────────────────────────────────┘
```

**Design principle:** *Rules decide, AI decorates.* All numbers (costs, quantities, dates) come from the deterministic, testable engine. The LLM only writes creative text (themes, invite wording, ideas) and personalizes it. That keeps it accurate, cheap and testable.

---

## 3. User Journey (End-to-End)

```
Sign up ─► Onboarding (6 quick questions) ─► Party Hall
                                               │
          ┌────────────────────────────────────┼─────────────────────┐
          ▼                                    ▼                     ▼
   Click a party card                 "+ New Party"            Profile/Settings
          │                                    │
   Party Detail                       Wizard (11 steps, each with options,
   ├ Overview & countdown              each step editable via stepper)
   ├ Tasks by subcategory                      │
   ├ Budget tracker                    Review & Generate Plan
   ├ Guests & RSVPs                            │
   ├ Vendors                           Party created ─► Party Detail
   ├ Menu & Bar
   ├ Timeline / run-sheet
   └ Report (print)
```

---

## 4. Screen-by-Screen Spec

### 4.1 Login / Sign-up
- Tabs: **Log in** | **Create account**
- Fields: name (sign-up only), email, password (min 8 chars, strength meter), show/hide toggle
- "Continue as Guest (demo)" loads a **seeded demo account** with 3 sample parties, so graders can explore instantly
- Errors are announced through an `aria-live` region; there is no account-enumeration leak ("Invalid email or password")
- After the first login → Onboarding. Returning user → Party Hall

### 4.2 Onboarding Questionnaire (first login only, editable later in Profile)
One question per screen, chip/card options, a progress bar, and **Back / Skip / Next** on every screen.

| # | Question | Options (single or multi) |
|---|---|---|
| 1 | What brings you here? (multi) | 💍 Wedding · 🎂 Birthday · 🏘️ Community event · 🎓 Graduation · 💼 Corporate · 👶 Baby shower · 🎉 Other |
| 2 | Your role | I'm the host · Family member · Friend helping out · Professional planner · Community organizer |
| 3 | Typical budget comfort | Budget-friendly · Moderate · Premium · Luxury · "Show me options" |
| 4 | Location & currency | City (text + autocomplete from seed list) · Currency (₹ INR default, $, €, £, AED…) |
| 5 | Food preferences you usually plan for (multi) | Vegetarian · Vegan · Jain · Halal · Kosher · Gluten-free · Non-veg · No preference |
| 6 | Planning style | "Do it for me" (auto-pick best options) · "Give me 3 choices each step" · "I'll customize everything" |
| 7 *(optional)* | Cultural/traditional preferences | Hindu · Muslim · Christian · Sikh · Jewish · Secular/Modern · Mixed · Prefer not to say |
| 8 *(optional)* | Alcohol at your events? | Yes · No · Depends on event |

These answers become the **User Context Profile**, which pre-fills defaults in every wizard and drives decision logic (§6).

### 4.3 Party Hall (Dashboard)
```
┌ celebrAItions ───────────────────────────── 🔔  🌓  Avatar ▾ ┐
│ Welcome back, Asha 👋      [ + New Party ]                │
│ Filters: [All] [Upcoming] [Planning] [Completed] 🔍 Search│
│ Sort: Date ▾                                              │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │💍 Riya Wedding│ │🎂 Aarav turns 7│ │🏘️ Diwali Mela │        │
│ │ 12 Dec · 42d  │ │ 3 Nov · 9d    │ │ 1 Nov · 7d    │        │
│ │ ███████░ 72%  │ │ ████░░░ 45%   │ │ ██████░ 80%   │        │
│ │ ₹8.2L / ₹10L  │ │ ₹18k / ₹25k   │ │ ₹60k / ₹55k ⚠ │        │
│ │ 180/250 RSVP  │ │ 14/20 RSVP    │ │ Open event    │        │
│ └──────────────┘ └──────────────┘ └──────────────┘        │
│ ┌ This week ──────────────────────────────────────────┐   │
│ │ ☐ Confirm caterer (Diwali Mela) · due tomorrow       │   │
│ │ ☐ Send reminder to 6 pending RSVPs (Aarav)           │   │
│ └──────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```
- Card shows: type icon, name, date, countdown, task completion %, budget used vs planned (⚠ when over), RSVP count, status chip
- **"+ New Party"** card is always first (an empty state shows a friendly illustration and CTA)
- **"This week" aggregated task feed** across all parties
- Card actions (kebab menu): Open · Duplicate as template · Archive · Delete (with confirm)

### 4.4 Party Detail
Header: name, type, date and countdown, venue, a status chip, **[Edit plan]** (reopens the wizard at any step), **[Print report]**

Tabs (keyboard-navigable `role="tablist"`):

| Tab | Content |
|---|---|
| **Overview** | Key facts, budget donut, task progress, next 3 tasks, AI "Idea of the day" |
| **Tasks** | Tasks **grouped by subcategory** (below), each with checkbox, due date, owner, priority, notes. Add/edit/delete; filter by status |
| **Budget** | Estimated vs actual per category, add expenses, over-budget warnings, "Suggest savings" (AI) |
| **Guests & RSVP** | Guest list, +1s, dietary needs, RSVP status, invite sent/opened, check-in status, CSV import/export |
| **Vendors** | Shortlisted caterer, venue, decorator, photographer, DJ…; status (Contacted → Quoted → Booked → Paid), compare up to 3 |
| **Menu & Bar** | Selected menu, per-head quantities, dietary coverage check, bar plan (if applicable) |
| **Timeline** | Planning timeline (T-90 → T-0) and day-of run-sheet (hour by hour) |
| **Ideas** | Theme moodboard (color palette + keywords), décor, activities, games, favors, AI regenerate |
| **Report** | Printable cost and plan report |

**Task subcategories (auto-generated per event type):**
- 📍 Venue & Logistics: book venue, permits, parking, seating layout, power/backup
- 🍽️ Food & Beverage: finalize menu, tasting, caterer deposit, bar license, cake
- 🎨 Décor & Theme: florals, lighting, stage/backdrop, table settings
- 💌 Guests & Invitations: guest list, send invites, RSVP follow-ups, seating chart
- 📸 Entertainment & Media: DJ/band, photographer, games, MC
- 👗 Attire & Beauty: outfits, fittings, makeup/mehendi (wedding)
- 🎁 Gifts & Favors: registry, return gifts, thank-you notes
- 💰 Budget & Payments: deposits, final payments, tips
- 🛡️ Safety & Compliance: first aid, permits, insurance, accessibility (community)
- ✅ Day-of & Wrap-up: run-sheet, vendor arrival, cleanup, feedback survey

Each task carries a `dueOffsetDays` relative to the event date, so changing the date recomputes every due date.

### 4.5 New Party Wizard (11 steps, the heart of the app)

Layout: a **stepper sidebar** (desktop) / top progress bar (mobile) shows every step with ✓ done / ● current / ○ pending. **Any completed step is clickable**, so users can jump back and change it. Every step has **Back · Save draft · Next**, and option cards follow a consistent pattern (§5).

| Step | Asks | Options / Suggestions shown |
|---|---|---|
| **1. Event basics** | Type, name, honoree(s), date and time, duration | Type cards; date picker warns about weekends, festivals and monsoon (seasonal hint) |
| **2. Guests & audience** | Guest count (slider + input), age mix (Kids/Teens/Adults/Seniors), formality | Chips; kids-heavy toggles kid-safe logic |
| **3. Budget** | Total budget or "help me decide" | 3 tier cards (Essential / Balanced / Premium) with auto-computed totals from guests × city cost index; custom input; category split sliders |
| **4. Theme & vibe** | Vibe and colors | **3–6 AI theme cards** (name, palette swatches, mood keywords, décor ideas); "Regenerate"; "Write my own" |
| **5. Location** | Indoor/outdoor, area | **Suggested venues** (seed data) filtered by capacity ≥ guests, budget and type; map-less card list with price/head, capacity, amenities, accessibility ♿ badge; "I already have a venue" option |
| **6. Menu (Food)** | Cuisine, service style, diet | Buffet / Plated / Family-style / Food stations / Potluck (community); **3 menu packages** with a dish list; dietary coverage meter ("covers 4/5 declared diets") |
| **7. Bar** *(conditional, see §6)* | Alcohol? | Full bar / Beer & wine / Signature cocktails / **Mocktail bar** / None; per-head drink calculator |
| **8. Caterer** | Choose vendor | **Available caterers** filtered by cuisine, diet, capacity, date availability and budget; rating, price/head, sample menu; compare up to 3 |
| **9. Attire** | Dress code | Suggested dress code (e.g. "Indo-western pastel", "Smart casual", "Kids: superhero costume welcome") for host, guests, and the bridal party/honoree, with color guidance matching the theme |
| **10. Gifts** *(conditional)* | Gift guidance | Wedding → registry ideas and price bands; Birthday → age-appropriate gift ideas + return-gift/favor ideas; Community → raffle prizes/volunteer thank-yous; "No gifts please" option |
| **11. Invites** | Invite design and +1 policy | 3 AI invite copies (Formal / Fun / Minimal) + theme-colored card preview; **+1 policy** (None / Allowed for all / Selected guests / Limit N); RSVP deadline; QR entry on/off |
| **Review & Generate** | Summary | Every section as a card with **[Change]** that jumps to its step; **live estimated cost**; [Generate plan] → creates tasks, timeline, budget lines and the guest shell |

### 4.6 Invites, QR & +1 RSVP
- Host adds guests manually, from CSV, or by sharing an **open RSVP link** (community events)
- Each guest gets a unique **signed invite token** → public page `/rsvp/:token` (no login):
  - Shows the themed invite, event details, dress code and gift note
  - RSVP: Attending / Maybe / Can't make it
  - **+1 registration** (if allowed): +1 name, dietary needs, kids count (if allowed)
  - Dietary preference and a message to the host
  - Add to calendar (.ics download)
- On "Attending", the guest gets an **entry QR** (contains an HMAC-signed token, never PII); they can download it as PNG or save the page
- Host can **print invite cards** with QR codes (print layout, 4 per A4)
- Share options: copy link · WhatsApp share URL · email `mailto:` (no third-party SMS service needed)

### 4.7 Check-in Scanner (day-of)
- `/party/:id/checkin` uses the camera (`BarcodeDetector` API, with `html5-qrcode` fallback) or manual search by name
- Shows ✅ "Welcome, Rahul (+1: Meera)" or ⚠ "Already checked in at 7:42 PM" / ❌ "Invalid invite"
- Live counter: checked-in / expected

### 4.8 Cost Estimate & Printable Report
`/party/:id/report` is a print-optimized page (`@media print`, A4, page breaks):
1. Cover: party name, date, venue, theme palette
2. Executive summary: guests, total estimate, budget variance
3. **Cost breakdown table**: category · item · qty · unit cost · subtotal · % of total, plus contingency (10%) and taxes (configurable GST/VAT %)
4. Budget vs estimate bar chart (inline SVG, prints cleanly)
5. Vendor list with contacts and booking status
6. Menu and bar quantities
7. Timeline and day-of run-sheet
8. Task checklist with status
9. Guest summary (counts by RSVP and diet; no personal details unless the host opts in)

Buttons: **Print / Save as PDF** · Download CSV (budget lines) · Share read-only link (optional)

---

## 5. The "Options + Go Back & Change" System

This is a first-class requirement, implemented once and reused everywhere.

**Option card component** (`<OptionGroup>`):
- Renders choices as radio/checkbox cards (real `<input>`s under the hood, so they're accessible)
- Each card: title, short description, price impact badge (`+₹12k`), "Recommended ⭐" tag, "Why?" tooltip showing the rule that recommended it
- Always includes a **"Custom / Other"** option with a free-text field

**Draft state machine:**
```
wizardDraft = {
  currentStep, steps: { [stepId]: { value, status: 'pending'|'done'|'stale' } },
  version, updatedAt
}
```
- Autosaved (debounced 800 ms) to the server as `status = 'draft'`, so users can leave and resume
- The stepper lets the user jump to any `done` step
- **Dependency graph:** when an upstream answer changes, downstream steps that depend on it are marked **`stale`** (⚠ "Your guest count changed; please review venue & caterer") instead of being silently wiped

| If this changes… | …these become `stale` |
|---|---|
| Event type | everything after step 1 |
| Guest count | budget, venue, menu quantities, caterer, bar, invites |
| Budget | venue, menu package, caterer |
| Theme | attire colors, invite design |
| Diet prefs | menu, caterer |
| Date | venue/caterer availability, timeline |

- **Undo** for the last change (toast with "Undo") inside the wizard
- After creation, **[Edit plan]** reopens the wizard pre-filled. On save, the system diffs and asks: "Regenerate affected tasks? (keeps your completed ones)"
- On the Review screen every card has **[Change]**

---

## 6. Decision Logic (The "Smart" Part)

All rules live in `server/src/engine/rules/*.ts` as **pure, unit-tested functions** with a `reason` string surfaced in the UI ("Why?").

### 6.1 Context inputs
`eventType, guestCount, ageMix, budget, budgetTier, city (cost index), date (season, weekday, festival), diet[], culture, alcoholPref, formality, indoor/outdoor, planningStyle`

### 6.2 Example decision table

| Condition | Decision |
|---|---|
| Birthday AND ageMix is mostly kids (< 13) | Hide full bar → offer **mocktail/juice bar**; add tasks "kid-safe venue check", "entertainer/magician", "return gifts"; attire = "comfortable/costume" |
| Wedding | Add attire for the bridal party; **gift registry** step; multi-day function options (Mehendi, Sangeet, Reception) if culture = Hindu/Sikh; timeline starts T-180 |
| Community event | Add **permits, volunteers, safety/first aid, accessibility, waste management**; menu offers potluck/food stalls; open RSVP link instead of named invites; gifts → raffle/sponsor thank-yous |
| `alcoholPref = No` OR culture suggests dry event OR > 30% kids | Bar step defaults to "Mocktails/None" (still overridable) |
| Outdoor AND monsoon/winter month in city | Warning + add task "backup tent/heaters" + cost line |
| Budget per head < category minimum | Suggest a lower tier, potluck, weekday date, or trimming the guest list, with quantified savings |
| Guest count > venue capacity | Venue filtered out; explains why |
| Declared diets include Jain/Vegan | Caterers without that capability are de-ranked; menu coverage meter shows gaps |
| Date < 30 days away | "Fast-track mode": compressed timeline, priority flags on vendor booking |
| Weekend or festival date | +15–25% venue/caterer price factor and an early-booking reminder |

### 6.3 Cost estimator (deterministic)
```
perHead  = baseRate[eventType][tier] × cityIndex[city] × seasonFactor(date) × weekendFactor(date)
food     = guests × menuPackage.pricePerHead
bar      = barGuests × drinksPerHead(durationHrs) × pricePerDrink   (0 if none)
venue    = venue.flatFee + venue.perHead × guests
decor    = theme.complexity × decorBase[tier] × sqrt(guests)
media    = photo + music (by tier)
attire   = honoree/host allowance (by tier & type)
invites  = guests × (digital ? 0 : printCost)
favors   = guests × favorUnitCost (if enabled)
subtotal = Σ categories
total    = subtotal × (1 + contingency 10%) × (1 + tax%)
```
Quantities: drinks ≈ 2 for the first hour + 1 per extra hour per drinking guest; food buffer +5–10%; cake ≈ 1 slice/guest + 10%.

### 6.4 Timeline builder
Each event type has a task template list with `dueOffsetDays` (e.g. wedding: venue −180, caterer −120, invites −60, RSVP deadline −21, final headcount −7). If the event is sooner than the earliest offset, the builder compresses proportionally and flags overdue-on-creation items as "Do now".

### 6.5 Ranking vendors
`score = 0.35·fit(diet,cuisine) + 0.25·budgetFit + 0.2·rating + 0.1·capacityFit + 0.1·availability`. The top 3 are shown with a "Recommended" badge, plus "Show all".

---

## 7. GenAI Integration

**Used for (creative, personalized):** theme concepts, décor and activity ideas, invite wording (3 tones), attire descriptions, gift ideas, "Suggest savings" narrative, day-of speech/toast starter, thank-you note drafts, a free-form **"Ask celebrAItions" chat** scoped to the current party.

**Not used for:** prices, quantities, dates, vendor availability (these come from the engine and seed data).

**Implementation (`aiService`):**
- Server-side only; key in `ANTHROPIC_API_KEY` (`.env`, git-ignored, `.env.example` committed)
- Model: `claude-sonnet-5-5`; **structured JSON output** validated with zod; on parse failure → retry once → fallback templates
- The prompt includes the context profile and engine results (e.g. budget, diet, palette), so AI output stays consistent with the numbers
- **Fallback mode:** if there's no key, a timeout (8 s) or an error, a curated template library in `server/src/ai/fallback/` serves good themes, invites and ideas by event type and tier. The UI shows a subtle "Offline ideas" badge
- **Caching:** hash(prompt inputs) → cached response in SQLite for 24 h (saves cost and latency on Back/Next navigation)
- **Safety:** user text is length-limited and wrapped in delimiters; the system prompt restricts the model to event-planning content; output is rendered as text (never `dangerouslySetInnerHTML`)
- Per-user AI rate limit (e.g. 30 requests per 10 min)

---

## 8. Data Model (SQLite)

```
users(id, name, email UNIQUE, password_hash, created_at)
user_profiles(user_id PK→users, interests JSON, role, budget_tier, city, currency,
              diets JSON, planning_style, culture, alcohol_pref, onboarded BOOL)
parties(id, owner_id→users, type, name, honoree, date, end_time, status
        ['draft'|'planning'|'confirmed'|'completed'|'archived'],
        guest_count, budget_total, currency, theme JSON, venue_id, caterer_id,
        wizard_state JSON, created_at, updated_at)
party_collaborators(party_id, user_id, role ['co-host'|'viewer'])
tasks(id, party_id, category, title, notes, due_date, due_offset_days,
      priority, status ['todo'|'doing'|'done'], assignee, sort_order)
budget_items(id, party_id, category, label, qty, unit_cost, estimated, actual, paid BOOL)
guests(id, party_id, name, email, phone, group_tag, diet, plus_one_allowed BOOL,
       plus_one_name, plus_one_diet, kids_count, rsvp ['pending'|'yes'|'maybe'|'no'],
       invite_token UNIQUE, checked_in_at, message)
vendors(id, kind ['venue'|'caterer'|'decor'|'photo'|'music'|...], name, city,
        capacity_min, capacity_max, price_per_head, flat_fee, cuisines JSON,
        diets JSON, rating, amenities JSON, accessible BOOL, contact JSON)   -- seeded
party_vendors(party_id, vendor_id, status ['shortlisted'|'contacted'|'quoted'|'booked'|'paid'], quote, notes)
menus(id, party_id, items JSON, service_style, bar JSON)
ai_cache(key PK, response JSON, created_at)
activity_log(id, party_id, user_id, action, detail JSON, created_at)
```
Seed data (`server/seed/*.json`, roughly 100 KB total): ~10 cities with cost indices, ~40 venues, ~30 caterers, decorators/photographers/DJs, menu packages, theme and invite fallback templates, task templates per event type.

---

## 9. API Surface (REST, JSON, `/api/v1`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/signup` · `/auth/login` · `/auth/logout` · `/auth/demo` | Auth |
| GET | `/auth/me` | Current user + profile |
| PUT | `/profile` | Save onboarding / profile |
| GET | `/parties?status=&q=` | Party Hall list |
| POST | `/parties` | Create draft |
| GET/PATCH/DELETE | `/parties/:id` | Detail / update / delete |
| PUT | `/parties/:id/wizard` | Autosave wizard draft (returns stale steps) |
| POST | `/parties/:id/generate` | Finalize: create tasks, budget, timeline |
| POST | `/parties/:id/duplicate` | Use as template |
| GET | `/suggestions/:step?partyId=` | Options for a wizard step (engine + AI) |
| POST | `/estimate` | Live cost estimate for a draft |
| CRUD | `/parties/:id/tasks`, `/budget`, `/guests`, `/vendors` | Sub-resources |
| POST | `/parties/:id/guests/import` | CSV import |
| GET | `/parties/:id/guests/:gid/qr` | QR PNG |
| GET/POST | `/public/rsvp/:token` | Public RSVP (rate-limited) |
| POST | `/parties/:id/checkin` | Validate QR token |
| GET | `/parties/:id/report` | Report data |
| GET | `/parties/:id/ics` | Calendar file |
| POST | `/ai/chat` | Party-scoped assistant |

Errors: consistent `{ error: { code, message, fields? } }`.

---

## 10. Security

- **Passwords:** bcrypt (cost 12); never logged
- **Session:** JWT (15-min access + 7-day refresh), httpOnly, Secure (prod), SameSite=Strict cookies; logout revokes
- **Authorization:** every party query is scoped by `owner_id` or collaborator role (no IDOR); tested explicitly
- **Validation:** zod on every body/query/param; size limits (`express.json({limit:'100kb'})`)
- **SQL:** parameterized statements only
- **XSS:** React escaping; no raw HTML; CSP via `helmet`
- **CSRF:** SameSite=Strict, plus an origin check on mutating routes
- **Rate limiting:** auth (5/min/IP), public RSVP, AI endpoints
- **QR/invite tokens:** random 128-bit invite token; entry QR = `base64url(guestId.partyId.exp).HMAC-SHA256`, verified server-side, single check-in flag; no PII in the QR
- **Secrets:** `.env` git-ignored; `.env.example` only; the API key never reaches the client
- **Privacy:** guests' contact data visible only to the host; report hides PII by default; "Delete party" cascades guest data
- **Dependencies:** minimal; `npm audit` in CI

---

## 11. Accessibility (WCAG 2.2 AA)

- Semantic HTML landmarks (`header/nav/main`), one `h1` per page, logical heading order
- **Full keyboard flow:** wizard option cards are native radio/checkbox inputs; visible focus rings; skip-to-content link; tablist with arrow-key support
- Stepper: `<ol>` with `aria-current="step"`; stale steps announced ("needs review")
- Form errors linked with `aria-describedby`; `aria-live="polite"` for autosave status, cost updates and toasts
- Color contrast ≥ 4.5:1 in light and dark themes; status never by color alone (icon + text)
- Theme palette swatches have text labels; charts include a data table alternative
- `prefers-reduced-motion` respected; `prefers-color-scheme` default plus a manual toggle
- Target size ≥ 24×24 px; responsive down to 320 px; zoom to 200% without loss
- Check-in has a manual search alternative to the camera
- Automated: `vitest-axe` on key screens; manual: keyboard-only walkthrough checklist in `docs/a11y-checklist.md`

---

## 12. Efficiency

- Engine is pure and synchronous: estimates run in under 1 ms, so live cost updates need no network round-trip (shared `engine` package runs client-side too)
- AI calls: only on explicit steps (theme, invites, ideas), cached by input hash, debounced, with a timeout
- Route-level code splitting (`React.lazy`) for wizard, report and scanner
- SQLite indexes on `parties(owner_id,date)`, `tasks(party_id,due_date)`, `guests(invite_token)`
- Party Hall list endpoint returns a lightweight projection (no nested guests)
- No heavy UI or chart libraries (inline SVG); target JS bundle under 200 KB gzipped
- Repo stays well under 10 MB: no binaries, `node_modules`/`dist`/`*.db` git-ignored, SVG icons/emoji only

---

## 13. Testing Strategy

| Level | Tool | What |
|---|---|---|
| Unit | Vitest | Every rule in §6 (kids → no bar, wedding → registry, community → permits), cost estimator math, timeline compression, vendor ranking, dependency/stale graph, QR token sign/verify |
| API | Vitest + Supertest (in-memory SQLite) | Auth flows, validation errors, **ownership/IDOR checks**, wizard autosave + stale detection, RSVP + +1, check-in (valid/duplicate/forged), rate limits |
| AI | Vitest with a mocked client | Valid JSON → used; invalid → retry → fallback; no key → fallback |
| Component | React Testing Library | OptionGroup keyboard selection, stepper jump-back, Review "Change" navigation, budget warnings |
| Accessibility | vitest-axe | Login, Onboarding, Party Hall, Wizard step, RSVP page: zero violations |
| Smoke (optional) | Playwright | Sign up → onboard → create party → RSVP → check-in → print report |

`npm test` runs all suites; target ≥ 80% coverage on `engine/` and `services/`. GitHub Actions workflow: lint → typecheck → test → build.

---

## 14. Folder Structure

```
celebrAItions/
├─ README.md
├─ plan/BLUEPRINT.md
├─ .env.example
├─ .gitignore                 # node_modules, dist, *.db, .env, coverage
├─ package.json               # npm workspaces: client, server, shared
├─ .github/workflows/ci.yml
├─ shared/                    # used by client AND server
│  └─ src/
│     ├─ schemas/             # zod: party, guest, task, profile, wizard
│     ├─ engine/              # pure logic
│     │  ├─ rules/            # eventRules.ts, barRules.ts, giftRules.ts, attireRules.ts
│     │  ├─ costEstimator.ts
│     │  ├─ timelineBuilder.ts
│     │  ├─ vendorRanker.ts
│     │  └─ dependencyGraph.ts   # stale-step logic
│     └─ constants.ts
├─ server/
│  ├─ src/
│  │  ├─ app.ts, index.ts
│  │  ├─ config.ts            # env parsing (zod)
│  │  ├─ db/ (connection.ts, migrations.sql, seed.ts)
│  │  ├─ middleware/ (auth.ts, validate.ts, rateLimit.ts, errorHandler.ts)
│  │  ├─ routes/ (auth, profile, parties, tasks, budget, guests, vendors, rsvp, ai)
│  │  ├─ services/ (authService, partyService, inviteService, reportService, aiService)
│  │  ├─ repositories/
│  │  └─ ai/ (prompts/, fallback/)
│  ├─ seed/ (cities.json, vendors.json, menus.json, taskTemplates.json, themes.json)
│  └─ tests/
├─ client/
│  ├─ index.html
│  └─ src/
│     ├─ main.tsx, App.tsx, routes.tsx
│     ├─ api/                 # typed fetch client
│     ├─ components/          # OptionGroup, Stepper, Card, Modal, Toast, BudgetDonut, QrCode
│     ├─ features/
│     │  ├─ auth/  onboarding/  partyHall/  partyDetail/
│     │  ├─ wizard/ (steps/Step01Basics.tsx … Step11Invites.tsx, Review.tsx, useWizard.ts)
│     │  ├─ rsvp/  checkin/  report/
│     ├─ styles/ (tokens.css, print.css)
│     └─ tests/
└─ docs/ (a11y-checklist.md, screenshots/*.webp — keep small)
```

---

## 15. Extra Features (Beyond the Brief)

**Core extras (build these):**
1. **Demo/guest mode**: one-click seeded account (great for graders)
2. **Budget tracker**: actual vs estimated, expense entry, over-budget alerts, "Suggest savings"
3. **Live cost meter**: sticky footer in the wizard updating as options change
4. **Day-of run-sheet**: hour-by-hour schedule with vendor arrival times
5. **Add to calendar (.ics)** for host and guests
6. **Duplicate party as template** (annual Diwali Mela, yearly birthday)
7. **Dietary coverage meter**: does the menu cover every guest's declared diet, including +1s?
8. **Weather/season advisory**: rule-based by city and month (no API needed)
9. **Dark mode** + reduced motion
10. **CSV import/export** of guests and budget

**Stretch extras (if time allows):**
11. Co-host collaboration (invite by email, roles)
12. Seating chart (drag-and-drop tables, auto-group by `group_tag`, keyboard-accessible alternative)
13. Vendor comparison view (side by side, up to 3)
14. "Ask celebrAItions" chat scoped to a party
15. Post-event: thank-you note generator, feedback survey link, expense reconciliation
16. Multi-function weddings (Mehendi/Sangeet/Wedding/Reception as sub-events sharing one guest list)
17. Volunteer roster and shift sign-up for community events
18. Sustainability tips (digital invites, local caterers, waste plan) with a "green score"
19. Multi-language UI (English/Hindi) via a simple i18n dictionary
20. PWA offline read of the run-sheet on event day

---

## 16. Build Plan (Fits the 3-Attempt Rule)

Commit and push after every phase, on `main` only.

| Phase | Deliverable | Done when |
|---|---|---|
| **P0 Setup** | git init, workspaces, TS, ESLint/Prettier, Vitest, CI, `.gitignore`, `.env.example` | `npm test` and `npm run dev` work |
| **P1 Engine** | `shared/engine` rules, estimator, timeline, ranker, dependency graph + **unit tests** | ≥ 90% engine coverage |
| **P2 Backend** | DB + seed, auth, parties CRUD, wizard autosave, generate, suggestions, estimate + API tests | Supertest suite green |
| **P3 Frontend core** | Login, Onboarding, Party Hall, OptionGroup, Stepper, Wizard 1–11, Review with Change | Full create flow in browser |
| **P4 Party Detail** | Tabs: overview, tasks by subcategory, budget, guests, vendors, menu, timeline, ideas | Edit plan → stale → regenerate works |
| **P5 Invites** | RSVP page, +1, QR generation, check-in scanner, .ics | Forged/duplicate QR rejected (tests) |
| **P6 AI** | aiService + prompts + fallback + cache | Works with and without key |
| **P7 Report & polish** | Print report, a11y pass (axe), dark mode, empty/loading/error states | axe zero violations |
| **P8 Submission** | README, screenshots (webp, small), size check (`du -sh`; < 10 MB), single branch check | **Attempt #1** |

Attempts #2 and #3 are reserved for fixes from feedback; don't burn them on unfinished work.

---

## 17. README Outline & Assumptions

**README sections:** Chosen vertical · Problem & persona · Features (with screenshots) · Approach & logic (rules-decide/AI-decorates, decision tables, dependency graph) · How it works (architecture diagram, flow) · Setup (`npm install && npm run dev`, optional `ANTHROPIC_API_KEY`) · Demo login · Testing (`npm test`, coverage) · Security · Accessibility · Assumptions · Future work.

**Assumptions:**
- Vendor, venue and caterer data is **curated seed data** (no live marketplace APIs); prices are indicative city-indexed estimates
- Cost estimates are planning guidance, not quotes; tax and contingency rates are configurable
- Currency is chosen at onboarding; no live FX conversion
- Invites are shared via link, WhatsApp share URL or `mailto:`; no paid email/SMS provider
- Camera check-in requires HTTPS or localhost; manual search is the fallback
- AI is optional: without an API key the app uses the built-in template library
- Single-host ownership by default; collaboration is a stretch feature
- Alcohol suggestions respect user preference and kid-heavy events; legal drinking age and licensing are flagged as host responsibility tasks

---

### Starter prompt for building (paste into your AI platform)
> "Read plan/BLUEPRINT.md. Implement Phase P0 and P1 exactly as specified: npm workspaces (client, server, shared), TypeScript, Vitest, and the pure engine in `shared/src/engine` with full unit tests for every rule in §6. Keep code small, typed and documented. Don't add dependencies beyond those in §2."
