---
name: support-job
description: Work a support queue item from jobs/ end to end — read the ticket, find the real cause, pin it with a test, then fix it. Use when asked to pick up a JOB-x, work the support queue, or fix something a jobs/ file describes.
---

# Working a support queue job

Tickets arrive as one Markdown file each in `jobs/`, written by whoever took the
call. They describe a symptom a customer saw, second hand, often months ago.
They are evidence, not a specification.

The four tickets cleared in September 2026 are the evidence for what follows:
three of them named the wrong cause, and the fourth turned out not to be a bug
at all. The examples below are from those, and are worth knowing even though the
files are gone — `git log` has them.

## 1. Read the ticket for what it does not say

Note explicitly what is missing before touching code:

- **An unrecorded conversation.** The VAT ticket said "she mentioned something
  about not all of it being vatable but I did not write down what she said."
  That is a business decision nobody has made. It cannot be inferred from the
  codebase, and it is still unsigned off today.
- **A closed duplicate.** The wrong-date ticket pointed at an older one that had
  been closed twice as cannot reproduce. A ticket that keeps coming back was
  misdiagnosed, not imagined.
- **A condition in the reporter's aside.** "Both reports came in the summer",
  "it has never once failed on the build box", "the addresses are typed in by
  whoever takes the call". These are the reproduction steps. Treat an offhand
  detail about *when* or *where* it happens as the most load-bearing line in the
  ticket.

## 2. Reproduce before diagnosing

Write a failing test first, at the level the customer saw the problem — the
route or the exported function, not a private helper. If you cannot make it
fail, you have not found the bug, and "cannot reproduce" is how this ticket got
here in the first place.

For anything date-shaped, the reproduction almost certainly needs a BST instant
(roughly late March to late October) and an evening time. GMT hides the whole
class. Do not rely on the host zone to expose it — the build box is UTC and will
tell you everything is fine.

## 3. Check the rules in CLAUDE.md

Most of these bugs are one of the three rules being broken:

- pence vs pounds, or a float in the money path
- a UTC value used to answer a UK calendar question, or shown to a customer
- a stored value and a displayed value that disagree

If the fix does not trace back to one of those, say so — it may be a business
decision rather than a bug, and those go back to a person.

## 4. Fix narrowly, and say what you did not fix

Change the smallest thing that makes the test pass. Then write down, in a
comment at the fix:

- what the ticket said and what was actually wrong, if they differ
- why it only showed up in the conditions it did
- what you deliberately left alone

That comment is the whole point. Priya's scheduling code is hard to work on
because the reasoning was never written down; do not add to that.

## 5. Before calling it done

- `npm test` green
- `npm run typecheck` clean
- Open `/app/` and look at the screen the ticket is about. If the response shape
  changed, the front end may be silently dropping the new field.
- Ask whether the fix changes a caption in `public/app.js` that states a rule.
- If any part of the job was a business decision rather than a bug, name it as
  an open point. Do not guess and ship it.
