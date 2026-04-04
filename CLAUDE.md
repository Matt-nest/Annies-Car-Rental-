# CLAUDE.md — Annie's Car Rental Dashboard

## Required Reading

**Before making any code change, read these three files:**

1. **[PROJECT_MAP.md](PROJECT_MAP.md)** — Every file, every import, every API function, every Supabase table, danger zones, blast radius. If you don't know who imports a file you're changing, look it up here.

2. **[CHANGE_PROTOCOL.md](CHANGE_PROTOCOL.md)** — The before/during/after checklist. Follow every step. Hard stop at blast radius > 3 files without user approval.

3. **[CHANGELOG_SESSION.md](CHANGELOG_SESSION.md)** — What changed in previous sessions. Add an entry for everything you build this session.

---

## Project Structure

```
Annies Car Rental/
├── dashboard/          ← All frontend work happens here
│   ├── src/
│   │   ├── api/client.js       ← NEVER TOUCH — 25 consumers
│   │   ├── auth/               ← NEVER TOUCH
│   │   ├── components/
│   │   │   ├── dashboard/      ← Widget engine + all 12 widgets
│   │   │   ├── layout/         ← Sidebar + DashboardLayout
│   │   │   ├── settings/       ← Widget layout settings (dnd-kit)
│   │   │   └── shared/         ← StatusBadge, Modal, Skeleton, etc.
│   │   ├── hooks/              ← useWidgetLayout, useCountUp
│   │   ├── lib/                ← queryCache, widgetConfig, cn
│   │   ├── pages/              ← 11 page components
│   │   └── styles/globals.css  ← ALL CSS variables — high blast radius
│   ├── package.json
│   └── vercel.json
├── backend/            ← Node.js Express API (separate Vercel project)
├── PROJECT_MAP.md      ← Dependency map
├── CHANGE_PROTOCOL.md  ← Change discipline rules
└── CHANGELOG_SESSION.md ← Per-session change log
```

## Hard Rules

- **`api/client.js`** — Never modify. 25 consumers. Blast radius = entire app.
- **`auth/`** — Never modify. Break auth = nothing works.
- **Supabase schema** — Never change without explicit user instruction.
- **GHL webhooks** — Never touch webhook routes in backend.
- **CSS variables** — Never rename a `--variable` without searching all usages first.
- **Widget IDs** — IDs in `widgetConfig.js` must exactly match keys in `DashboardLayoutEngine.jsx`'s `WIDGET_COMPONENTS` map.

## Stack

React 18 + Vite 5 + Tailwind 3 + Framer Motion 12 + Recharts 2 + Supabase Auth + dnd-kit

Dev server: `cd dashboard && npm run dev`
Build check: `cd dashboard && npm run build`

## Design Language — "Premium Fleet Command"

- Sidebar: `#0F172A` (always dark)
- Accent: `#D4AF37` (gold)
- Fonts: Outfit + JetBrains Mono
- Cards use CSS variable tokens (`var(--bg-card)`, `var(--border-subtle)`, etc.)
- All colors via CSS variables — no hardcoded hex except in the gold accent and danger red

## Workflow for Every Change

1. Read PROJECT_MAP.md for the file you're touching
2. Count blast radius — stop at 4+ files without user approval
3. Make the smallest change that achieves the goal
4. Run `npm run build` — zero errors required
5. Add an entry to CHANGELOG_SESSION.md
