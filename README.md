# Orbit Booking

Production-ready online appointment booking SaaS with **Next.js**, **Supabase** (PostgreSQL + RLS), English/Arabic i18n + RTL, and WhatsApp workflows.

## Features

- Marketing landing page with WhatsApp inquiry CTA (`استفسر الآن`)
- Master Admin panel — business CRUD, renew (+1 month), WhatsApp reminders, analytics
- Business dashboard — services, appointments, availability rules (hours, breaks, buffer)
- Public booking page at `/[locale]/book/[slug]` with slot engine + WhatsApp confirmation
- Password hashing (bcrypt), HTTP-only JWT cookies, Zod validation, Supabase RLS

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Supabase Free Tier (PostgreSQL, anon + service role)
- jose (sessions) · bcryptjs · date-fns-tz · zod

## Setup

### 1. Install

```bash
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** and run the full script in:

   `supabase/migrations/001_initial_schema.sql`

3. Copy project URL and keys from **Settings → API**

### 3. Environment

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY` | Anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — never expose to the browser |
| `AUTH_SECRET` | Random string, ≥ 32 characters |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Default `96170985130` |

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (redirects to `/en`).

### Default admin

After running the migration:

- Username: `admin`
- Password: `admin`

Change these immediately from **Admin → Update credentials**.

## Routes

| Path | Description |
|------|-------------|
| `/en`, `/ar` | Landing page |
| `/[locale]/admin/login` | Master admin login |
| `/[locale]/admin` | Admin dashboard |
| `/[locale]/dashboard/login` | Business login |
| `/[locale]/dashboard` | Business portal |
| `/[locale]/book/[slug]` | Public customer booking |

## Security notes

- Admin and business mutations use the **service role** only on the server
- `admins` and password hashes are blocked from public writes via RLS
- Public booking inserts go through `create_public_appointment` (SECURITY DEFINER) with conflict checks
- Inputs validated with Zod; passwords hashed with bcrypt (cost 12)
- Session cookie: `httpOnly`, `sameSite=lax`, `secure` in production

## Branding

Logo: `public/orbit-booking-logo.jpg`  
Palette: navy `#003366`, blue `#007BFF` → cyan `#00C6FF`, purple `#7B2CBF`, orange `#FF8C00`
