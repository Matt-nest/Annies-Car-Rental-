# Antigravity Awesome Skills — Reference Guide
### Tailored to Annie's Car Rental + Leadflow OS
**Repo:** https://github.com/sickn33/antigravity-awesome-skills  
**Version:** V9.8.0 | 1,377+ skills  
**Last updated:** 2026-04-07

---

## Install

```bash
# Antigravity IDE (global — covers all projects)
npx antigravity-awesome-skills --antigravity

# Claude Code (project-scoped)
npx antigravity-awesome-skills --claude

# Both at once
npx antigravity-awesome-skills --antigravity && npx antigravity-awesome-skills --claude

# Verify
test -d ~/.gemini/antigravity/skills && echo "Skills installed"
```

---

## How to Invoke Skills

| Environment | Syntax |
|------------|--------|
| **Antigravity** | `Use @skill-name to [task]` |
| **Claude Code** | `/skill-name [task]` |

Skills chain: `Use @skill-a and @skill-b to [task]` — both load together.

---

## Your Core Skill Stack

These are the skills most directly mapped to your current builds. Install and know these first.

### Tier 1 — Use These Now

| Skill | What it does for you |
|-------|---------------------|
| `@kpi-dashboard-design` | Framework for Annie's KPI widget layer — strategic/tactical/operational tiers, SQL templates for MRR/retention/CAC, layout patterns. You're literally building this. |
| `@react-best-practices` | Architecture, state management, performance for React 18 + hooks. Primary engineering backbone for the dashboard. |
| `@react-patterns` | Component composition, render optimization, React 19 patterns. Use alongside `@react-best-practices`. |
| `@frontend-design` | Visual fidelity, interaction quality, design system thinking. Use whenever you're building new widgets or pages. |
| `@tailwind-patterns` | Advanced Tailwind usage, responsive patterns, utility composition. Your entire design token system runs on Tailwind. |
| `@tailwind-design-system` | Design system architecture in Tailwind — token structure, scales, theming. High relevance to `globals.css` decisions. |
| `@shadcn` | shadcn/ui component patterns. If you ever pull shadcn into Leadflow OS, this is the skill. |
| `@form-cro` | Conversion optimization for multi-step forms. Directly maps to Annie's 5-step booking flow (vehicle → dates → Bonzah insurance → SMS approval → confirmation). |
| `@stripe-integration` | Stripe setup, webhooks, Payment Intents, subscriptions. You have `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` in your backend env — this skill knows how to debug all of it. |
| `@systematic-debugging` | Step-by-step diagnostic methodology. Use when the booking flow breaks, API calls fail, GHL doesn't fire, or Stripe webhooks are silent. |
| `@brainstorming` | Structured ideation with prioritization. Use for new widget ideas, Leadflow feature planning, template business strategy. |
| `@concise-planning` | Produces tight implementation plans before code is written. Always run this before a multi-file change. |
| `@kaizen` | Continuous improvement review — surfaces what was built and flags incremental improvements. Run this at the end of every session. |

### Tier 2 — Pull In As Needed

| Skill | When to use it |
|-------|---------------|
| `@architecture` | Auditing the full backend → API → frontend chain. Especially useful when adding new endpoints or integrating new services. |
| `@browser-automation` | Writing Playwright/Puppeteer e2e tests for the booking flow and dashboard actions. |
| `@test-driven-development` | Full TDD workflow — specs before code. Use when building new booking flow steps or new API integrations. |
| `@e2e-testing-patterns` | End-to-end test strategy for the full booking loop (customer books → dashboard shows → owner approves → GHL fires → SMS → confirmation). |
| `@lint-and-validate` | Code quality pass — dead code, formatting, unused imports, naming. Run before committing a big session. |
| `@production-code-audit` | Pre-launch audit for the Leadflow template. Catches issues before a new car rental client goes live. |
| `@observability-engineer` | Logging, error tracking, monitoring. Annie's dashboard has no visibility layer right now — this tells you how to add it. |
| `@programmatic-seo` | Auto-generate city + vehicle type landing pages for car rental clients. When you clone Annie's template, this is how you dominate local search for every Florida city. |
| `@analytics-tracking` | Add behavioral analytics to the customer booking site. Understand exactly where users drop off in the 5-step flow. |
| `@ab-test-setup` | A/B testing for the booking flow. Test different step orders, CTA copy, insurance verification UX. |
| `@senior-fullstack` | Full-stack senior developer role — use when working across both `dashboard/` and `backend/` in the same session. |
| `@backend-dev-guidelines` | Node.js + Express best practices. Your `backend/server.js` and all `routes/` files. |
| `@api-patterns` | REST API design patterns. Use when adding new endpoints or refactoring existing ones. |
| `@deployment-procedures` | Vercel deployment procedures. Two-project setup (frontend + backend), env var management, rollback patterns. |
| `@verification-before-completion` | Forces a final check before marking any task done. Pairs with `@concise-planning` to bookend every session. |

