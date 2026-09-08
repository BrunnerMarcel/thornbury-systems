import { percentOf, sum, type Pence } from '../shared/money.ts';
import type { Customer, Invoice, LineItem } from '../db.ts';

export interface InvoiceTotal {
  net: Pence;
  // The part of `net` that VAT was actually charged on. On the total so
  // Finance can check the rule below without re-deriving it from the lines.
  vatable: Pence;
  vat: Pence;
  total: Pence;
}

const STANDARD_VAT_PERCENT = 20;

// UNCONFIRMED: this encodes ordinary UK water treatment and needs Finance
// sign-off before an invoice goes out on it.
//
//   SERVICE  engineer work. Standard rated, whoever it is for.
//   SUPPLY   metered water and standing charges. Zero rated to a domestic
//            account, standard rated to a commercial one.
//
// One function and one constant, so the rule is cheap to change.
//
// Customer.vatRegistered is deliberately not consulted. Whether the customer
// is themselves registered changes what they can reclaim, not what we charge;
// driving output VAT off it would zero-rate commercial engineer work. It is the
// obvious-looking field and it is the wrong one.
function vatPercentFor(line: LineItem, customer: Customer): number {
  if (line.kind === 'SERVICE') return STANDARD_VAT_PERCENT;
  return customer.accountType === 'COMMERCIAL' ? STANDARD_VAT_PERCENT : 0;
}

export function lineTotal(line: LineItem): Pence {
  return line.quantity * line.unitPence;
}

// Paper invoices carried a printing and postage charge that the web product
// never had. Kept so historic invoices still reconcile.
//
// Left out of the vatable base. LEGACY_PAPER is a closed set of pre-2019 rows
// and the importer is switched off, so this cannot change what a live invoice
// says either way.
function legacySurcharge(invoice: Invoice): Pence {
  if (invoice.source === 'LEGACY_PAPER') {
    return 150;
  }
  return 0;
}

// VAT is rounded once per rate band rather than once per line, so a long
// invoice does not accumulate a penny of rounding per row.
export function totalFor(invoice: Invoice, customer: Customer): InvoiceTotal {
  const net = sum(invoice.lines.map(lineTotal)) + legacySurcharge(invoice);
  const vatable = sum(
    invoice.lines
      .filter((line) => vatPercentFor(line, customer) === STANDARD_VAT_PERCENT)
      .map(lineTotal),
  );
  const vat = percentOf(vatable, STANDARD_VAT_PERCENT);
  return { net, vatable, vat, total: net + vat };
}

// Takes the customer rather than an id: VAT depends on the account, so the
// balance cannot be worked out from the invoices alone.
export function outstandingFor(customer: Customer, all: Invoice[]): Pence {
  return sum(
    all
      .filter((invoice) => invoice.customerId === customer.id && !invoice.paid)
      .map((invoice) => totalFor(invoice, customer).total),
  );
}
