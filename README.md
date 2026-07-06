# Tide House Bookings

A reusable booking engine for the **Steady Labs** platform. First client:
**The Tide House** (sauna & cold plunge).

## Architecture

The codebase separates the reusable **engine** from tenant-specific **config**:

```
src/
  engine/                reusable, business-agnostic booking engine
    types.ts             config & domain contracts
    index.ts             engine public surface — import from "@/engine"
  config/
    tenant.config.ts     The Tide House specifics (name, copy, currency…)
  app/                   Next.js App Router routes
    layout.tsx
    page.tsx
    globals.css          Tailwind v4 + design tokens
```

To onboard another business later, supply a new `tenant.config.ts` — the
engine needs no changes.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4. Supabase, Stripe, and
Resend are wired in later stages (see `.env.example` for the keys they need).

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Copy `.env.example` to `.env.local` before working on later stages.
