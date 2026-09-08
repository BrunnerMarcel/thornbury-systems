// Front end for the Thornbury API. Hash routing, no build step, no framework,
// to match the rest of the repo: the page is served straight off disk and the
// API is same-origin, so there is nothing to configure and no CORS to set up.

import { format } from './money.js';

const view = document.getElementById('view');

/* ---------- markup ---------- */

class Html {
  constructor(value) {
    this.value = value;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function render(value) {
  if (value instanceof Html) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  if (value === null || value === undefined) return '';
  return escapeHtml(value);
}

// Tagged template that escapes every interpolation. Nested html`` fragments are
// already escaped and pass through, so tables compose without opting out.
function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    out += render(values[i]) + strings[i + 1];
  }
  return new Html(out);
}

/* ---------- api ---------- */

async function api(path) {
  const response = await fetch(path, { headers: { accept: 'application/json' } });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? `${path} returned ${response.status}`);
  }
  return body;
}

/* ---------- shared cells ---------- */

function money(pence) {
  return html`<td class="num">${format(pence)}</td>`;
}

function paidTag(paid) {
  return paid
    ? html`<span class="settled">Paid</span>`
    : html`<span class="owed">Outstanding</span>`;
}

function table(headers, rows, footer) {
  if (rows.length === 0) return html`<p class="empty">Nothing to show.</p>`;
  // Wide tables scroll inside their own box so the page itself never does.
  return html`<div class="scroll"><table>
    <thead><tr>${headers.map((h) => html`<th class="${h.num ? 'num' : ''}">${h.label}</th>`)}</tr></thead>
    <tbody>${rows}</tbody>
    ${footer ? html`<tfoot>${footer}</tfoot>` : ''}
  </table></div>`;
}

/* ---------- views ---------- */

async function showCustomers() {
  const customers = await api('/customers');

  return html`
    <h2>Customers</h2>
    <p class="subtitle">${customers.length} accounts.</p>
    ${table(
      [{ label: 'Account' }, { label: 'Name' }, { label: 'Address' }, { label: 'Type' }],
      customers.map((customer) => html`<tr>
        <td class="mono"><a href="#/customers/${customer.id}">${customer.id}</a></td>
        <td>${customer.name}</td>
        <td>${customer.address}</td>
        <td><span class="tag">${customer.accountType}</span></td>
      </tr>`),
    )}
  `;
}

async function showCustomer(id) {
  // /customers/:id already formats `outstanding` server side; the invoice list
  // does not, so those totals are worked out here from pence.
  const [customer, invoices] = await Promise.all([
    api(`/customers/${encodeURIComponent(id)}`),
    api(`/customers/${encodeURIComponent(id)}/invoices`),
  ]);

  return html`
    <p class="crumb"><a href="#/customers">Customers</a></p>
    <h2>${customer.name}</h2>
    <p class="subtitle">${customer.address}</p>

    <div class="panel">
      <dl class="facts">
        <dt>Account</dt><dd class="mono">${customer.id}</dd>
        <dt>Type</dt><dd>${customer.accountType}</dd>
        <dt>Outstanding</dt>
        <dd class="${customer.outstanding === format(0) ? 'settled' : 'owed'}">${customer.outstanding}</dd>
      </dl>
      <p class="note"><a href="#/customers/${customer.id}/statement">View statement</a></p>
      <!-- Kept away from Outstanding on purpose. Sitting next to it, this read as
           though it were what drives the VAT, and it is not. -->
      <p class="note">VAT registered: ${customer.vatRegistered ? 'Yes' : 'No'}. This governs
        what the customer can reclaim, not what we charge them &mdash; the VAT on their
        invoices follows the account type.</p>
    </div>

    <h3>Invoices</h3>
    ${table(
      [{ label: 'Invoice' }, { label: 'Issued' }, { label: 'Source' }, { label: 'Status' }],
      invoices.map((invoice) => html`<tr>
        <td class="mono"><a href="#/invoices/${invoice.id}">${invoice.id}</a></td>
        <td>${invoice.issued}</td>
        <td><span class="tag">${invoice.source}</span></td>
        <td>${paidTag(invoice.paid)}</td>
      </tr>`),
    )}
  `;
}

