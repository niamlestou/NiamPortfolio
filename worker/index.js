// Cloudflare Worker: the same collector as analytics-server/, with Cloudflare D1 as the store.
// Routes (see wrangler.toml): niam.pro/api/track and niam.pro/api/admin/*. Secret: ADMIN_TOKEN.
// shortcut: admin views read every row from the last 400 days into memory; fine for a portfolio, move to SQL aggregates past ~100k rows.
import { createAnalytics } from '../analytics-server/collector.mjs';
import { events, funnel } from '../analytics-server/config.mjs';

const d1Store = (db) => ({
  loadRows: async (since) => (await db.prepare('SELECT j FROM rows WHERE t >= ?').bind(since).all()).results.map((r) => JSON.parse(r.j)),
  appendRow: (row) => db.prepare('INSERT INTO rows (t, j) VALUES (?, ?)').bind(row.t, JSON.stringify(row)).run(),
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const body = request.method === 'POST' ? await request.text() : '';
    // A fresh collector per request: no stale in-memory rows across isolates.
    const analytics = createAnalytics({ adminToken: env.ADMIN_TOKEN || '', events, funnel, store: d1Store(env.DB) });

    // The collector speaks Node's req/res; these two stubs are the whole adapter.
    const req = { method: request.method, url: url.pathname + url.search, headers: Object.fromEntries(request.headers),
      socket: { remoteAddress: request.headers.get('cf-connecting-ip') || '' }, // only used for the in-memory rate limit, never stored
      on: (ev, cb) => { if (ev === 'data') cb(body); else if (ev === 'end') cb(); }, destroy() {} };
    let out, status = 200, headers = {};
    const res = { writeHead: (c, h = {}) => { status = c; headers = h; return res; }, end: (b) => { out = new Response(b ?? null, { status, headers }); } };

    try { await analytics.handle(req, res); } catch { return new Response('Server error', { status: 500 }); }
    return out ?? new Response('Not found', { status: 404 });
  },
};
