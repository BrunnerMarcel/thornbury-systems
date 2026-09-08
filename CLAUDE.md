# Thornbury Systems

Billing and job scheduling for UK water utilities. This repo is the API the web
front end talks to, plus that front end. The desktop product is not in here.

## Commands

```
npm test        # the suite. No install needed: Node runs the TypeScript directly
npm run typecheck   # tsc --noEmit. Needs npm install first
npm start       # API on :4310, UI on :4310/app/
```

`npm test` and `npm start` still work on a clean checkout with no `node_modules`.
Keep it that way — `--experimental-strip-types` is why there is no build step, and
the only dependencies are dev-only (`typescript`, `@types/node`) for the
typechecker. Do not add a runtime dependency without saying why.

Type stripping does not type *check*. `npm run typecheck` is the only thing that
does, so run it before you call a change done — a wrong type will otherwise sail
through a green suite.

## Three rules

**Money is pence.** Integers everywhere below the UI. `format()` in
`src/shared/money.ts` is the only way a number reaches a person. No float
arithmetic in the money path at all: the desktop product stored pounds as floats
and the import path still produces `0.1 + 0.2` tickets.

**Dates are stored UTC and shown UK local.** There is a third clock — the host's
own zone — and it is what kept a wrong-appointment-date bug looking
unreproducible for two years. The build box is UTC, so it silently answers
calendar questions correctly by accident; a dev machine here does not, and
neither does a customer in Bristol.
`Date#getDay`, `Date#getDate` and `Date#toISOString` all answer in the wrong
zone. Never use them for calendar work. Ask `src/shared/dates.ts` instead: it
asks `Europe/London` explicitly, and everything date-shaped belongs there.

**Anything the customer reads is UK local.** Internal screens may show the stored
UTC value, but label it. A UTC timestamp printed next to a UK local time is
exactly how Trelawney were given the wrong night.

## Layout

- `src/invoices` billing. Totals, balances, statements.
- `src/scheduling` work orders, engineer dispatch, customer appointment windows.
- `src/shared` money and dates. Used by both sides, so changes here reach
  further than they look.
- `src/db.ts` seed data, standing in for the SQL Server tables. In memory, and
  nothing writes to it.
- `src/server.ts` the routes. `src/static.ts` serves the UI under `/app`.
- `public/` the browser front end. No framework, no build step, same origin.
- `test/` one file per area. `node:test` and `node:assert/strict`.
- `jobs/` the support queue, one Markdown file per ticket. Absent when nothing
  is outstanding, which is the state to leave it in: a resolved ticket is
  deleted, and the reasoning goes in a comment at the fix.
- `docs/` plans and decisions that outlive a ticket.

Imports carry the `.ts` extension because Node needs it at runtime. That is what
`allowImportingTsExtensions` in `tsconfig.json` is for.

## The front end

`public/` is a read-only view of the API and holds no business rules of its own.
Two things to know:

`public/money.js` repeats `format()` because the browser cannot import the
TypeScript. `test/static.test.ts` fails if the two disagree.

Nothing tests that the UI renders every field the API returns, so **when you
change a response shape, open `/app/` and look.** When `slotFor` grew `endDate`,
the UI kept rendering one date and quietly threw the fix away. If you add a rule
to the API, check whether a caption in `public/app.js` now describes it wrongly.

## Not settled

- **The VAT rule is unconfirmed.** `vatPercentFor` in `src/invoices/calc.ts`
  encodes ordinary UK water treatment because Sandra's email was never dug out.
  It needs Finance sign-off before an invoice goes out on it.
- **There is no write side.** Every route is a GET. No persistence, no auth, no
  payments, no meter readings. `WorkOrder.status` and `engineerId` are only ever
  read.
- **Priya wrote most of `src/scheduling` and left in March 2023.** If something
  in there looks deliberate it probably was, but the reasoning is not written
  down. Prefer adding a test that pins the current behaviour over assuming it is
  wrong.

## Working here

Support queue items arrive as Markdown files in `jobs/`. There is a
`/support-job` skill that walks one end to end; read it before picking one up,
because the tickets have a habit of naming the wrong cause.

[docs/ui-plan.md](docs/ui-plan.md) is the ranked list of what the front end
should do next, and why, including what it cannot fix on its own.

Branch rather than committing to `main`; more than one person is often in this
tree at once. Commit messages are English, matching the history.
