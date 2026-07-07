# Vercel environment variables — Annie's Car Rental

I can't edit your Vercel account from here. Use this as a copy-paste checklist.

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
| `VITE_SQUARE_APPLICATION_ID` | `sq0idp-...` | **Add this** — from Square Developer → Credentials |
| `VITE_SQUARE_LOCATION_ID` | `L...` | **Add this** — from Square → Locations |
| `VITE_SQUARE_ENVIRONMENT` | `production` | **Add this** |
| `VITE_CRISP_WEBSITE_ID` | your Crisp ID | Optional |
| `VITE_API_KEY` | your public API key | If used for bookings |

**Remove from this project:**

- `PORTAL_JWT_SECRET` — backend only; does nothing on the customer site
- `VITE_STRIPE_PUBLISHABLE_KEY` — Annie uses Square, not Stripe

After changes → **Redeploy** `annies-car-rental`.

---

## Project 2: dashboard/backend (`admin.dashboard.anniescarrental.com`)

| Variable | Value (placeholder) | Notes |
|----------|---------------------|--------|
| `PORTAL_JWT_SECRET` | output of `openssl rand -hex 32` | **Move here** from customer site |
| `PAYMENT_PROVIDER` | `square` | Required |
| `SQUARE_ACCESS_TOKEN` | `EAAA...` | Square → Credentials → Access token |
| `SQUARE_LOCATION_ID` | `L...` | Same location as customer site |
| `SQUARE_ENVIRONMENT` | `production` | |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | from Square webhooks | |
| `SQUARE_WEBHOOK_URL` | `https://admin.dashboard.anniescarrental.com/api/v1/square/webhook` | |
| `SUPABASE_URL` | `https://xxxx.supabase.co` | |
| `SUPABASE_ANON_KEY` | `eyJ...` | |
| `SUPABASE_SERVICE_KEY` | `eyJ...` | Server only |
| `VITE_API_URL` | `https://admin.dashboard.anniescarrental.com/api/v1` | Dashboard build |
| `VITE_SUPABASE_URL` | same as `SUPABASE_URL` | Dashboard auth |
| `VITE_SUPABASE_ANON_KEY` | same as `SUPABASE_ANON_KEY` | Dashboard auth |
| `VITE_PAYMENT_PROVIDER` | `square` | Dashboard UI |
| `VITE_SQUARE_APPLICATION_ID` | same as customer site | If dashboard shows Square UI |
| `VITE_SQUARE_LOCATION_ID` | same as customer site | |
| `VITE_SQUARE_ENVIRONMENT` | `production` | |

After changes → **Redeploy** the dashboard project.

---

## Quick verify

```bash
# Backend up
curl -s https://admin.dashboard.anniescarrental.com/api/v1/health

# Portal secret set on backend (not "not configured")
curl -s -X POST https://admin.dashboard.anniescarrental.com/api/v1/portal/verify \
  -H "Content-Type: application/json" \
  -d '{"bookingCode":"TEST","email":"test@example.com"}'
# Expect: {"error":"Booking not found"}
```

Square on customer site: after redeploy, checkout should not say "Square is not configured."
