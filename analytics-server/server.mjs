// Smallest Node host for the site + first-party analytics: `ADMIN_TOKEN=... node analytics-server/server.mjs`
// shortcut: static files served without compression or range requests, put a real host/CDN in front for production.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAnalytics } from './collector.mjs';
import { events, funnel } from './config.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const analytics = createAnalytics({
  file: join(root, 'data/analytics.jsonl'),
  events,
  funnel,
});
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.xml': 'application/xml', '.txt': 'text/plain' };

createServer(async (req, res) => {
  if (await analytics.handle(req, res)) return;
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += p === '/' ? 'index.html' : 'index.html';
  const file = normalize(join(root, p));
  const top = file.slice(root.length + 1).split(sep)[0];
  if (!file.startsWith(root) || ['analytics-server', 'data', 'graft'].includes(top) || top.startsWith('.')) { res.writeHead(404).end('Not found'); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', ...(p.startsWith('/admin') && { 'Cache-Control': 'no-store' }) }).end(body);
  } catch { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }).end(await readFile(join(root, '404.html')).catch(() => 'Not found')); }
}).listen(process.env.PORT || 8080, () => console.log(`http://localhost:${process.env.PORT || 8080}`));
