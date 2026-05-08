# Answer Key — Setup Guide

## 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) → New project.

## 2. Run the schema

In the Supabase Dashboard → **SQL Editor**, paste and run `supabase/schema.sql`.

Optionally run `supabase/seed.sql` for sample data (note: seed profiles use fake UUIDs and won't be linked to real auth users — they're just for display).

## 3. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Find these in Supabase Dashboard → **Settings → API**.

## 4. Configure magic link auth

In Supabase Dashboard → **Authentication → URL Configuration**:
- **Site URL**: `http://localhost:3000` (or your production URL)
- **Redirect URLs**: add `http://localhost:3000/auth/callback`

## 5. Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

- **Magic link auth**: Enter your email, click the link, you're in. On first login your profile is created automatically with 1000 pts.
- **Create a market**: Pick a question, define up to 6 options, set a closing time.
- **Bet**: Use the slider to pick an amount (10–500 pts). Live LMSR odds update as you move the slider — no network call needed.
- **Resolve**: Only the market creator can resolve. Click an option, confirm, and payouts are distributed automatically.

## LMSR pricing

The app uses the Logarithmic Market Scoring Rule. Probabilities update continuously based on bet volume — putting more money on an option raises its price. The `b=100` liquidity constant means the market can absorb moderate bet sizes without wild swings.
