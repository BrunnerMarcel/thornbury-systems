// Date helpers shared by billing and scheduling.
//
// Everything the customer sees is UK local time. Everything we store is UTC.
// The two are not the same thing for half the year.
//
// There is also a third clock: the host's own zone. The build box is UTC, a dev
// machine here is UTC+1 or UTC+2, and a customer in Avonmouth is on
// Europe/London. Date#getDay, Date#getDate and Date#toISOString all answer the
// calendar question in the wrong zone, and on the build box they answer it in
// the right zone by accident. Nothing below may use them for calendar work:
// every calendar question here is asked of Europe/London explicitly.

export const BANK_HOLIDAYS_2026 = [
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04',
  '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28',
];

const UK_TIME_ZONE = 'Europe/London';
const UK_TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const UK_DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// The UK local calendar date an instant falls on, as YYYY-MM-DD.
//
// Not toISOString().slice(0, 10): that is the UTC date, and for anything late
// in the evening during BST the two are different days. 2026-09-02T23:30Z is
// already the 3rd in Bristol.
export function toDateKey(d: Date): string {
  const parts = UK_DATE_FORMAT.formatToParts(d);
  const year = parts.find((part) => part.type === 'year')!.value;
  const month = parts.find((part) => part.type === 'month')!.value;
  const day = parts.find((part) => part.type === 'day')!.value;
  return `${year}-${month}-${day}`;
}

// Noon on a UK calendar date. Noon is never ambiguous and never skipped: the
// clocks move at 01:00, so 12:00Z lands on the intended date in both GMT and
// BST. Used to ask weekday and day-stepping questions about a date key without
// dragging the host zone back in.
function noonOn(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00Z`);
}

function isWorkingDateKey(dateKey: string): boolean {
  const weekday = noonOn(dateKey).getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  return !BANK_HOLIDAYS_2026.includes(dateKey);
}

export function isWorkingDay(d: Date): boolean {
  return isWorkingDateKey(toDateKey(d));
}

// Date-level helper: the instant returned is noon UTC on the resulting UK
// calendar date, not `from`'s time of day.
//
// It steps UK calendar dates rather than adding 24 hours at a time. A naive
// 24-hour step can skip a calendar date outright across a spring-forward, and
// Date#setDate would step the host's calendar rather than the customer's.
export function addWorkingDays(from: Date, n: number): Date {
  let dateKey = toDateKey(from);
  let left = n;
  while (left > 0) {
    const next = noonOn(dateKey);
    next.setUTCDate(next.getUTCDate() + 1);
    dateKey = next.toISOString().slice(0, 10);
    if (isWorkingDateKey(dateKey)) left--;
  }
  return noonOn(dateKey);
}

// What the customer is told their appointment time is.
export function formatSlotTime(d: Date): string {
  return UK_TIME_FORMAT.format(d);
}

// What the customer is told their appointment date is. Same question as
// toDateKey, so same answer: these two drifting apart is what let a UTC date
// be printed next to a UK local time.
export function formatSlotDate(d: Date): string {
  return toDateKey(d);
}

// Same UK local day, which is the day the customer and the engineer both mean.
// Not the same UTC day: an 09:00Z job and a 23:30Z job on the same stored date
// are two different days in Bristol during BST.
export function sameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}
