// Browser mirror of format() in src/shared/money.ts.
//
// Most API routes hand out raw pence, so the front end has to render money
// itself. This is deliberately the same algorithm rather than a second opinion
// on rounding or separators; test/static.test.ts asserts the two agree, so it
// cannot drift without the suite going red.

export function format(pence) {
  const negative = pence < 0;
  const abs = Math.abs(pence);
  const whole = Math.floor(abs / 100);
  const part = abs % 100;
  return `${negative ? '-' : ''}£${whole.toLocaleString('en-GB')}.${String(part).padStart(2, '0')}`;
}