---

## Bundles — Install a Full Pack At Once

The most relevant pre-configured bundles for your work:

### `Web Wizard Pack` — Primary frontend stack
```
frontend-design, react-best-practices, react-patterns,
nextjs-best-practices, tailwind-patterns, form-cro, seo-audit
```
**Best for:** Dashboard widget builds, booking flow, Leadflow template UI

### `Full-Stack Developer Pack` — Cross-cutting sessions
```
senior-fullstack, frontend-developer, backend-dev-guidelines,
api-patterns, database-design, stripe-integration
```
**Best for:** Sessions where you're touching both `dashboard/` and `backend/`

### `QA & Testing Pack` — Before any release
```
test-driven-development, systematic-debugging, browser-automation,
e2e-testing-patterns, ab-test-setup, code-review-checklist, test-fixing
```
**Best for:** Pre-launch validation of Annie's booking flow or Leadflow template

### `Startup Founder Pack` — Leadflow OS business work
```
product-manager-toolkit, competitive-landscape, competitor-alternatives,
launch-strategy, copywriting, stripe-integration
```
**Best for:** Leadflow OS product strategy, pricing, launch planning, SaaS positioning

### `Marketing & Growth Pack` — Leadflow OS GTM
```
content-creator, seo-audit, programmatic-seo, analytics-tracking,
ab-test-setup, email-sequence
```
**Best for:** Leadflow customer acquisition, Annie's site SEO, onboarding sequences

### `Business Analyst Pack` — Metrics and financials
```
business-analyst, startup-metrics-framework, startup-financial-modeling,
market-sizing-analysis, kpi-dashboard-design
```
**Best for:** Sizing the car rental dashboard SaaS market, building out Leadflow pricing model

