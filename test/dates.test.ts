import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWorkingDay, addWorkingDays, toDateKey, sameDay } from '../src/shared/dates.ts';

// These do not set process.env.TZ. Every calendar question in dates.ts is asked
// of Europe/London explicitly, so the answers do not depend on the host zone,
// and that is the property worth pinning: a UTC-keyed implementation passes on
// the UTC build box and fails on a UK-local machine in summer.

test('weekends are not working days', () => {
  assert.equal(isWorkingDay(new Date('2026-09-05T12:00:00Z')), false);
  assert.equal(isWorkingDay(new Date('2026-09-06T12:00:00Z')), false);
});

test('bank holidays are not working days', () => {
  assert.equal(isWorkingDay(new Date('2026-12-25T12:00:00Z')), false);
});

test('adding working days skips the weekend', () => {
  const friday = new Date('2026-09-04T12:00:00Z');
  assert.equal(toDateKey(addWorkingDays(friday, 1)), '2026-09-07');
});

test('a date key is the UK local date, not the UTC one', () => {
  // 23:30Z on 2 September is already half past midnight on the 3rd in Bristol.
  assert.equal(toDateKey(new Date('2026-09-02T23:30:00Z')), '2026-09-03');
  // The same stored time in December is still the 2nd, which is why this only
  // ever came in as a summer ticket.
  assert.equal(toDateKey(new Date('2026-12-02T23:30:00Z')), '2026-12-02');
});

test('a bank holiday is judged on the UK local date', () => {
  // 31 August 2026 is the summer bank holiday. 23:30Z the evening before is
  // the 31st in Bristol, so it is not a working day.
  assert.equal(isWorkingDay(new Date('2026-08-30T23:30:00Z')), false);
  // And 23:30Z on the holiday itself is the 1st of September, a Tuesday.
  assert.equal(isWorkingDay(new Date('2026-08-31T23:30:00Z')), true);
});

test('one stored date can be two different days in Bristol', () => {
  assert.equal(
    sameDay(new Date('2026-09-02T09:00:00Z'), new Date('2026-09-02T23:30:00Z')),
    false,
  );
  assert.equal(
    sameDay(new Date('2026-09-02T09:00:00Z'), new Date('2026-09-02T17:00:00Z')),
    true,
  );
});

test('working day arithmetic steps calendar days, not 24 hour blocks', () => {
  // The clocks go forward at 01:00 on Sunday 29 March 2026. Adding 24 hours at
  // a time from the Friday evening before skips a calendar date; stepping the
  // UK calendar gives the Monday.
  const fridayEvening = new Date('2026-03-27T23:30:00Z');
  assert.equal(toDateKey(addWorkingDays(fridayEvening, 1)), '2026-03-30');
});