async function showStatement(id) {
  const statement = await api(`/customers/${encodeURIComponent(id)}/statement`);
  const { customer, invoices, totals } = statement;

  return html`
    <p class="crumb"><a href="#/customers/${customer.id}">${customer.name}</a></p>
    <h2>Statement</h2>
    <p class="subtitle">${customer.name} &middot; ${customer.address}</p>

    ${table(
      [
        { label: 'Invoice' }, { label: 'Issued' }, { label: 'Status' },
        { label: 'Net', num: true }, { label: 'VAT', num: true }, { label: 'Total', num: true },
      ],
      invoices.map((invoice) => html`<tr>
        <td class="mono"><a href="#/invoices/${invoice.id}">${invoice.id}</a></td>
        <td>${invoice.issued}</td>
        <td>${paidTag(invoice.paid)}</td>
        ${money(invoice.net)}
        ${money(invoice.vat)}
        ${money(invoice.total)}
      </tr>`),
      html`
        <tr>
          <td colspan="3">Invoiced</td>
          ${money(totals.net)}
          ${money(totals.vat)}
          ${money(totals.invoiced)}
        </tr>
        <tr>
          <td colspan="5">Paid</td>
          ${money(totals.paid)}
        </tr>
        <tr>
          <td colspan="5">Outstanding</td>
          <td class="num owed">${format(totals.outstanding)}</td>
        </tr>
      `,
    )}
  `;
}

async function showInvoice(id) {
  const invoice = await api(`/invoices/${encodeURIComponent(id)}`);

  return html`
    <p class="crumb"><a href="#/customers/${invoice.customerId}">${invoice.customerId}</a></p>
    <h2>${invoice.id}</h2>
    <p class="subtitle">Issued ${invoice.issued} &middot; ${invoice.source} &middot; ${paidTag(invoice.paid)}</p>

    ${table(
      [
        { label: 'Description' }, { label: 'Kind' },
        { label: 'Quantity', num: true }, { label: 'Unit', num: true }, { label: 'Total', num: true },
      ],
      invoice.lines.map((line) => html`<tr>
        <td>${line.description}</td>
        <td><span class="tag">${line.kind}</span></td>
        <td class="num">${line.quantity}</td>
        ${money(line.unitPence)}
        ${money(line.quantity * line.unitPence)}
      </tr>`),
      html`
        <tr><td colspan="4">Net</td>${money(invoice.net)}</tr>
        <tr><td colspan="4">Of which vatable</td>${money(invoice.vatable)}</tr>
        <tr><td colspan="4">VAT</td>${money(invoice.vat)}</tr>
        <tr><td colspan="4">Total</td><td class="num">${invoice.display}</td></tr>
      `,
    )}
    <p class="note">Engineer work is standard rated. Metered supply is zero rated to a
      domestic account and standard rated to a commercial one. The rule is in
      <span class="mono">src/invoices/calc.ts</span> and is not signed off yet.</p>
  `;
}

async function showWorkOrders() {
  const orders = await api('/work-orders');

  return html`
    <h2>Work orders</h2>
    <p class="subtitle">${orders.length} on the book.</p>
    ${table(
      [
        { label: 'Order' }, { label: 'Customer' }, { label: 'Address' }, { label: 'Requires' },
        { label: 'Requested (UTC)' }, { label: 'Minutes', num: true }, { label: 'Status' },
      ],
      orders.map((order) => html`<tr>
        <td class="mono">${order.id}</td>
        <td class="mono"><a href="#/customers/${order.customerId}">${order.customerId}</a></td>
        <td>${order.address}</td>
        <td><span class="tag">${order.requires}</span></td>
        <td class="mono">${order.requestedAt}</td>
        <td class="num">${order.durationMinutes}</td>
        <td><span class="tag">${order.status}</span></td>
      </tr>`),
    )}
    <p class="note">Stored times are UTC. Customers are quoted UK local time on
      <a href="#/slots">appointment windows</a>.</p>
  `;
}

