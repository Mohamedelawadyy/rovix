# API integration

How the frontend talks to the Laravel backend. The full backend contract is in
[BACKEND_API_REFERENCE.md](../BACKEND_API_REFERENCE.md); this file covers the frontend side only.

## Client

`src/lib/api` exports one client, `api`, configured from `VITE_API_BASE_URL`.

```ts
import { api, type Paginated, type ListParams } from '@/lib/api';

const vehicles = await api.get<Paginated<Vehicle>>('/vehicles', {
  query: { page: 1, search: 'corolla', sort: '-year', filter: { status: ['available'] } },
  signal, // from TanStack Query or an AbortController
});
await api.post<Customer>('/customers', payload);
const { blob, filename } = await api.download(`/documents/${id}/download`);
```

- Feature code calls the client from `src/features/<module>/api/*`, never from page components.
- The client sends `Accept: application/json`, `Accept-Language` and `Authorization: Bearer`.
- It unwraps the Laravel envelope `{ success, message, data, errors }` and returns `data`.
- Plain objects go as JSON. `FormData` goes as multipart, and the browser sets the boundary
  (send booleans as `1`/`0`).
- `credentials: 'omit'`: the backend uses token auth and does not allow credentialed CORS.
- Authenticated files (documents, report exports) must use `api.download` plus `saveBlob`
  (`src/lib/files/save-blob.ts`). A plain `<a href>` would get a 401.

## Errors

Every failure throws `ApiError` (`src/lib/api/errors.ts`):

| `kind`                                     | When                                                      | Useful fields                                         |
| ------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------- |
| `validation`                               | 422                                                       | `fieldErrors`, `fieldError('vehicles.0.model_id')`    |
| `conflict`                                 | 409 business rule                                         | `code` (e.g. `account_disabled`), `message`           |
| `unauthenticated`                          | 401                                                       | also broadcast through `apiSession.onUnauthenticated` |
| `forbidden` / `not_found` / `rate_limited` | 403 / 404 / 429                                           | `message`                                             |
| `server`                                   | 5xx, or a non-JSON/non-envelope response (e.g. proxy 502) | `status`                                              |
| `network`                                  | no response (offline, backend down, CORS)                 | `status = null`                                       |
| `aborted`                                  | request cancelled                                         | usually ignore                                        |
| `http`                                     | other statuses (e.g. 415)                                 | `status`, `message`                                   |

`message` is the backend's localized message when present.

## Session

`apiSession` (`src/lib/api/session.ts`) holds the bearer token **in memory** and broadcasts 401s.
Persistence across reloads is decided and implemented in FE-006 (authentication).

## Money

Amounts are decimal strings (`"125000.00"`). Use `src/lib/money` (bigint minor units) for any
arithmetic, and `formatMoney` for display. Never use `Number` math on money.

## Testing

Tests mock the network with MSW (`src/test/msw`). `laravel.ok/created/paginated/validation/
conflict/error` build responses shaped like the backend's. Unhandled requests fail the test.
Tests that send `FormData`/`Blob` through the client run with `// @vitest-environment node`, so
fetch and the body types come from the same runtime.
