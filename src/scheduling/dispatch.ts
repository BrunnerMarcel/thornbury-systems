import { engineers, type Engineer, type WorkOrder } from '../db.ts';
import { sameDay } from '../shared/dates.ts';

export interface Assignment {
  workOrderId: string;
  engineerId: string;
  address: string;
  startsAt: string;
}

// A visit that is on the ground, or about to be. Assignment is what we hand
// back; this is what we have to check against, and it needs the duration that
// Assignment does not carry.
interface Visit {
  engineerId: string;
  address: string;
  startsAt: Date;
  endsAtMs: number;
}

function visitFor(order: WorkOrder, engineerId: string): Visit {
  const startsAt = new Date(order.requestedAt);
  return {
    engineerId,
    address: order.address,
    startsAt,
    endsAtMs: startsAt.getTime() + order.durationMinutes * 60_000,
  };
}

function canDo(engineer: Engineer, order: WorkOrder): boolean {
  return engineer.skills.includes(order.requires);
}

// Addresses are typed in by whoever takes the call, so the same house arrives
// as "14 Ashfield Row, Bristol" and "14 ashfield row bristol". Case, spacing
// and punctuation are noise and are stripped.
//
// Deliberately nothing cleverer than that. Folding Road/Rd or dropping the
// postcode would match more of the real duplicates, but a false match here
// cancels a visit somebody is waiting in for, which is worse than the
// duplicate it would prevent.
function canonicalAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[.,;]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// One visit per address per UK local day.
//
// Checked against committed visits, not just the assignments made earlier in
// the same call. Dispatch runs per batch as calls come in, so by the time a
// second job at one address is queued the first is often already DISPATCHED,
// out of `planned`, and invisible to a check that only looks there.
function alreadyVisiting(address: string, when: Date, visits: Visit[]): boolean {
  return visits.some(
    (visit) => canonicalAddress(visit.address) === canonicalAddress(address)
      && sameDay(visit.startsAt, when),
  );
}

// An engineer cannot be in two places at once, so overlapping slots go to
// different people.
//
// Travel time between jobs is not modelled: back-to-back visits at different
// addresses still plan, they just no longer overlap.
function isFree(engineerId: string, order: WorkOrder, visits: Visit[]): boolean {
  const candidate = visitFor(order, engineerId);
  return !visits.some(
    (visit) => visit.engineerId === engineerId
      && candidate.startsAt.getTime() < visit.endsAtMs
      && visit.startsAt.getTime() < candidate.endsAtMs,
  );
}

export function dispatch(orders: WorkOrder[]): Assignment[] {
  // Work already sent out. Not replanned, but it occupies an engineer and an
  // address for its slot.
  const visits: Visit[] = orders
    .filter((order) => order.status === 'DISPATCHED' && order.engineerId !== undefined)
    .map((order) => visitFor(order, order.engineerId!));

  const planned: Assignment[] = [];

  for (const order of orders) {
    if (order.status !== 'QUEUED') continue;
    const when = new Date(order.requestedAt);

    if (alreadyVisiting(order.address, when, visits)) continue;

    const engineer = engineers.find(
      (candidate) => canDo(candidate, order) && isFree(candidate.id, order, visits),
    );
    if (!engineer) continue;

    visits.push(visitFor(order, engineer.id));
    planned.push({
      workOrderId: order.id,
      engineerId: engineer.id,
      address: order.address,
      startsAt: order.requestedAt,
    });
  }

  return planned;
}
