# Front end: what to do next

Written 8 Sep 2026, after `/app/` went in. Nothing here is agreed. It is a
ranked list of what would actually help, so the next person is not starting
from "make it nicer".

## What exists

`/app/` is seven read-only views over the API: customer list, customer, invoice,
statement, work orders, dispatch, appointment windows. No framework, no build
step, same origin. It holds no business rules of its own.

## The constraints anything here has to live inside

**No build step.** `npm test` and `npm start` work on a clean checkout with no
`node_modules`. That is the repo's selling point and it is in CLAUDE.md.

**This is read alongside a phone call.** Someone is on the line to a customer
about a bill. Density and legibility beat decoration. Colour carries meaning
here — paid versus outstanding — so it cannot be spent on ornament.

**The seed data is four customers. The real table is not.** `src/db.ts` stands
in for SQL Server. Anything that only works at four rows is not finished.

**The API is read-only.** Every route is a GET. Nothing below invents a write.

---

## 1. Print the statement properly — done

**Why first.** The statement was asked for by Trelawney's finance team, who were
reconciling four invoice PDFs by hand every quarter. The statement view answers
that, and it currently prints with the site navigation across the top. The job
is not actually finished until the thing they asked for can be put in front of
their accounts department.

Shipped as a stylesheet, no new dependency. Save-as-PDF is the browser's job.
There is a "Print this statement" button, and `@media print` gives an A4 page
with a masthead, the customer as addressee, repeating column headings, totals
that appear once at the end, and no navigation.

Two things that were not obvious until it was on paper:

- The on-screen scroll box that keeps wide tables inside the viewport **clips
  the table at the paper's edge** when printed. `overflow: visible` in print.
- Hiding headings and captions globally made every *other* page print worse —
  an untitled table. The statement hides its own heading by marking it
  `screen-only`, because the print masthead already carries the title. Only
  navigation and controls are hidden for everyone.

Paid and outstanding are distinguished by weight, not colour, so the meaning
survives a black and white printer.

**Still open, and it needs Finance, not code.** The printed statement carries a
"Prepared <date>" line, which is true and generated at render. It does not
carry:

- a statement period — the API has no notion of one
- a payment reference or remittance details
- the issuer's own address and VAT registration number, which are not anywhere
  in this system and were deliberately not invented

A real supplier statement almost certainly needs all three. Same conversation as
the VAT sign-off.

## 2. Make it work past four rows

- filter box on the customer list and the work-order list
- sortable columns, at minimum by date and by amount
- a landing view: total outstanding across accounts, jobs queued but unassigned
  today, anything out of hours this week
- paging, or at least an honest row count, once the list is not four long

The dispatch view already lists queued-but-unassigned work. That was worth
having the day it shipped: it is how the dropped out-of-hours job was visible.
More of that kind of "what is wrong right now" is worth more than styling.

**Wanted from the API: why an order was not assigned.** There are two reasons —
the address is already being visited that UK local day, or no engineer with the
right skill was free for the slot — and `dispatch()` currently returns only the
assignments, so the front end cannot tell them apart. It says so in a caption,
which is the honest version of not knowing. A reason per skipped order would let
the screen say it per row, and would tell a dispatcher whether the answer is to
rebook the customer or to find another engineer. There is also no `/engineers`
route, so the plan can only show `E-01` rather than a name.

## 3. Visual polish, same stack

- a real type scale and consistent spacing rhythm
- focus rings and keyboard navigation, including skip-to-content; this is a
  tool people use all day and the mouse is not always free
- proper empty, loading and error states rather than one line of grey text
- check status colour against both themes and against colour-blind readers.
  Paid/outstanding must not rely on hue alone
- tighten the mobile layout beyond "the table scrolls"

## 4. Not recommended: a framework rewrite

React or similar plus Tailwind. It would break the no-build-step rule, add a
toolchain and a dependency tree to a repo whose whole character is not having
one, and it buys little at seven read-only views.

Worth revisiting only if the write side lands — forms, validation and optimistic
updates are where hand-rolled DOM code starts to cost more than it saves. If
that day comes, decide it deliberately and change CLAUDE.md at the same time.

---

## Things the front end cannot fix

Recording these here because they keep coming up as "the UI should…".

**The VAT rule is unconfirmed.** `vatPercentFor` in `src/invoices/calc.ts`
encodes ordinary UK water treatment because Sandra's email was never found. The
invoice screen now says so out loud. That caption should come down when Finance
signs the rule off, and no amount of UI work substitutes for that conversation.

**There is no write side.** No persistence, no auth, no payments, no meter
readings. `WorkOrder.status` and `engineerId` are only ever read, and the
dispatch plan is recomputed on every request rather than committed. A prettier
read-only view is still a read-only view.

**Line totals are computed in the browser.** `public/app.js` multiplies quantity
by unit price rather than reading a total off the API — a second copy of
`lineTotal`, and unlike `format()` there is no test holding the two together. It
is trivial arithmetic today. It stops being trivial the first time a discount or
a proration lands in `lineTotal`. The fix is the API returning line totals.
