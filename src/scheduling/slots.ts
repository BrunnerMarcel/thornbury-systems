import { formatSlotDate, formatSlotTime } from '../shared/dates.ts';
import type { WorkOrder } from '../db.ts';

export interface Slot {
  workOrderId: string;
  // What we tell the customer. UK local time.
  window: string;
  // The UK local date the window opens: the date the customer should expect
  // somebody from.
  date: string;
  // The UK local date the window closes. Same as `date` for all but the
  // out-of-hours jobs, where the window runs past midnight.
  endDate: string;
}

const WINDOW_PADDING_MINUTES = 60;

// The customer is given a window, not a time: the requested time, minus an hour,
// through the requested time plus the job length plus an hour.
//
// Both ends are dated, because a window that crosses UK local midnight cannot
// be described by a single date. Dating the slot from the requested time while
// building the window text from the padded start puts them a day apart: for a
// job stored at 2026-09-02T23:30Z, BST makes the requested time the 3rd while
// the window still opens at 23:30 on the 2nd. In GMT the two agree, so it only
// shows up in summer.
export function slotFor(order: WorkOrder): Slot {
  const start = new Date(order.requestedAt);
  const from = new Date(start.getTime() - WINDOW_PADDING_MINUTES * 60_000);
  const to = new Date(
    start.getTime() + (order.durationMinutes + WINDOW_PADDING_MINUTES) * 60_000,
  );

  return {
    workOrderId: order.id,
    window: `${formatSlotTime(from)} to ${formatSlotTime(to)}`,
    date: formatSlotDate(from),
    endDate: formatSlotDate(to),
  };
}

export function slotsFor(orders: WorkOrder[]): Slot[] {
  return orders.map(slotFor);
}
