# Thornbury Systems

Billing and job scheduling for UK water utilities. This repository is the API the
web front end talks to. The desktop product is not in here.

## Running it

No install step. Node 22.6 or newer runs the TypeScript directly.

```
npm test        # the suite
npm start       # API on http://localhost:4310, UI on http://localhost:4310/app/
```

## Layout

- `src/invoices` billing. Totals, balances.
- `src/scheduling` work orders, engineer dispatch, customer appointment windows.
- `src/shared` money and dates. Both are used by both sides, so changes here reach further than they look.
- `src/db.ts` the seed data. Stands in for the SQL Server tables.
- `src/static.ts` serves `public/` under `/app`.
- `public/` the browser front end. No build step, no framework, same origin as the
  API so there is nothing to configure. Every view is a `#fragment`.
- `jobs/` the support queue. Empty when there is nothing outstanding.

## The front end

`/app/` is a read-only view of the API: customers, invoices, statements, work
orders, the dispatch plan and the appointment windows. It adds no rules of its
own — the one exception is `public/money.js`, which repeats `format()` from
`src/shared/money.ts` because the browser cannot import the TypeScript. There is
a test that fails if the two ever disagree.

The API routes are unchanged and `/` still answers with the route list, so
anything already pointed at this service keeps working.

## Notes from the team

The migration off the desktop product stalled in 2023. What you are looking at is
the half that got done.

Priya wrote most of the scheduling side and left in March. Nobody has picked it up.
If something in there looks deliberate, it probably was, but the reasoning is not
written down anywhere.

Money is in pence. Dates are stored UTC and shown UK local. Those two rules are the
only ones everybody agreed on.

`CLAUDE.md` has the conventions and the things that are not settled.
