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
  app/        application shell, config (env validation)
  test/       test setup
```

The full target structure is described in the architecture proposal and will grow feature by
feature (`src/features/<module>/{api,components,hooks,pages,types}`).
