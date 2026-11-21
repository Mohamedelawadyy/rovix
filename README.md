# Rovix Frontend — Nile Motors CDMS

React + Vite + TypeScript frontend for the Nile Motors Car Dealership Management System.
The Laravel backend is a separate repository (`Ro-Vix/Car-Marketplace`); its API contract is
documented in [BACKEND_API_REFERENCE.md](BACKEND_API_REFERENCE.md).

## Prerequisites

- Node.js `^20.19.0 || >=22.12.0` and npm
- The Laravel backend running locally (default `http://localhost:8000`). See its README for
  `composer install`, `php artisan migrate --seed` and `php artisan storage:link`.

## Setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The app runs on **http://localhost:3000**. Port 3000 is deliberate: it is the backend's default
`CORS_ALLOWED_ORIGINS` entry and the target of its `FRONTEND_RESET_PASSWORD_URL`.

In development the browser calls the relative `/api/v1`, and Vite proxies `/api` and `/storage`
to `BACKEND_PROXY_TARGET`, so no CORS configuration is needed locally.

## Environment variables

| Variable               | Exposed to browser   | Purpose                                                                                                               |
| ---------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `VITE_APP_NAME`        | yes                  | Application name (browser tab, header)                                                                                |
| `VITE_API_BASE_URL`    | yes                  | API base, `/api/v1` in dev or an absolute URL in production. **Required** — the app fails fast at startup without it. |
| `BACKEND_PROXY_TARGET` | no (dev server only) | Laravel URL used by the Vite proxy                                                                                    |

Only `VITE_*` variables reach the browser bundle; never put secrets in them.

## Scripts

| Command                           | What it does                                  |
| --------------------------------- | --------------------------------------------- |
| `npm run dev`                     | Start the dev server with the API proxy       |
| `npm run build`                   | Type-check (`tsc -b`) and build to `dist/`    |
| `npm run preview`                 | Serve the production build locally            |
| `npm run typecheck`               | TypeScript project type-check                 |
| `npm run lint`                    | ESLint (typescript-eslint strict, type-aware) |
| `npm run format` / `format:check` | Prettier write / check                        |
| `npm test` / `test:watch`         | Vitest (jsdom + Testing Library)              |

## Quality gates (run before every commit)

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

## Project structure

```text
src/
  app/          config (env), navigation.ts, router/routes.tsx, providers, app-level pages
  assets/brand/ official logo (cropped, never recolored)
  brand/        tokens.css — single source of truth for brand values (+ contrast tests)
  components/   ui/ primitives (Button, TextField, Alert, Icon) and shared/ (BrandLogo, StatusPage)
  features/     one folder per backend module (auth/ today): api, components, pages, types
  hooks/        cross-feature hooks (useDocumentTitle)
  layouts/      app/ shell: sidebar, header, user menu
  lib/          framework-free helpers: api client, money, color contrast, files
  locales/      UI strings (ar)
  styles/       global CSS: Cairo font, Tailwind wiring, base styles
  test/         test setup, MSW server and Laravel response builders, renderApp
```

## Navigation and routes

- [`src/app/navigation.ts`](src/app/navigation.ts) lists the modules in scope with the backend
  permission each needs. The sidebar and the module routes are generated from it.
- Current scope: Dashboard, Inventory, Customers, Sales contracts, Reservations. Modules render a
  placeholder until their feature task lands.
- Users only see modules they can view. Opening one without permission shows 403, and unknown
  paths show 404 inside the layout. `/` opens the first allowed module.
- Pages are lazy-loaded (one chunk each). Guards are UX only; the backend authorizes every call.

## Design tokens and styling

- All brand values live in [`src/brand/tokens.css`](src/brand/tokens.css): primitives (`--red-*`,
  `--ink-*`, status) and semantic tokens (`--ui-color-*`, `--ui-radius-*`, ...). Components use
  semantic tokens only; changing a primitive restyles the whole app.
- Tailwind v4 utilities are generated **only** from semantic tokens (`bg-primary`, `text-fg`,
  `text-fg-muted`, `bg-accent`, `bg-danger-subtle`, `rounded-md`, ...). The default Tailwind
  palette is disabled, so `bg-blue-500`-style classes do not exist.
- Primary actions use ink (`bg-primary`); the logo red (`accent`) is for identity, active
  navigation and highlights. Status colors are semantic only.
- `src/brand/tokens.test.ts` fails the build if a text/background pair drops below WCAG 2.2 AA.
- Font: Cairo (variable, self-hosted via `@fontsource-variable/cairo`). Default direction is RTL
  (`<html lang="ar" dir="rtl">`); prefer logical utilities (`ms-*`, `pe-*`, `start-*`).

The full target structure is described in the architecture proposal and will grow feature by
feature (`src/features/<module>/{api,components,hooks,pages,types}`).
