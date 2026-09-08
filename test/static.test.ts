import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../src/server.ts';
import { resolveAsset } from '../src/static.ts';
import { format } from '../src/shared/money.ts';
import { format as browserFormat } from '../public/money.js';

let baseUrl: string;

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test('the front end is served at /app/', async () => {
  const response = await fetch(`${baseUrl}/app/`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.match(await response.text(), /<title>Thornbury Systems<\/title>/);
});

test('/app redirects to /app/ so relative assets resolve', async () => {
  const response = await fetch(`${baseUrl}/app`, { redirect: 'manual' });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/app/');
});

test('front end assets are served with their own content type', async () => {
  for (const [file, contentType] of [
    ['app.js', 'text/javascript; charset=utf-8'],
    ['styles.css', 'text/css; charset=utf-8'],
  ]) {
    const response = await fetch(`${baseUrl}/app/${file}`);
    assert.equal(response.status, 200, file);
    assert.equal(response.headers.get('content-type'), contentType, file);
  }
});

test('a missing asset is a 404 rather than a hang', async () => {
  const response = await fetch(`${baseUrl}/app/nope.js`);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'no such asset', path: '/app/nope.js' });
});

test('asset paths cannot climb out of public/', () => {
  for (const attempt of [
    '/../src/db.ts',
    '/../../etc/passwd',
    '/%2e%2e/src/db.ts',
    '/nested/../../src/db.ts',
    '/\0.html',
  ]) {
    assert.equal(resolveAsset(attempt), null, attempt);
  }
});

test('mounting the UI leaves the API routes alone', async () => {
  const response = await fetch(`${baseUrl}/customers/C-1002/statement`);

  assert.equal(response.status, 200);
  assert.equal((await response.json()).totals.outstanding, 248400);
});

// The browser cannot import the TypeScript money helper, so public/money.js
// repeats it. This is the guard that stops the copy drifting.
test('the browser money formatter matches the server one', () => {
  for (const pence of [0, 1, 99, 100, 195, 2400, 248400, 1234567, -1, -500, -1234567]) {
    assert.equal(browserFormat(pence), format(pence), String(pence));
  }
});
