import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slotFor } from '../src/scheduling/slots.ts';
import { dispatch } from '../src/scheduling/dispatch.ts';
import { workOrders, type WorkOrder } from '../src/db.ts';

const order = (id: string): WorkOrder => workOrders.find((w) => w.id === id)!;

test('a customer is quoted a window around the requested time', () => {
  assert.deepEqual(slotFor(order('W-5001')), {
    workOrderId: 'W-5001',
    window: '08:00 to 11:00',
    date: '2026-09-02',
    endDate: '2026-09-02',
  });
});

test('customer slots use UK local time when the server runs in UTC', () => {
  const originalTimezone = process.env.TZ;
  process.env.TZ = 'UTC';

  try {
    assert.deepEqual(slotFor(order('W-5006')), {
      workOrderId: 'W-5006',
      window: '23:30 to 02:15',
      date: '2026-09-02',
      endDate: '2026-09-03',
    });
  } finally {
    if (originalTimezone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimezone;
    }
  }
});

// The window opens at 23:30 on the 2nd and closes at 02:15 on the 3rd, so the
// confirmation has to say both. Dating the slot from the requested time instead
// gives the 3rd in BST, a day off the time the window actually opens.
test('a window that crosses midnight is dated at both ends', () => {
  const slot = slotFor(order('W-5006'));

  assert.equal(slot.window, '23:30 to 02:15');
  assert.equal(slot.date, '2026-09-02', 'the date must be the day the window opens');
  assert.notEqual(slot.date, slot.endDate, 'this window does cross midnight');
});

test('dispatch only plans queued work', () => {
  const plan = dispatch(workOrders.map((w) => ({ ...w, status: 'DONE' as const })));
  assert.equal(plan.length, 0);
});

test('dispatch matches the required skill', () => {
  const plan = dispatch(workOrders);
  const backflow = plan.find((a) => a.workOrderId === 'W-5003');
  assert.equal(backflow?.engineerId, 'E-02');
});

test('dispatch plans one visit for differently typed versions of an address', () => {
  const ashfieldOrders = [order('W-5001'), order('W-5002')]
    .map((o) => o.id === 'W-5001'
      ? { ...o, address: '  14 Ashfield   Row, Bristol  ' }
      : o);

  assert.deepEqual(
    dispatch(ashfieldOrders).map((assignment) => ({
      workOrderId: assignment.workOrderId,
      address: assignment.address,
    })),
    [{ workOrderId: 'W-5001', address: '  14 Ashfield   Row, Bristol  ' }],
  );
});

// Whoever takes the call types the address, so the comma is not reliable
// either.
test('dispatch plans one visit when only the punctuation differs', () => {
  const plan = dispatch([
    order('W-5001'),
    { ...order('W-5002'), address: '14 Ashfield Row Bristol' },
  ]);

  assert.deepEqual(plan.map((a) => a.workOrderId), ['W-5001']);
});

// Dispatch runs per batch: by the time the leak call comes in, the meter visit
// to the same house is already DISPATCHED and so is not in the plan being
// built. Checking only the plan being built misses it.
test('a visit already dispatched blocks a second van to the same house', () => {
  const plan = dispatch([
    { ...order('W-5001'), status: 'DISPATCHED', engineerId: 'E-01' },
    order('W-5002'),
  ]);

  assert.deepEqual(plan, [], 'W-5002 is a second van to the same house that morning');
});

test('a job on the following UK local day is not treated as a duplicate', () => {
  // W-5003 is 09:00Z and W-5006 is 23:30Z on the same stored date, at the same
  // address. In BST that is the 2nd and the 3rd: two separate visits, and
  // Trelawney's night shift asked for the second one.
  const plan = dispatch([order('W-5003'), order('W-5006')]);

  assert.deepEqual(plan.map((a) => a.workOrderId), ['W-5003', 'W-5006']);
});

test('an engineer is not sent to two addresses at once', () => {
  const plan = dispatch(workOrders);
  const overlapping = plan.filter(
    (a) => a.workOrderId === 'W-5004' || a.workOrderId === 'W-5005',
  );

  // Bell Lane 13:00-14:00 and Gloucester Road 13:30-14:00. Both should be
  // planned, but not to the same engineer.
  assert.equal(overlapping.length, 2);
  assert.notEqual(overlapping[0].engineerId, overlapping[1].engineerId);
});

test('a job with no free engineer is not planned twice over', () => {
  // One LEAK job at each of two addresses at the same time, and only three
  // engineers, two of whom can do LEAK.
  const clashing: WorkOrder[] = [
    { ...order('W-5004'), id: 'W-9001', address: 'A Road' },
    { ...order('W-5004'), id: 'W-9002', address: 'B Road' },
    { ...order('W-5004'), id: 'W-9003', address: 'C Road' },
    { ...order('W-5004'), id: 'W-9004', address: 'D Road' },
  ];

  const plan = dispatch(clashing);
  const engineerIds = plan.map((a) => a.engineerId);

  assert.equal(new Set(engineerIds).size, engineerIds.length, 'no engineer twice');
  assert.equal(plan.length, 3, 'E-01, E-02 and E-03 can all do LEAK');
});
