# Decisions

## 1. Preventing duplicate orders (R2): idempotency key + unique index

**Decision.** The form generates an `Idempotency-Key` (UUID) per submission and sends it in a header. The server stores it on the order and has a **unique index on `(createdBy, idempotencyKey)`**. A second request with the same key hits the index, and the server returns the already-created order (HTTP 200, `replayed: true`) instead of creating another. The same key with *different* data returns 409. The client reuses the key when retrying the same data, and the submit button is also blocked while a request is in flight.

**Alternative considered.** Detect duplicates by content (same customer + same items within N seconds) with a lookup before insert.

**Why I rejected it.** A lookup-then-insert has a race: two parallel requests can both see "no duplicate" and both insert. It also blocks legitimate repeat orders (a customer really can order the same thing twice). The unique index is enforced by the database, so it holds even for parallel requests.

**Limits.** It protects only against retries of the *same* submission. If someone refreshes the page and fills the form again, that gets a new key and is a new order. It is scoped per user, and the key is stored forever (a real system would expire old keys).

## 2. Pagination: server-side offset (page/limit) with a stable sort

**Decision.** `GET /api/orders` takes `page` and `limit` and returns 20 rows plus the total. Every sort ends with `_id` so rows don't move between pages, and each sort has a matching index.

**Alternative considered.** Cursor pagination ("give me the 20 after this row") and virtualized infinite scroll.

**Why I rejected it.** For 50,000 rows, offset is fast with indexes and the UI is simpler: page numbers, "x matching orders", and jumping to a page. Cursors need more code (encoding the last sort value, handling asc/desc and ties). I accept that `skip` slows down on very deep pages; cursors would be the first change at millions of rows.

## 3. Database: MongoDB (with Mongoose)

**Decision.** MongoDB. An order naturally contains its line items, so one document holds the whole order, with no joins. Mongoose gives schemas and index definitions in the same file as the model.

**Alternative considered.** SQLite / PostgreSQL with a separate `order_items` table.

**Why I rejected it.** SQLite would be simpler to run (no server to install), and Postgres is stronger for reporting. But the main queries here are "list one table with filter/sort/search", which Mongo handles well with indexes, and the unique index for idempotency works the same. The cost: the "contains" search is harder than in SQL, so I limited search to prefix.

## AI tools

I used an AI assistant (Claude) to help review and finish this project: fixing the TypeScript errors, splitting the React code into components, writing the seed script and the README.