async function showDispatch() {
  const [plan, orders] = await Promise.all([api('/dispatch'), api('/work-orders')]);
  const planned = new Set(plan.map((assignment) => assignment.workOrderId));
  const unplanned = orders.filter((order) => order.status === 'QUEUED' && !planned.has(order.id));

  return html`
    <h2>Dispatch</h2>
    <p class="subtitle">${plan.length} of ${orders.length} orders assigned.</p>
    ${table(
      [{ label: 'Order' }, { label: 'Engineer' }, { label: 'Address' }, { label: 'Starts (UTC)' }],
      plan.map((assignment) => html`<tr>
        <td class="mono">${assignment.workOrderId}</td>
        <td class="mono">${assignment.engineerId}</td>
        <td>${assignment.address}</td>
        <td class="mono">${assignment.startsAt}</td>
      </tr>`),
    )}

    <h3>Queued but not assigned</h3>
    ${table(
      [{ label: 'Order' }, { label: 'Address' }, { label: 'Requires' }, { label: 'Requested (UTC)' }],
      unplanned.map((order) => html`<tr>
        <td class="mono">${order.id}</td>
        <td>${order.address}</td>
        <td><span class="tag">${order.requires}</span></td>
        <td class="mono">${order.requestedAt}</td>
      </tr>`),
    )}
    <p class="note">An order is left here for one of two reasons: the address is
      already being visited that day, or no engineer with the right skill is free for
      the slot. The plan does not say which, so check both before assuming a duplicate.</p>
  `;
}

async function showSlots() {
  const slots = await api('/slots');

  return html`
    <h2>Appointment windows</h2>
    <p class="subtitle">What the customer is told. UK local time.</p>
    ${table(
      [{ label: 'Order' }, { label: 'Date' }, { label: 'Window' }],
      // A window that runs past midnight has two dates and the API returns both.
      // Showing only one of them is what put the wrong-date ticket in the queue
      // three times: the date said one day, the window opened on the one before.
      slots.map((slot) => html`<tr>
        <td class="mono">${slot.workOrderId}</td>
        <td class="mono">${slot.date}${slot.endDate === slot.date ? '' : html` &rarr; ${slot.endDate}`}</td>
        <td>${slot.window}</td>
      </tr>`),
    )}
    <p class="note">An out of hours window crosses midnight, so it is dated at both
      ends. The window opens on the first date.</p>
  `;
}

/* ---------- router ---------- */

const routes = [
  [/^\/customers$/, showCustomers],
  [/^\/customers\/([^/]+)$/, showCustomer],
  [/^\/customers\/([^/]+)\/statement$/, showStatement],
  [/^\/invoices\/([^/]+)$/, showInvoice],
  [/^\/work-orders$/, showWorkOrders],
  [/^\/dispatch$/, showDispatch],
  [/^\/slots$/, showSlots],
];

function markActiveNav(path) {
  for (const link of document.querySelectorAll('nav a')) {
    link.classList.toggle('active', path.startsWith(link.dataset.path));
  }
}

// A malformed escape in the hash is a bad link, not a reason to throw: decodeURI
// would take the router down before it could render anything, leaving whatever
// the previous view put on screen sitting under the new URL.
function currentPath() {
  const raw = location.hash.replace(/^#/, '');
  try {
    return decodeURI(raw) || '/customers';
  } catch {
    return raw || '/customers';
  }
}

async function route() {
  const path = currentPath();
  markActiveNav(path);

  const entry = routes.find(([pattern]) => pattern.test(path));
  if (!entry) {
    view.innerHTML = render(html`<p class="error">No such page: ${path}</p>`);
    return;
  }

  const [pattern, handler] = entry;
  view.innerHTML = '<p class="loading">Loading…</p>';
  try {
    view.innerHTML = render(await handler(...pattern.exec(path).slice(1)));
  } catch (error) {
    view.innerHTML = render(html`<p class="error">${error.message}</p>`);
  }
}

addEventListener('hashchange', route);
route();
