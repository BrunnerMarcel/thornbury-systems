import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalFor, lineTotal, outstandingFor } from '../src/invoices/calc.ts';
import { customers, invoices, type Customer, type Invoice } from '../src/db.ts';

const customer = (id: string): Customer => customers.find((c) => c.id === id)!;

const DOMESTIC = customer('C-1001');
const TRELAWNEY = customer('C-1002');
const ACADEMY = customer('C-1004');

test('line totals multiply quantity by unit price', () => {
  assert.equal(lineTotal({ description: 'x', quantity: 41, unitPence: 218, kind: 'SUPPLY' }), 8938);
});

test('invoice totals are calculated for every invoice', () => {
  for (const invoice of invoices) {
    totalFor(invoice, customer(invoice.customerId));
  }
});

test('outstanding balance ignores paid invoices', () => {
  assert.equal(outstandingFor(DOMESTIC, invoices), 0);
});

test('commercial invoice totals', () => {
  const invoice = invoices.find((i) => i.id === 'INV-9002')!;
  assert.deepEqual(totalFor(invoice, TRELAWNEY), {
    net: 245000,
    vatable: 245000,
    vat: 49000,
    total: 294000,
  });
});

test('outstanding balance includes VAT', () => {
  assert.equal(outstandingFor(TRELAWNEY, invoices), 294000);
});

test('legacy paper invoices carry the postage surcharge', () => {
  const paper: Invoice = {
    id: 'INV-0001',
    customerId: 'C-1001',
    issued: '2018-03-01',
    source: 'LEGACY_PAPER',
    paid: true,
    lines: [{ description: 'Metered supply', quantity: 10, unitPence: 100, kind: 'SUPPLY' }],
  };
  assert.equal(totalFor(paper, DOMESTIC).total, 1150);
});

// The rule these pin is unconfirmed; see the note in calc.ts. They are here so
// that revising it shows up as changed tests rather than as a silent change to
// what customers are billed.

test('water supply to a domestic account is zero rated', () => {
  const invoice = invoices.find((i) => i.id === 'INV-9001')!;
  assert.deepEqual(totalFor(invoice, DOMESTIC), {
    net: 11338,
    vatable: 0,
    vat: 0,
    total: 11338,
  });
});

test('water supply to a commercial account is standard rated', () => {
  const invoice = invoices.find((i) => i.id === 'INV-9004')!;
  assert.deepEqual(totalFor(invoice, ACADEMY), {
    net: 563400,
    vatable: 563400,
    vat: 112680,
    total: 676080,
  });
});

test('engineer work is standard rated even on a domestic account', () => {
  // Supply zero rated, the call out standard rated, on the same invoice.
  const invoice = invoices.find((i) => i.id === 'INV-9003')!;
  assert.deepEqual(totalFor(invoice, customer('C-1003')), {
    net: 23594,
    vatable: 14000,
    vat: 2800,
    total: 26394,
  });
});

test('VAT does not depend on whether the customer is VAT registered', () => {
  // vatRegistered is about what they can reclaim, not what we charge. Two
  // accounts of the same type must be billed the same either way.
  const invoice = invoices.find((i) => i.id === 'INV-9002')!;
  const registered = totalFor(invoice, { ...TRELAWNEY, vatRegistered: true });
  const notRegistered = totalFor(invoice, { ...TRELAWNEY, vatRegistered: false });
  assert.deepEqual(registered, notRegistered);
});

test('VAT rounds once per invoice rather than once per line', () => {
  // Rounded per line this is 1p + 0p + 1p = 2p. Rounded once on the banded
  // net it is 20% of 7p, so 1p. Long invoices are where that gap grows.
  const invoice: Invoice = {
    id: 'INV-0002',
    customerId: TRELAWNEY.id,
    issued: '2026-07-01',
    source: 'WEB',
    paid: false,
    lines: [
      { description: 'Odd penny a', quantity: 1, unitPence: 3, kind: 'SERVICE' },
      { description: 'Odd penny b', quantity: 1, unitPence: 1, kind: 'SERVICE' },
      { description: 'Odd penny c', quantity: 1, unitPence: 3, kind: 'SERVICE' },
    ],
  };
  assert.deepEqual(totalFor(invoice, TRELAWNEY), {
    net: 7,
    vatable: 7,
    vat: 1,
    total: 8,
  });
});
