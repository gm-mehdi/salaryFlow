# SalaryFlow — Personal Finance Management

Phone-first personal finance tracker (MAD by default). **Next.js** app on **Neon Postgres**, deployable to **Vercel**, protected by a shared app password.

## Quick start (local)

```bash
pnpm install
pnpm exec neon login          # once
pnpm exec neon link -y        # link org/project
pnpm exec neon env pull       # writes DATABASE_URL into .env.local
# Add to .env.local:
#   APP_SECRET=your-app-password
#   AUTH_SECRET=long-random-string-at-least-16-chars
pnpm db:migrate
pnpm dev
```

Open http://localhost:3000 — unlock with `APP_SECRET`.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production build |
| `pnpm start` | Run production server |
| `pnpm db:migrate` | Apply SQL migrations (uses `DATABASE_URL_UNPOOLED`) |
| `pnpm typecheck` | TypeScript check |

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | Neon pooled Postgres URL (app traffic) |
| `DATABASE_URL_UNPOOLED` | for migrate | Direct Neon URL (migrations) |
| `APP_SECRET` | yes | Shared unlock password |
| `AUTH_SECRET` | yes | Cookie signing key (≥16 chars) |

See [`.env.example`](.env.example).

## Deploy to Vercel

1. Push the repo and import the project in Vercel (framework: Next.js).
2. Set env vars: `DATABASE_URL`, `APP_SECRET`, `AUTH_SECRET` (and optionally `DATABASE_URL_UNPOOLED`).
3. Run `pnpm db:migrate` once from your machine (or CI) against Neon before first use.
4. Deploy. Visit the site → enter `APP_SECRET` → use the app.
5. Settings → **Lock app** clears the session cookie.

## Stack

- Next.js 15 App Router + React 19 + TanStack Query + Recharts + Tailwind 4
- Route Handler `POST /api/actions` → Drizzle + `pg` → Neon
- Password gate: signed httpOnly cookie (`jose`) + middleware
