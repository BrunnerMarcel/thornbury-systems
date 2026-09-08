import type { Customer, Invoice } from '../db.ts';
import { sum, type Pence } from '../shared/money.ts';
import { totalFor } from './calc.ts';

export interface StatementInvoice {
  id: string;
  issued: string;
  paid: boolean;
  net: Pence;
  vat: Pence;
  total: Pence;
}

export interface CustomerStatement {
  customer: Pick<Customer, 'id' | 'name' | 'address'>;
  invoices: StatementInvoice[];
  totals: {
    net: Pence;
    vat: Pence;
    invoiced: Pence;
    paid: Pence;
    outstanding: Pence;
  };
}

// Covers the whole account, not a period: `net` and `vat` below are
// account-to-date and span paid and unpaid alike. Whether a statement should
// instead cover a quarter, and whether it should carry an opening balance, is
// not settled.
export function statementFor(customer: Customer, allInvoices: Invoice[]): CustomerStatement {
  const statementInvoices = allInvoices
    .filter((invoice) => invoice.customerId === customer.id)
    .sort((a, b) => a.issued.localeCompare(b.issued) || a.id.localeCompare(b.id))
    .map((invoice) => {
      // Picked apart rather than spread: InvoiceTotal also carries `vatable`,
      // which is for Finance checking the VAT rule, not for the customer.
      const { net, vat, total } = totalFor(invoice, customer);
      return { id: invoice.id, issued: invoice.issued, paid: invoice.paid, net, vat, total };
    });

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      address: customer.address,
    },
    invoices: statementInvoices,
    totals: {
      net: sum(statementInvoices.map((invoice) => invoice.net)),
      vat: sum(statementInvoices.map((invoice) => invoice.vat)),
      invoiced: sum(statementInvoices.map((invoice) => invoice.total)),
      paid: sum(
        statementInvoices.filter((invoice) => invoice.paid).map((invoice) => invoice.total),
      ),
      outstanding: sum(
        statementInvoices.filter((invoice) => !invoice.paid).map((invoice) => invoice.total),
      ),
    },
  };
}
