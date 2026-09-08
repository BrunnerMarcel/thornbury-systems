import { createServer } from 'node:http';
import { customers, invoices, workOrders } from './db.ts';
import { totalFor, outstandingFor } from './invoices/calc.ts';
import { statementFor } from './invoices/statement.ts';
import { dispatch } from './scheduling/dispatch.ts';
import { slotsFor } from './scheduling/slots.ts';
import { format } from './shared/money.ts';
import { serveAsset, UI_PREFIX } from './static.ts';

const PORT = Number(process.env.PORT ?? 4310);

function json(res: import('node:http').ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(payload);
}

export const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  // The UI is a single page: every view is a #fragment, so one index.html and
  // its two assets are the whole of it.
  if (url.pathname === UI_PREFIX) {
    res.writeHead(302, { location: `${UI_PREFIX}/` });
    return res.end();
  }
  if (url.pathname.startsWith(`${UI_PREFIX}/`)) {
    if (await serveAsset(url.pathname.slice(UI_PREFIX.length), res)) return;
    return json(res, 404, { error: 'no such asset', path: url.pathname });
  }

  const parts = url.pathname.split('/').filter(Boolean);

  if (parts.length === 0) {
    return json(res, 200, {
      service: 'Thornbury Systems billing and scheduling',
      version: '3.11.2',
      ui: `${UI_PREFIX}/`,
      routes: [
        'GET /customers',
        'GET /customers/:id',
        'GET /customers/:id/invoices',
        'GET /customers/:id/statement',
        'GET /invoices/:id',
        'GET /work-orders',
        'GET /dispatch',
        'GET /slots',
      ],
    });
  }

  if (parts[0] === 'customers' && parts.length === 1) {
    return json(res, 200, customers);
  }

  if (parts[0] === 'customers' && parts.length === 2) {
    const customer = customers.find((c) => c.id === parts[1]);
    if (!customer) return json(res, 404, { error: 'no such customer' });
    return json(res, 200, {
      ...customer,
      outstanding: format(outstandingFor(customer, invoices)),
    });
  }

  if (parts[0] === 'customers' && parts.length === 3 && parts[2] === 'invoices') {
    return json(res, 200, invoices.filter((i) => i.customerId === parts[1]));
  }

  if (parts[0] === 'customers' && parts.length === 3 && parts[2] === 'statement') {
    if (req.method !== 'GET') {
      res.setHeader('allow', 'GET');
      return json(res, 405, { error: 'method not allowed' });
    }
    const customer = customers.find((candidate) => candidate.id === parts[1]);
    if (!customer) return json(res, 404, { error: 'no such customer' });
    return json(res, 200, statementFor(customer, invoices));
  }

  if (parts[0] === 'invoices' && parts.length === 2) {
    const invoice = invoices.find((i) => i.id === parts[1]);
    if (!invoice) return json(res, 404, { error: 'no such invoice' });
    // VAT depends on the account, so an invoice cannot be totalled without it.
    const customer = customers.find((c) => c.id === invoice.customerId);
    if (!customer) return json(res, 409, { error: 'invoice has no customer', customerId: invoice.customerId });
    const totals = totalFor(invoice, customer);
    return json(res, 200, { ...invoice, ...totals, display: format(totals.total) });
  }

  if (parts[0] === 'work-orders') {
    return json(res, 200, workOrders);
  }

  if (parts[0] === 'dispatch') {
    return json(res, 200, dispatch(workOrders));
  }

  if (parts[0] === 'slots') {
    return json(res, 200, slotsFor(workOrders));
  }

  return json(res, 404, { error: 'no such route', path: url.pathname });
});

if (process.argv[1]?.endsWith('server.ts')) {
  server.listen(PORT, () => {
    console.log(`Thornbury Systems listening on http://localhost:${PORT}`);
  });
}