### `Integration & APIs Pack` — External service work
```
stripe-integration, twilio-communications, hubspot-integration,
plaid-fintech, algolia-search
```
**Best for:** Stripe fixes, GHL integrations (hubspot-integration maps closely to GHL's API model), SMS workflows

### `OSS Maintainer Pack` — Git and release hygiene
```
commit, create-pr, requesting-code-review, receiving-code-review,
changelog-automation, git-advanced-workflows, documentation-templates
```
**Best for:** Keeping your git history clean, automating CHANGELOG_SESSION entries, creating clean PRs

---

## Prompt Templates — Copy These

### Dashboard Widget Build
```
Use @kpi-dashboard-design, @react-best-practices, and @frontend-design to build
[widget name] for Annie's Car Rental dashboard. It should call [api.functionName()]
from api/client.js (never modify that file). Use WidgetWrapper.jsx as the shell.
Cache key: [key name or "none"]. Follow the design tokens in globals.css — gold
accent (#D4AF37), CSS variables for all colors. Mobile-first at 375px.
```

### Booking Flow Audit + CRO
```
Use @form-cro and @systematic-debugging to audit the Annie's Car Rental 5-step
booking flow: vehicle selection → date picker → Bonzah insurance verification →
owner SMS approval → booking confirmation.

For each step: identify drop-off risk, friction points, missing loading/error states,
and CRO improvements. Then rank improvements by impact vs effort.
```

### Full Session Kickoff (Multi-File Change)
```
Use @concise-planning and @architecture to plan this change before writing any code.

[Describe what you want to build]

Rules:
- Read PROJECT_MAP.md first — trace every file's blast radius
- Stop and ask if you need to touch more than 3 files beyond what's listed in the plan
- api/client.js and auth/ are NEVER modified
- Present a phase-by-phase plan with file list before writing a single line of code
```

### End-of-Session Cleanup
```
Use @kaizen and @lint-and-validate to review everything built this session.

Identify: dead code, unused variables, redundant API calls, components that could
be simplified, anything that violates the PROJECT_MAP.md danger zones.

Then add a CHANGELOG_SESSION.md entry summarizing: files changed, API impact,
blast radius, build status, known issues.
```

### End-to-End Flow Test
```
Use @e2e-testing-patterns and @browser-automation to write tests for the full
Annie's Car Rental booking loop:

1. Customer visits site → selects vehicle → picks dates → verifies Bonzah insurance
   → submits booking
2. Owner dashboard shows pending booking → owner approves on mobile
3. GHL webhook fires → customer receives SMS confirmation
4. Vehicle availability updates on the site

Cover: happy path, Bonzah API failure, owner declines, SMS webhook failure,
concurrent booking attempt on same vehicle.
```

### Stripe Debug
```
Use @stripe-integration to debug this Stripe issue:

[Paste the exact error message, webhook payload, or behavior description]

Context: This is a Node.js Express backend (backend/server.js) deployed on Vercel
serverless. Stripe secret key and webhook secret are environment variables.
The issue is: [specific problem]
```

### New Client Template Clone
```
Use @programmatic-seo, @brand-guidelines, and @react-best-practices to prepare
the Annie's Car Rental codebase for a new client: [Client Name].

Phase 1: Extract every hardcoded value (business name, phone, location, vehicle
fleet, brand colors, logo) into a single config file.

Phase 2: Generate SEO page structure for [city/region] — vehicle type landing pages
(luxury SUV rental [city], sports car rental [city], etc.), city hub pages, and
schema markup for a local car rental business.

Phase 3: Create a client-setup checklist: what to swap, what to configure,
what to test before go-live.
```

### Leadflow OS Product Session
```
Use @product-manager-toolkit, @competitive-landscape, and @pricing-strategy to
work on Leadflow OS.

Context: Leadflow OS is a SaaS dashboard template product for car rental businesses.
The base is the Annie's Car Rental dashboard — React + Vite + Tailwind + Supabase +
GoHighLevel + Stripe. Target customers are independent car rental operators (1-50
vehicles, owner-operated).

Task: [specific Leadflow OS work]
```

### Code Quality Pass Before Commit
```
Use @lint-and-validate and @production-code-audit to do a pre-commit review.

Check: unused imports, dead code, console.logs, hardcoded values that should be
env vars, components that directly modify api/client.js or auth/ (should never
happen), any CSS variables referenced that don't exist in globals.css.

Output: a prioritized list of fixes, not just a report. Fix the critical ones.
```

---

## Skills You're Not Using (But Should Be)

These map directly to gaps in your current workflow:

### `@kaizen`
**What it is:** Continuous improvement micro-review. After every session it asks "what can be better?" and surfaces incremental improvements without big rewrites.  
**Why you need it:** You build in big sprints. Kaizen catches the small things that accumulate — dead variables, slightly wrong patterns, duplicated logic — before they become real technical debt.  
**How to use:** `Use @kaizen to review the work done this session and add a CHANGELOG_SESSION.md entry.`

### `@analytics-tracking`
**What it is:** Adds behavioral analytics to a web app — event tracking, funnel analysis, conversion measurement.  
**Why you need it:** You have a 5-step booking flow but zero visibility into where users actually abandon it. Adding Plausible, PostHog, or Mixpanel events to the booking flow would tell you exactly which step is killing conversions.  
**How to use:** `Use @analytics-tracking to add funnel tracking to the Annie's Car Rental booking flow. Track each step as a conversion event. I want to see step-by-step completion rates in [Plausible/PostHog/Mixpanel].`

### `@programmatic-seo`
**What it is:** Generates scalable SEO page structures — city pages, category pages, schema markup — from a template.  
**Why you need it:** Every new car rental client you onboard needs local SEO. "Luxury car rental Miami," "sports car rental Fort Lauderdale," etc. This skill auto-generates that entire page structure and schema markup.  
**How to use:** `Use @programmatic-seo to create a local SEO page structure for [Client Name] car rental in [City/Region]. Generate: city hub page, vehicle category landing pages (luxury, sports, SUV), schema markup for LocalBusiness + Product.`

### `@observability-engineer`
**What it is:** Logging, error monitoring, alerting patterns for production apps.  
**Why you need it:** Annie's dashboard is in production with real bookings. You have no error visibility. If a GHL webhook silently fails at 2 AM or a Stripe payment doesn't record, you won't know until a customer complains. Even a simple Sentry integration + structured backend logging would catch this.  
**How to use:** `Use @observability-engineer to add error monitoring to Annie's Car Rental. Backend is Node.js Express on Vercel. Frontend is React. I want: Sentry error tracking, structured logging for GHL webhook calls and Stripe events, and an alert when a booking mutation fails.`

### `@ab-test-setup`
**What it is:** A/B testing methodology and implementation for conversion-critical flows.  
**Why you need it:** Once you have `@analytics-tracking` in place, A/B testing is the next step. Test: 3-step vs 5-step booking flow, different insurance explanation copy (Bonzah is confusing to most renters), "Reserve Now" vs "Book Now" CTA.  
**How to use:** `Use @ab-test-setup to design an A/B test for [specific element] in the Annie's Car Rental booking flow. I want to test [variant A] vs [variant B]. Measurement: booking completion rate.`

### `@email-sequence`
**What it is:** Builds automated email sequences — onboarding, nurture, reactivation.  
**Why you need it:** For Leadflow OS — when a new car rental operator signs up, what's their onboarding experience? You need a 7-day sequence that gets them to go live, teaches them the dashboard, and upsells them on features. Also useful for Annie's own customer re-engagement.  
**How to use:** `Use @email-sequence to write a 7-day onboarding sequence for a new Leadflow OS customer (car rental operator). Goal: get them from signup to first live booking in 7 days. Each email should have one clear action.`

### `@launch-strategy`
**What it is:** Go-to-market planning for a new product — positioning, channel strategy, launch sequence, early adopter recruitment.  
**Why you need it:** Leadflow OS needs a launch plan. You have the product. What's the sequence? Waitlist → beta → paid? Which channels? Car rental Facebook groups? Independent operator associations? Cold outbound to rental companies under 20 vehicles?  
**How to use:** `Use @launch-strategy to build a go-to-market plan for Leadflow OS, a SaaS dashboard for independent car rental operators (1-50 vehicles). Target: owner-operated rental businesses. Current status: [beta/waitlist/ready to launch].`

### `@growth-engine`
**What it is:** Systematic growth strategy — acquisition loops, referral mechanics, retention levers.  
**Why you need it:** For Leadflow OS, what's the growth loop? A car rental operator who uses your dashboard and loves it — how does that turn into another customer? Referral to their operator network? Case studies? A free tier that markets itself?  
**How to use:** `Use @growth-engine to design the growth model for Leadflow OS. Context: SaaS for independent car rental operators. How do we build an acquisition loop where happy customers generate new customers?`

### `@skill-creator`
**What it is:** Teaches you the anatomy of a well-built skill file and helps you write your own.  
**Why you need it:** You have custom domain knowledge — the car rental booking flow, GHL integrations, Bonzah insurance, the Annie's template structure — that no generic skill covers. Building a `@car-rental-operator-context` skill means you stop re-explaining your domain in every prompt.  
**How to use:** `Use @skill-creator to help me build a custom skill called car-rental-operator-context. This skill should give an AI agent complete context about: the car rental business model, GoHighLevel SMS automations, Bonzah insurance verification, the Annie's Car Rental codebase structure, and the Leadflow OS product.`

### `@deployment-procedures`
**What it is:** Production deployment patterns, env var management, rollback, zero-downtime deploys.  
**Why you need it:** You have a two-project Vercel setup (dashboard frontend + backend API), and `main = production` with no staging branch. Every push is live. This skill gives you the procedures to deploy safely and roll back fast if something breaks.  
**How to use:** `Use @deployment-procedures to document the Annie's Car Rental deployment process. Two Vercel projects: dashboard frontend (prj_9mMO7xEw4oyPwAp0Pu69OTaROdhw) and backend Express API. Current: push to main = auto-deploy to production. I need: a safe deploy checklist, how to test before pushing, and a rollback procedure.`

### `@twilio-communications`
**What it is:** Twilio SMS/voice implementation patterns, webhook handling, message queuing.  
**Why you need it:** GoHighLevel runs SMS under the hood via Twilio. Understanding Twilio's patterns helps you debug GHL webhook failures and build more resilient SMS notification flows. Your `WebhookFailuresPage` exists for a reason — this skill helps you stop filling it.  
**How to use:** `Use @twilio-communications to help me debug and harden the GHL SMS webhook flow. Owner approval SMS triggers from a webhook at [GHL_WEBHOOK_URL]. I'm seeing failures logged in the webhook_failures table. Help me add retry logic and dead-letter handling.`

---

## Workflow Playbooks

### Ship a New Leadflow Template Feature
1. `@concise-planning` — plan the feature, blast radius check
2. `@react-best-practices` + `@frontend-design` — build it
3. `@test-driven-development` — write tests before code
4. `@browser-automation` — e2e test the full flow
5. `@kaizen` + `@lint-and-validate` — cleanup pass
6. `@deployment-procedures` — deploy checklist
7. `@verification-before-completion` — final gate

### Clone Annie's for a New Car Rental Client
1. `@programmatic-seo` — generate city/vehicle SEO page structure
2. `@brand-guidelines` — extract and document new client's brand
3. `@react-best-practices` — extract all hardcoded values to config
4. `@form-cro` — review and optimize booking flow for new market
5. `@analytics-tracking` — add tracking before go-live
6. `@production-code-audit` — pre-launch audit
7. `@deployment-procedures` — new Vercel project setup

### Launch Leadflow OS
1. `@competitive-landscape` — know your positioning
2. `@pricing-strategy` — finalize tiers and pricing
3. `@launch-strategy` — build the GTM plan
4. `@email-sequence` — build onboarding sequence
5. `@copywriting` — write all landing page and onboarding copy
6. `@growth-engine` — design the post-launch growth loop

---

## Quick Syntax Reference

```bash
# Single skill
Use @kpi-dashboard-design to redesign the KPI card row on the dashboard.

# Chained skills
Use @react-best-practices and @frontend-design to build the MorningBriefingWidget.

# Full workflow with context
Use @concise-planning and @architecture to plan this change before touching any code.
Here is the context: [paste relevant code or describe the goal].
Rules: never modify api/client.js or auth/. Blast radius max 3 files before asking.

# Claude Code slash syntax
/react-best-practices refactor the FleetCommandGrid component for better mobile layout

# Debug with context
Use @systematic-debugging to diagnose why the PendingApprovalsWidget shows stale data
after approve/decline. The cache key is 'overview', invalidated in queryCache.js.
```

---

## Skills That Don't Apply to Your Work

Skip these — they're in the catalog but not relevant to your stack:

- `@angular*`, `@vue-*`, `@svelte-*` — you're on React
- `@nextjs-*` — you're on Vite, not Next.js (matters for SSR patterns)
- `@odoo-*`, `@wordpress-*` — different ecosystems
- `@python-*`, `@django-*`, `@fastapi-*` — your backend is Node.js Express
- `@kubernetes-*`, `@terraform-*` — you're on Vercel serverless
- `@unity-*`, `@godot-*`, `@game-development/*` — not applicable
- `@active-directory-attacks`, `@linux-privilege-escalation` — security red team, not your use case
- `@defi-protocol-templates` — blockchain, not your stack
- `@azure-ai-*` — you're not on Azure

---

## Notes

- Skills are `SKILL.md` files loaded into the agent's context window — they're instructions, not plugins
- More skills = more context consumed. Chain 2-4 max per prompt for best results
- `@concise-planning` should almost always be your first skill on any multi-file task
- `@kaizen` should almost always be your last skill on any session
- If a skill produces output that seems off, check if your project context is in the prompt — skills work better when the agent knows your specific stack and constraints
- For sessions where you're working across `dashboard/` and `backend/`, include PROJECT_MAP.md contents in your prompt or tell Claude Code to read it first
