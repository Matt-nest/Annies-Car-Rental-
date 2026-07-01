# CURSOR_HANDOVER.md — Autonomous Agent Onboarding

> Purpose: everything Cursor (or any AI agent) needs to work on **Annie's Car Rental**
> and **JD Coastal** to Matt's standard — access, credentials, CLIs, MCP, skills, and
> the goals/differences between the two businesses.
>
> **This file contains NO secret values** — only variable *names* and *where to get them*.
> Keep the filled-in secrets in a separate, git-ignored vault (see "Credentials Vault" below).

---

## 0. TL;DR — Hand these over and Cursor is autonomous

| # | Thing | Where it lives | Cursor needs |
|---|-------|----------------|--------------|
| 1 | **GitHub access** | github.com/Matt-nest | PAT or repo collaborator + `gh auth login` |
| 2 | **Vercel access** | vercel.com (2 projects per clone) | `vercel login` + team access, or `VERCEL_TOKEN` |
| 3 | **Supabase access** | 2 projects (Annie's `yrerx…`, JD `asdhn…`) | Service key per project + correct MCP ref |
| 4 | **Payment keys** | Square (Annie's), Stripe (JD/legacy) | Backend `.env` values |
| 5 | **Notification keys** | Resend, Twilio, GHL webhooks | Backend `.env` values |
| 6 | **Misc integrations** | reCAPTCHA, Bonzah, Auto.dev, Sentry | Backend/frontend `.env` values |
| 7 | **Rules + design skill** | `CLAUDE.md`, `.claude/skills/ui-ux-pro-max` | Port to `.cursor/rules/` |

The rest of this doc explains each. **Section 7 (Gap Analysis)** is the exact checklist of
what only you can provide vs. what's already in the repo.

---

## 1. The Two Businesses — Goals & Differences

Both are the **same codebase** (white-label clone-per-client). JD Coastal was cloned from
Annie's. See `NEW_CLIENT.md` and the white-label architecture notes.

### Annie's Car Rental
- **Location:** Port St. Lucie, FL
- **Brand accent:** Gold `#D4AF37` — "Premium Fleet Command" dark-luxury identity
- **Payments:** **Square** (behind `PAYMENT_PROVIDER` flag) — NOT Stripe
- **Supabase project:** `yrerxvuyeglrypeufjpy`
- **GitHub:** `github.com/Matt-nest/Annies-Car-Rental-`

### JD Coastal
- **Payments:** Stripe (legacy default) — verify current `PAYMENT_PROVIDER`
- **Supabase project:** `asdhnzdjpweyntxmutum`
- **GitHub:** `github.com/Matt-nest/JDCoastal` (has a `template` remote pointing back at Annie's)
- Cloned from Annie's; keeps its own git history and `.env` brand values.

### What's shared vs. per-clone
- **Shared:** all app code, component structure, backend routes, email design system,
  the "never hardcode palette hex — drive from `brand.colors`" rule.
- **Per-clone:** `.env*` brand values, Supabase project, Vercel projects, payment provider,
  domain, logo/print assets.

> ⚠️ **Never assume a change in one repo applies to the other.** They diverge. If you fix a
> bug in Annie's that also exists in JD, port it explicitly.

---

## 2. Architecture (both repos, identical shape)

| Layer | Tech | Location | Deploys to |
|-------|------|----------|-----------|
| Customer site | React 19 + Vite 6 + Tailwind v4 | `/` (root `src/`) | Vercel project A (customer-site) |
| Admin dashboard | React 18 + Vite 5 + Tailwind v3 | `/dashboard` | Vercel project B (`*-dashboard`) |
| Backend API | Node + Express (serverless) | `/backend` | **Same Vercel project as the dashboard** |
| Database | Supabase (Postgres) | hosted | — |

**Critical deploy topology** (from prod notes): each clone = **2 Vercel projects**, NOT 3.
The backend rides inside the `dashboard` / `<clone>-dashboard` project at `admin.dashboard.*`.
The `backend/.vercel` link is misleading — set backend env vars on the **dashboard** project.

**Production branch:** prod deploys from `integration/unify-all-functionality` (via Vercel
branch switch on both projects), **not** `main`. `main` is stale. Confirm before assuming.

Local dev:
```bash
npm run dev                 # customer site
cd dashboard && npm run dev # dashboard
cd backend && npm run dev   # API
```

---

## 3. Credentials & Access Matrix

Everything below already has an `.env.example` in the repo listing the **names**. Cursor needs
the **values**, which live in your `.env` files locally and in Vercel env settings.

### 3a. GitHub
- **Give:** add Cursor's environment as a collaborator on both repos, OR a fine-grained PAT
  scoped to `Matt-nest/Annies-Car-Rental-` and `Matt-nest/JDCoastal` (contents + PR + workflow).
- **Setup:** `gh auth login` (or `GH_TOKEN` env var). The agent uses `gh` for PRs/issues.

### 3b. Vercel (2 projects per clone = 4 total)
- **Give:** invite to the Vercel team, OR a `VERCEL_TOKEN`.
- **Setup:** `npm i -g vercel && vercel login`. Each repo already has a `.vercel/` link.
- Remember: backend env vars go on the **dashboard** project, not customer-site.

### 3c. Supabase — ⚠️ READ THIS
Two separate projects. **The project refs are easy to cross-wire:**

| Repo | Backend `SUPABASE_URL` (source of truth) | Correct MCP `project_ref` |
|------|------------------------------------------|---------------------------|
| Annie's | `yrerxvuyeglrypeufjpy` | `yrerxvuyeglrypeufjpy` |
| JD Coastal | `asdhnzdjpweyntxmutum` | `asdhnzdjpweyntxmutum` |

> 🔴 **Known bug:** Annie's `.mcp.json` currently points at `asdhnzdjpweyntxmutum` — which is
> **JD Coastal's** database. As-is, an agent applying a migration from Annie's repo hits JD's DB.
> **Before letting Cursor run any migration, verify `get_project_url` matches the repo's backend
> `SUPABASE_URL`.** Fix `.mcp.json` per repo (see Section 5).

- **Give per project:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
  (service key = full DB access; treat as top-secret).
- Dashboard also needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

### 3d. Payments
- **Annie's = Square:** `SQUARE_ENVIRONMENT`, `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`,
  `SQUARE_APPLICATION_ID`, `SQUARE_WEBHOOK_SIGNATURE_KEY`, `SQUARE_WEBHOOK_NOTIFICATION_URL`.
  Get from Square Developer Dashboard.
- **Stripe (JD/legacy):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PUBLISHABLE_KEY` / `VITE_STRIPE_PUBLISHABLE_KEY`. From Stripe Dashboard.
- `PAYMENT_PROVIDER` / `VITE_PAYMENT_PROVIDER` selects which is live.
- ⚠️ Stripe webhooks need the **raw body** — `api/index.js` global JSON parser has bitten this
  before. If card-on-file breaks in prod, check the raw-body handling first.

### 3e. Notifications
- **Resend (email):** key in backend env (email system). Templates live in the DB
  (`email_templates`) — see `project_email_design_system` note; don't hardcode palette hex.
- **Twilio (SMS):** account SID / auth token / from-number in backend env.
- **GoHighLevel webhooks:** `GHL_WEBHOOK_BOOKING_CREATED`, `_APPROVED`, `_DECLINED`,
  `_CANCELLED`, `_PICKUP_REMINDER`, `_RETURN_REMINDER`, `_COMPLETED`. From GHL.

### 3f. Other integrations
- `VITE_RECAPTCHA_SITE_KEY` (+ backend secret) — Google reCAPTCHA. Missing/misconfigured
  loader has caused fresh-clone booking 403s.
- `BONZAH_API_BASE_URL` / `BONZAH_EMAIL` / `BONZAH_PASSWORD` — insurance add-on.
- `AUTO_DEV_API_KEY` — vehicle data (Auto.dev).
- `SENTRY_DSN` / `VITE_SENTRY_DSN` — error tracking.
- `CRON_SECRET`, `CRON_TIMEZONE` — protects cron endpoints.
- `API_KEY`, `CORS_ORIGINS`, `OWNER_EMAIL`, `DASHBOARD_URL`, `TAX_RATE` — backend config.

### 3g. Credentials Vault (how to actually hand it over)
Don't paste secrets into this doc. Instead:
1. The real values already exist in each repo's git-ignored `.env`, `backend/.env`,
   `dashboard/.env`, plus `.env.vercel`.
2. For Cursor cloud/background agents, add the same keys in Cursor's **encrypted secrets /
   environment settings** (never commit them).
3. Source of truth for prod = Vercel env vars on each project. Pull with
   `vercel env pull` if you need to sync local.

---

## 4. CLIs to install

```bash
npm i -g vercel        # deploys, env pull
gh auth login          # GitHub PRs/issues (or set GH_TOKEN)
npm i -g supabase      # optional: local stack / migrations CLI
```
Node 18+ required. Square/Stripe are SDKs (already in `package.json`), no separate CLI needed.

---

## 5. MCP Servers

Currently only Supabase MCP is configured (HTTP transport). **Configure one per repo with the
correct ref.**

Annie's `.mcp.json` (fix the ref to Annie's own project):
```json
{ "mcpServers": { "supabase": {
  "type": "http",
  "url": "https://mcp.supabase.com/mcp?project_ref=yrerxvuyeglrypeufjpy"
}}}
```
JD Coastal `.mcp.json` (create it — currently missing):
```json
{ "mcpServers": { "supabase": {
  "type": "http",
  "url": "https://mcp.supabase.com/mcp?project_ref=asdhnzdjpweyntxmutum"
}}}
```
**Guardrail:** before any `apply_migration`, run `get_project_url` and confirm it matches the
repo's backend `SUPABASE_URL`. Never migrate through MCP without this check.

Optional MCPs worth adding later: GitHub MCP (if not using `gh`), Vercel MCP, Sentry MCP.

---

## 6. Rules & Design Skill (getting Cursor to "your standard")

Cursor doesn't read `CLAUDE.md` or `.claude/skills/` automatically. Port them:

1. **Rules → `.cursor/rules/`**: create `annies.mdc` that mirrors `CLAUDE.md` — the hard rules
   (`api/client.js` never touch, `auth/` never touch, no schema changes without instruction,
   CSS-variable discipline, blast-radius ≤ 3 files without approval), plus "read `PROJECT_MAP.md`,
   `CHANGE_PROTOCOL.md`, `CHANGELOG_SESSION.md` before changing code."
2. **Design skill**: you already have `ui-ux-pro-max` under `.claude/skills/ui-ux-pro-max/`
   (colors/typography/charts/UX-guidelines CSVs + per-stack data incl. react, tailwind, shadcn).
   Point a Cursor rule at that folder as the design reference, or copy it to `.cursor/`.
   Design language is fixed: Inter + JetBrains Mono, dashboard accent `#465FFF`, customer accent
   gold `#D4AF37`, everything via CSS variable tokens.
3. **The doc set the agent must respect** (already in each repo): `PROJECT_MAP.md` (dependency
   map + danger zones), `CHANGE_PROTOCOL.md` (checklist), `CHANGELOG_SESSION.md` (log every
   change), `DEPLOY.md`, `NEW_CLIENT.md`, `CODEBASE_AUDIT.md`, `E2E_TEST_PLAN.md`.

Useful matching skills from your library (map to Cursor rules or invoke on demand):
`frontend-dev-guidelines`, `backend-dev-guidelines`, `supabase-automation`, `square-automation`,
`stripe-integration`, `vercel-deployment`, `react-best-practices`, `tailwind-design-system`,
`code-review-excellence`, `verification-before-completion`.

---

## 7. Gap Analysis — what only YOU can provide

Cursor **already has** (in-repo, no action needed):
- ✅ Both codebases + full git history
- ✅ Architecture/dependency maps (`PROJECT_MAP.md`), change discipline (`CHANGE_PROTOCOL.md`),
  session history (`CHANGELOG_SESSION.md`), deploy + new-client runbooks
- ✅ Env var **names** (`.env.example` in root/backend/dashboard)
- ✅ Design skill data (`ui-ux-pro-max`)
- ✅ Supabase MCP scaffolding (refs need correcting)

Cursor is **missing** — you must supply:

| Gap | Action |
|-----|--------|
| 🔑 Secret **values** for every key in §3 | Add to Cursor secrets / confirm local `.env`s populated |
| 🔑 GitHub auth | Collaborator or PAT + `gh auth login` |
| 🔑 Vercel auth | Team invite or `VERCEL_TOKEN` + `vercel login` |
| 🔑 Supabase service keys (×2 projects) | From Supabase dashboard → API settings |
| 🛠️ Fix Annie's `.mcp.json` ref (`asdhn…` → `yrerx…`) | Section 5 |
| 🛠️ Create JD's `.mcp.json` (missing) | Section 5 |
| 📏 `.cursor/rules/` port of `CLAUDE.md` + design skill | Section 6 |
| 🧭 Which git branch is prod right now | Confirm `integration/unify-all-functionality` still current |
| 🧭 Current `PAYMENT_PROVIDER` per clone | Annie's = Square; confirm JD |
| 🖥️ CLIs installed in Cursor's env | `vercel`, `gh`, optional `supabase` |

---

## 8. Golden Rules (paste into `.cursor/rules/`)

1. Read `PROJECT_MAP.md` + `CHANGE_PROTOCOL.md` before touching code; log to `CHANGELOG_SESSION.md`.
2. **Never** modify `api/client.js`, `auth/`, or Supabase schema without explicit instruction.
3. Blast radius > 3 files → stop and ask.
4. Never hardcode palette hex — drive from `brand.colors` / CSS variable tokens.
5. Verify Supabase MCP `project_ref` matches the repo's backend `SUPABASE_URL` before migrating.
6. Annie's ≠ JD Coastal — port fixes explicitly, don't assume.
7. Backend env vars live on the **dashboard** Vercel project, not customer-site.
8. Stripe/Square webhooks need raw body — don't let the global JSON parser eat it.
9. `npm run build` must pass with zero errors before done.
