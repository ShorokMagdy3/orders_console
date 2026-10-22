# Orders Console

React + Node/Express + MongoDB. Agents search/filter/sort a 50,000-order list and create orders without ever creating duplicates.

## Run it (about 5 minutes)

Requirements: Node 20+ and MongoDB running locally (`mongodb://localhost:27017`).

```bash
# 1. Server
cd server
cp .env.example .env          # then set JWT_SECRET (openssl rand -hex 32)
npm install
npm run seed:users            # creates the admin + agent users
npm run seed:orders           # inserts 50,000 orders (takes a few seconds)
npm run dev                   # http://localhost:3000

# 2. Client (new terminal)
cd client
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

Seeded logins (from `.env.example`):

| Role  | Email             | Password            |
| ----- | ----------------- | ------------------- |
| admin | admin@sarh.local  | Admin-Passw0rd-123  |
| agent | agent@sarh.local  | Agent-Passw0rd-123  |

## Tests / proofs

**R2 – duplicate proof** (server must be running):

```bash
cd server
npm run test:concurrent-orders
```

It logs in, fires the *same* create request twice in parallel (same `Idempotency-Key`), and checks that both responses point to the same order and the database holds exactly **one** order.

**R1 – rapid filter test (manual):** open Chrome DevTools → Network → throttle to "Slow 3G", then change the status filter 3 times quickly. Earlier requests show as `(canceled)` and the table always ends on the last filter.

## R1 – how the list stays fast and correct

- **Server-side pagination** (`page` + `limit`, max 100). The browser only ever receives 20 rows.
- **Indexes** (`server/src/models/order.model.ts`):
  - `{createdAt:-1, _id:-1}` – sort by date
  - `{total:-1, _id:-1}` – sort by amount
  - `{status:1, createdAt:-1, _id:-1}` and `{status:1, total:-1, _id:-1}` – status filter + sort
  - `{customerEmail:1}` and `{customerNameLower:1}` – search
  - `{createdBy:1, idempotencyKey:1}` unique – duplicate protection (R2)
- **Search is "starts with"** on name and email. A "contains" search can't use an index and would scan all documents.
- **No stale results:** each request has an `AbortController`; changing any filter aborts the previous request in the effect cleanup, and an `ignore` flag stops a late response from setting state. Search is also debounced (300 ms).

## R2 – how duplicates are prevented

The client sends an `Idempotency-Key` header. The **server** has a unique index on `(createdBy, idempotencyKey)`, so the database itself refuses a second insert. Details and limits are in `DECISIONS.md`.

## Section 3 – code review findings

| # | Problem in the old code | What I changed |
| - | ----------------------- | -------------- |
| 1 | **Hard-coded JWT secret** (`"sarh-secret-2026"`) committed in code. | Secret comes from `JWT_SECRET` in `.env`; server refuses to run if it is shorter than 32 characters. `.env` is git-ignored, `.env.example` is committed. |
| 2 | **`jwt.decode()` does not verify the signature** – anyone could forge a token with `role: "admin"`. | Use `jwt.verify()` with the secret and a pinned algorithm (`HS256`). |
| 3 | **Token accepted from `?token=` in the URL** – leaks into logs, browser history and Referer headers. | Only the `Authorization: Bearer <token>` header is accepted. |
| 4 | **Admin check only in the React `AdminOnly` component** – anyone can call `DELETE` with curl. | `requireRole("admin")` middleware on the `DELETE /api/orders/:id` route. An agent gets 403. |
| 5 | **Plain-text passwords** compared in the DB query. | Passwords stored as bcrypt hashes (`passwordHash`, never selected by default); compared with `bcrypt.compare`. |
| 6 | **Login tokens never expire** (no `exp`). | Tokens expire (`JWT_EXPIRES_IN`, default 1h). The client logs out on a 401. |
| 7 | **Role/payload trusted without checks.** | Middleware checks that `sub` is a string and `role` is `admin` or `agent`. |
| 8 | **`req.body` passed straight into the DB query** (object injection risk). | Body validated with zod; same generic error for wrong email and wrong password. |

Not done (see "skipped"): rate limiting on `/login`, token revocation.

### Where the token is stored

In `sessionStorage`. It is cleared when the tab closes and it is never sent automatically, so it protects against **CSRF** (a malicious site can't make the browser attach it). It does **not** protect against **XSS**: any injected script can read it. An `httpOnly` cookie would block that read, but then CSRF protection is needed; I chose the simpler option for this size of project.

## Product question – "Delete all cancelled orders"

I would ask: *Why do you want them gone – is the list too cluttered, or is it a data/storage/legal reason?* and *Does anyone ever need cancelled orders later (refunds, disputes, accounting)?* If she can't answer, I'd propose a **"Hide cancelled"** filter (already available via the status filter) or an **archive** flag that can be undone, with deletion only for admins, one order at a time. Bulk delete is irreversible and one wrong click removes records the business may need.

## What I skipped and why

- **Optional tasks (O1, O2):** not attempted, to stay in the time budget.
- **Rate limiting / lockout on `/login`:** would be the next security step.
- **Token revocation / refresh tokens:** a stolen token is valid until it expires.
- **Offset pagination:** `skip` gets slower on very deep pages. Fine for 50k; a cursor would be better for millions.
- **Contains-search:** only prefix search on name/email (index-friendly, documented above).
- **Orders created before the `customerNameLower` field existed** won't match name search; re-run `npm run seed:orders` on a fresh DB.
- **Automated test framework:** the R2 proof is a script, not a vitest test.
- **Runtime check:** I could not run MongoDB in my environment, so server and client were verified with the TypeScript compiler and ESLint, not by a full run. Please run the steps above once before submitting.


## Screen recording:
https://drive.google.com/drive/folders/1a1eVLpwGhYI4HL0S7POYHyzmeZVWuBFs?usp=sharing