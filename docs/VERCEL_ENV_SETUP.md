# Vercel environment variables — Annie's Car Rental

Use this as a copy-paste checklist for both Vercel projects.

Generate a portal secret once:

```bash
openssl rand -hex 32
```

---

## Project 1: `annies-car-rental` (customer site → anniescarrental.com)

| Variable | Value (placeholder) | Notes |
|----------|---------------------|--------|
| `VITE_API_URL` | `https://admin.dashboard.anniescarrental.com/api/v1` | Required |
| `VITE_PAYMENT_PROVIDER` | `square` | Required |
| `VITE_SQUARE_APPLICATION_ID` | `sq0idp-...` | From Square Developer → Credentials |
| `VITE_SQUARE_LOCATION_ID` | `L...` | From Square → Locations |
| `VITE_SQUARE_ENVIRONMENT` | `production` | |
| `VITE_CRISP_WEBSITE_ID` | your Crisp ID | Optional |
| `VITE_API_KEY` | your public API key | If used for bookings |

**Remove from this project:** `PORTAL_JWT_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY`

---

## Project 2: dashboard/backend (`admin.dashboard.anniescarrental.com`)

| Variable | Value (placeholder) | Notes |
|----------|---------------------|--------|
| `PORTAL_JWT_SECRET` | output of `openssl rand -hex 32` | Required for customer portal |
| `PAYMENT_PROVIDER` | `square` | Required |
| `SQUARE_ACCESS_TOKEN` | `EAAA...` | Square access token |
| `SQUARE_LOCATION_ID` | `L...` | Same as customer site |
| `SQUARE_ENVIRONMENT` | `production` | |
| `SUPABASE_URL` / keys | from Supabase | JD uses different project than Annie |
| `VITE_PAYMENT_PROVIDER` | `square` | Hides Stripe nav when set to square |
| `VITE_API_URL` | `https://admin.dashboard.anniescarrental.com/api/v1` | Dashboard build |

---

## Quick verify

```bash
curl -s https://admin.dashboard.anniescarrental.com/api/v1/health
curl -s -X POST https://admin.dashboard.anniescarrental.com/api/v1/portal/verify \
  -H "Content-Type: application/json" \
  -d '{"bookingCode":"TEST","email":"test@example.com"}'
```
