# Annie's Car Rental

Full-stack car rental platform for Annie's Car Rental in Port St. Lucie, FL.

## Architecture

| Layer | Tech | Location |
|-------|------|----------|
| Customer Website | React 19 + TypeScript + Vite 6 + Tailwind v4 | `/` (root) |
| Admin Dashboard | React 18 + JSX + Vite 5 + Tailwind v3 | `/dashboard` |
| Backend API | Node.js + Express (Vercel Serverless) | `/backend` |
| Database | Supabase (PostgreSQL) | Hosted |
| Payments | Stripe | Integrated |
| Notifications | Resend (email) + Twilio (SMS) | Integrated |

## Local Development

**Prerequisites:** Node.js 18+

```bash
# Install dependencies
npm install
cd dashboard && npm install
cd ../backend && npm install

# Run customer site
npm run dev

# Run dashboard
cd dashboard && npm run dev

# Run backend API
cd backend && npm run dev
```

## Environment Variables

Copy `.env.example` files in root, `/dashboard`, and `/backend` directories. See `HANDOFF.md` for the full list of required variables.

## Deployment

All three apps deploy to Vercel automatically on push to `main`.

## Documentation

| File | Purpose |
|------|---------|
| `HANDOFF.md` | Complete technical overview (gitignored — local only) |
| `PROJECT_MAP.md` | File dependency map |
| `CHANGE_PROTOCOL.md` | Before/during/after checklist for code changes |
| `CODEBASE_AUDIT.md` | Security and architecture audit findings |
| `CLAUDE.md` | AI assistant rules and constraints |
