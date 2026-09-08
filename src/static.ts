// Static hosting for the browser front end in public/.
//
// The API routes are the contract the front end talks to and the repo already
// ships them, so the UI is mounted under /app rather than taking over /.

import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ServerResponse } from 'node:http';

export const UI_PREFIX = '/app';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

// Maps a path under /app onto a file in public/, or null if it does not name
// one we are willing to serve.
export function resolveAsset(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;

  const relative = decoded.replace(/^\/+/, '');
  const absolute = normalize(join(PUBLIC_DIR, relative === '' ? 'index.html' : relative));

  // join() and normalize() collapse ../ segments before this comparison, so an
  // encoded traversal cannot climb out of public/.
  if (!absolute.startsWith(PUBLIC_DIR)) return null;
  return absolute;
}

export async function serveAsset(pathname: string, res: ServerResponse): Promise<boolean> {
  const file = resolveAsset(pathname);
  if (!file) return false;

  let body: Buffer;
  try {
    body = await readFile(file);
  } catch {
    return false;
  }

  res.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
    // Seed data changes under the server, so nothing here is worth caching yet.
    'cache-control': 'no-cache',
  });
  res.end(body);
  return true;
}
