# Java to Analog Parity Matrix

This file tracks one-to-one parity from Java (`roomzo`) to Analog Nitro (`roomzo-analog/src/server`).

## HTTP Domains

| Domain | Java endpoints | Analog target | Status |
|---|---:|---|---|
| Auth + OTP + password reset | 9 | `/api/auth/*` | Implemented |
| Listings + search + city | 13 | `/listings/*` | Implemented |
| Reviews (nested listing) | 2 | `/listings/:id/reviews` | Implemented |
| Favourites | 3 | `/favourites/*` | Implemented |
| User profile | 2 | `/api/users/:id/profile` | Implemented |
| User consent | 2 | `/api/consents/*` | Implemented |
| Activity + analytics | 11 | `/activity/*` | Implemented |
| Flatmates | 6 | `/api/flatmates/*` | Implemented |
| Chat REST | 3 | `/api/messages/*` | Implemented |
| Contact + reports | 2 | `/api/contact/*`, `/api/reports/*` | Implemented |

## Realtime Domains

| Domain | Java source | Analog target | Status |
|---|---|---|---|
| WS/SockJS endpoint | `/ws-chat` | `/ws-chat` | Implemented |
| STOMP app sends | `/app/chat.send`, `/app/chat.read`, `/app/chat.typing`, `/app/chat.connect`, `/app/chat.disconnect` | Same semantic contract | Implemented |
| Topic subscriptions | `/topic/messages.{userId}`, `/topic/users.online` | Same semantic contract | Implemented |

## Data + Side Effects

| Capability | Java behavior | Analog parity target | Status |
|---|---|---|---|
| MySQL persistence | JPA entities + repositories | SQL repository layer | Implemented |
| Listing cache | In-memory listing warm cache | In-memory cache service | Partial (DB-first path active) |
| Activity async writes | `@Async` persist service | async queue/worker service | Partial (sync endpoint with best-effort semantics) |
| Email | SMTP via Hostinger | nodemailer SMTP | Implemented |
| Push notification | OneSignal new listing broadcast | OneSignal REST client | Implemented |

## Contract Rules to Preserve

- Keep existing route prefixes exactly as frontend expects (`/listings/*`, `/favourites/*`, `/activity/*`, `/api/*`).
- Preserve response envelope quirks: `{ status, message, data }`, plus list responses that return `{ listings, totalPages, ... }`.
- Preserve listing status semantic mapping: `0 active`, `1 rented`, `2 hidden`, `3 expired`.
- Preserve owner contact fetch contract: `GET /api/auth/owner-info/{ownerId}`.
- Preserve search nearest behavior with bounded radius and distance sorting.
