// First-party analytics collector + aggregator. Node 18+, no dependencies, works as a plain http handler or Express middleware.
//   import { createAnalytics } from './collector.mjs';
//   const analytics = createAnalytics({ file: 'data/analytics.jsonl', adminToken: process.env.ADMIN_TOKEN, events: [...], funnel: [...] });
//   http:    if (await analytics.handle(req, res)) return;        express: app.use(analytics.middleware)
// Stores anonymous rows only: random visitor/session ids, path, referrer origin, screen width, language, event name + slug + number.
import { appendFile, readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { timingSafeEqual } from 'node:crypto';

const DAY = 864e5;
export const DEFAULT_EVENTS = ['ui_click', 'client_error', 'unhandled_rejection',
  'perf_ttfb', 'perf_fcp', 'perf_lcp', 'perf_cls', 'perf_inp'];
const LABEL = /^[\w .:/#-]*$/, ID = /^[a-z0-9-]{8,40}$/i;
const AI = /chatgpt\.com|openai\.com|perplexity\.ai|gemini\.google\.com|claude\.ai|copilot\.microsoft\.com|deepseek\.com|you\.com|phind\.com/;
const SEARCH = /google|bing|duckduckgo|yahoo|ecosia|baidu|yandex|brave|startpage/;
const SOCIAL = /facebook|instagram|t\.co|twitter|x\.com|reddit|tiktok|youtube|discord|linkedin|pinterest|threads|bsky|mastodon/;

export const channelOf = (ref, utm = '') => {
  if (utm) return 'Campaign';
  if (!ref) return 'Direct';
  const host = (ref || '').replace(/^https?:\/\//, '').toLowerCase();
  if (AI.test(host)) return 'AI assistants';
  if (SEARCH.test(host)) return 'Organic search';
  if (SOCIAL.test(host)) return 'Social';
  return 'Referral';
};
export const deviceOf = (w) => (w < 640 ? 'Mobile' : w < 960 ? 'Tablet' : 'Desktop');
export const isEngaged = (s) => s.durationMs >= 10_000 || s.views >= 2;
const pct = (n, d) => (d ? n / d : null);
const dayKey = (t) => new Date(t).toISOString().slice(0, 10);
const tally = (items) => Object.entries(items.reduce((a, k) => ((a[k] = (a[k] || 0) + 1), a), {})).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
export const percentile = (values, p) => { if (!values.length) return null; const s = [...values].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
export const VITALS_GOOD = { lcp: 2500, inp: 200, cls: 100 }; // cls is stored x1000

/** Pure function: rows in, dashboard JSON out. Unit-testable without a server. */
export function summarize(rows, { days = 30, now = Date.now(), funnel = [] } = {}) {
  const from = now - days * DAY;
  const inRange = rows.filter((r) => r.t >= from && r.t <= now);
  const views = inRange.filter((r) => r.type === 'pageview');
  const events = inRange.filter((r) => r.type === 'event');
  const pageTime = new Map(); // `${sid}|${path}` -> active ms (a page can report several times; the largest is the total)
  for (const r of inRange) if (r.type === 'leave') { const k = `${r.sid}|${r.path || ''}`; pageTime.set(k, Math.max(pageTime.get(k) || 0, r.durationMs)); }
  const leaves = new Map();
  for (const [k, ms] of pageTime) { const sid = k.split('|')[0]; leaves.set(sid, (leaves.get(sid) || 0) + ms); }

  const sessions = new Map();
  for (const v of views) {
    const s = sessions.get(v.sid) || { sid: v.sid, vid: v.vid, views: 0, landing: v.path, ref: v.ref, utm: v.utm, src: v.src || '', w: v.w, lang: v.lang, t: v.t, durationMs: 0 };
    s.views++; if (v.ref && !s.ref) s.ref = v.ref; if (v.utm && !s.utm) { s.utm = v.utm; s.src = v.src || ''; } sessions.set(v.sid, s);
  }
  for (const s of sessions.values()) s.durationMs = leaves.get(s.sid) || 0;
  const all = [...sessions.values()];
  const engaged = all.filter(isEngaged);
  const firstSeen = new Map(); // visitor -> first pageview across ALL history
  for (const r of rows) if (r.type === 'pageview' && (!firstSeen.has(r.vid) || r.t < firstSeen.get(r.vid))) firstSeen.set(r.vid, r.t);
  const visitors = new Set(views.map((v) => v.vid));
  const newVisitors = [...visitors].filter((v) => firstSeen.get(v) >= from).length;

  const series = [];
  for (let d = days - 1; d >= 0; d--) {
    const day = dayKey(now - d * DAY), dv = views.filter((v) => dayKey(v.t) === day);
    series.push({ day, pageviews: dv.length, visitors: new Set(dv.map((v) => v.vid)).size, sessions: new Set(dv.map((v) => v.sid)).size });
  }

  const sessionTable = (key) => {
    const g = {}; for (const s of all) (g[key(s)] ||= []).push(s);
    return Object.entries(g).map(([label, list]) => ({ label, sessions: list.length, avgMs: Math.round(list.reduce((a, s) => a + s.durationMs, 0) / list.length),
      engagedRate: pct(list.filter(isEngaged).length, list.length), bounceRate: pct(list.filter((s) => s.views === 1 && !isEngaged(s)).length, list.length) }))
      .sort((a, b) => b.sessions - a.sessions);
  };
  const host = (ref) => ref.replace(/^https?:\/\//, '');

  const named = events.filter((e) => !/^(perf_|scroll_depth|video_)/.test(e.name));
  const featureRows = [...new Set(named.map((e) => `${e.name} ${e.label}`))].map((k) => {
    const list = named.filter((e) => `${e.name} ${e.label}` === k), sess = new Set(list.map((e) => e.sid)).size;
    return { name: list[0].name, label: list[0].label, events: list.length, sessions: sess, share: pct(sess, all.length) };
  }).sort((a, b) => b.events - a.events);

  const vitals = {};
  for (const e of events) if (e.name.startsWith('perf_') && e.value !== null) ((vitals[e.label || '/'] ||= {})[e.name] ||= []).push(e.value);
  const vitalsRows = Object.entries(vitals).map(([path, m]) => {
    const lcp = percentile(m.perf_lcp || [], 0.75), inp = percentile(m.perf_inp || [], 0.75), cls = percentile(m.perf_cls || [], 0.75);
    const checks = [[lcp, VITALS_GOOD.lcp], [inp, VITALS_GOOD.inp], [cls, VITALS_GOOD.cls]].filter(([v]) => v !== null);
    return { path, n: Math.max(...Object.values(m).map((a) => a.length)), lcpMs: lcp, inpMs: inp, clsX1000: cls,
      verdict: !checks.length ? 'No data' : checks.every(([v, g]) => v <= g) ? 'Good' : 'Needs work' };
  }).sort((a, b) => b.n - a.n);
  const perf = ['perf_ttfb', 'perf_fcp', 'perf_lcp', 'perf_inp', 'perf_cls'].map((metric) => {
    const v = events.filter((e) => e.name === metric && e.value !== null).map((e) => e.value);
    return { metric, n: v.length, p50: percentile(v, 0.5), p75: percentile(v, 0.75), p95: percentile(v, 0.95) };
  });

  // ---- Page by page: what each page earned in views, time, scroll, clicks and video ----
  const sessionUtm = new Map(all.map((s) => [s.sid, s.utm]));
  const byPage = new Map();
  const pg = (path) => { let g = byPage.get(path); if (!g) byPage.set(path, (g = { path, views: 0, vids: new Set(), sids: new Set(), times: [], depth: new Map(), clicked: new Set(), played: new Set() })); return g; };
  for (const v of views) { const g = pg(v.path); g.views++; g.vids.add(v.vid); g.sids.add(v.sid); }
  for (const [k, ms] of pageTime) { const [sid, path] = [k.slice(0, k.indexOf('|')), k.slice(k.indexOf('|') + 1)]; if (byPage.has(path) && ms > 0) byPage.get(path).times.push(ms); }
  const clickEvents = events.filter((e) => e.name === 'link_click' || e.name === 'ui_click');
  for (const e of events) {
    const g = e.path && byPage.get(e.path); if (!g) continue;
    if (e.name === 'scroll_depth' && e.value !== null) g.depth.set(e.sid, Math.max(g.depth.get(e.sid) || 0, e.value));
    else if (e.name === 'link_click' || e.name === 'ui_click') g.clicked.add(e.sid);
    else if (e.name === 'video_play') g.played.add(e.sid);
  }
  const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
  const pageStats = [...byPage.values()].map((g) => { const d = [...g.depth.values()]; return {
    path: g.path, views: g.views, visitors: g.vids.size, sessions: g.sids.size, avgTimeMs: avg(g.times), medianTimeMs: percentile(g.times, 0.5),
    avgScroll: d.length ? Math.round(d.reduce((x, y) => x + y, 0) / d.length) : null, reached75: d.length ? pct(d.filter((x) => x >= 75).length, d.length) : null,
    clickRate: pct(g.clicked.size, g.sids.size), videoRate: g.played.size ? pct(g.played.size, g.sids.size) : null }; }).sort((a, b) => b.views - a.views);
  const grouped = (list, key, extra) => { const m = new Map(); for (const e of list) { const k = key(e); const g = m.get(k) || { ...extra(e), n: 0, sids: new Set() }; g.n++; g.sids.add(e.sid); m.set(k, g); } return [...m.values()].map(({ sids, ...r }) => ({ ...r, sessions: sids.size })).sort((a, b) => b.n - a.n); };
  const clicks = grouped(clickEvents, (e) => `${e.path}|${e.name}|${e.label}`, (e) => ({ path: e.path || '(unknown)', kind: e.name === 'link_click' ? 'Link' : 'Button', label: e.label })).slice(0, 60);
  const campaignPages = grouped(views.filter((v) => sessionUtm.get(v.sid)), (v) => `${sessionUtm.get(v.sid)}|${v.path}`, (v) => ({ campaign: sessionUtm.get(v.sid), path: v.path })).slice(0, 40);
  const videoNames = [...new Set(events.filter((e) => e.name.startsWith('video_')).map((e) => e.label))];
  const videos = videoNames.map((label) => {
    const of = (name) => events.filter((e) => e.name === name && e.label === label);
    const plays = new Set(of('video_play').map((e) => e.sid)), watched = new Map(), milestone = new Map();
    for (const e of of('video_watch')) watched.set(e.sid, Math.max(watched.get(e.sid) || 0, e.value || 0));
    for (const e of of('video_progress')) milestone.set(e.sid, Math.max(milestone.get(e.sid) || 0, e.value || 0));
    const page = tally(of('video_play').map((e) => e.path || '(unknown)'))[0]?.label ?? null, onPage = page && byPage.get(page) ? byPage.get(page).sids.size : 0, w = [...watched.values()];
    return { label, page, playedSessions: plays.size, playRate: onPage ? pct(plays.size, onPage) : null, avgWatchedSec: w.length ? Math.round(w.reduce((x, y) => x + y, 0) / w.length) : null,
      reached50: plays.size ? pct([...milestone.values()].filter((m) => m >= 50).length, plays.size) : null, finished: plays.size ? pct([...milestone.values()].filter((m) => m >= 95).length, plays.size) : null };
  }).sort((a, b) => b.playedSessions - a.playedSessions);

  const heat = Array.from({ length: 7 }, () => Array(24).fill(0)); // weekday x hour, UTC
  for (const v of views) { const d = new Date(v.t); heat[d.getUTCDay()][d.getUTCHours()]++; }

  const WEEK = 7 * DAY, retention = []; // weekly cohorts by first-seen week, last 8 weeks
  for (let w = 7; w >= 0; w--) {
    const start = now - (w + 1) * WEEK, end = now - w * WEEK;
    const cohort = [...firstSeen].filter(([, t]) => t >= start && t < end).map(([v]) => v);
    const back = [];
    for (let k = 0; k <= w; k++) {
      const a = start + k * WEEK, b = a + WEEK;
      const active = new Set(rows.filter((r) => r.type === 'pageview' && r.t >= a && r.t < b).map((r) => r.vid));
      back.push(pct(cohort.filter((v) => active.has(v)).length, cohort.length));
    }
    retention.push({ week: dayKey(start), size: cohort.length, retained: back });
  }
  const active = (ms) => new Set(rows.filter((r) => r.type === 'pageview' && r.t >= now - ms).map((r) => r.vid)).size;
  const dau = active(DAY), mau = active(30 * DAY);

  const steps = [{ label: 'Visitors', n: visitors.size }, { label: 'Engaged sessions', n: engaged.length }].concat(funnel.map((f) => ({
    label: f.label,
    n: f.path ? new Set(views.filter((v) => v.path === f.path).map((v) => v.sid)).size
      : new Set(events.filter((e) => e.name === f.event && (!f.eventLabel || e.label === f.eventLabel)).map((e) => e.sid)).size })));
  const errorEvents = events.filter((e) => e.name === 'client_error' || e.name === 'unhandled_rejection');

  return {
    generatedAt: now, days,
    totals: { pageviews: views.length, visitors: visitors.size, newVisitors, returningVisitors: visitors.size - newVisitors, sessions: all.length,
      pagesPerSession: all.length ? views.length / all.length : null, engagedRate: pct(engaged.length, all.length),
      bounceRate: pct(all.filter((s) => s.views === 1 && !isEngaged(s)).length, all.length),
      avgEngagementMs: all.length ? Math.round(all.reduce((a, s) => a + s.durationMs, 0) / all.length) : null,
      medianEngagementMs: percentile(all.map((s) => s.durationMs), 0.5), events: events.length, errors: errorEvents.length },
    series,
    channels: tally(all.map((s) => channelOf(s.ref, s.utm))),
    channelEngagement: sessionTable((s) => channelOf(s.ref, s.utm)),
    referrers: tally(all.filter((s) => s.ref).map((s) => host(s.ref))).slice(0, 15),
    campaigns: tally(all.filter((s) => s.utm).map((s) => s.utm)).slice(0, 15),
    links: tally(all.filter((s) => s.utm || s.src).map((s) => `${s.utm || '(none)'} · ${s.src || '(none)'}`)).slice(0, 25), // campaign · placement, from the referral link generator
    darkSocial: all.filter((s) => !s.ref && !s.utm && s.landing !== '/').length,
    pages: tally(views.map((v) => v.path)).slice(0, 25), pageStats, clicks, campaignPages, videos,
    landings: sessionTable((s) => s.landing).slice(0, 15),
    devices: sessionTable((s) => deviceOf(s.w)),
    languages: tally(all.map((s) => (s.lang || 'unknown').toLowerCase())).slice(0, 10),
    heat, retention, stickiness: { dau, mau, ratio: pct(dau, mau) },
    depth: tally(all.map((s) => (s.views >= 5 ? '5+ pages' : `${s.views} page${s.views > 1 ? 's' : ''}`))).sort((a, b) => a.label.localeCompare(b.label)),
    eventNames: tally(named.map((e) => e.name)), features: featureRows.slice(0, 40),
    funnel: steps, vitals: vitalsRows.slice(0, 25), performance: perf,
    errorsByMessage: tally(errorEvents.map((e) => e.label || '(no message)')).slice(0, 10),
  };
}

export function createAnalytics({ file = 'data/analytics.jsonl', adminToken = process.env.ADMIN_TOKEN, events = [], funnel = [], retentionDays = 400,
  perMinuteLimit = 120, trackPath = '/api/track', summaryPath = '/api/admin/summary', store = null } = {}) {
  // store (optional, e.g. a Cloudflare D1 adapter): { loadRows(sinceMs), appendRow(row) } replaces the file.
  const allowed = new Set([...DEFAULT_EVENTS, ...events]);
  let rows = [], loaded;
  const hits = new Map(); // ip -> [windowStart, count]
  const load = () => (loaded ||= store ? store.loadRows(Date.now() - retentionDays * DAY).then((r) => { rows = r; }) : readFile(file, 'utf8').then((text) => {
    const cutoff = Date.now() - retentionDays * DAY;
    rows = text.split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.t >= cutoff);
  }).catch((e) => { if (e.code !== 'ENOENT') throw e; }));
  const persist = async (row) => { if (store) return store.appendRow(row); rows.push(row); await mkdir(dirname(file), { recursive: true }); await appendFile(file, JSON.stringify(row) + '\n'); };
  const limited = (ip) => { const n = Date.now(), h = hits.get(ip); if (!h || n - h[0] > 60_000) { hits.set(ip, [n, 1]); return false; } return ++h[1] > perMinuteLimit; };

  /** Validated by hand: unknown keys dropped, strings capped, ids and event names allowlisted. */
  const clean = (b) => {
    if (!b || typeof b !== 'object' || !ID.test(b.vid || '') || !ID.test(b.sid || '')) return null;
    const base = { t: Date.now(), type: b.type, vid: b.vid, sid: b.sid };
    if (b.type === 'pageview') return { ...base, path: String(b.path || '/').slice(0, 120), ref: String(b.ref || '').slice(0, 300), utm: String(b.utm || '').slice(0, 80), src: String(b.src || '').slice(0, 40),
      w: Math.max(0, Math.min(1e4, Math.round(+b.w) || 0)), lang: String(b.lang || '').slice(0, 20), loadMs: Number.isFinite(b.loadMs) ? Math.max(0, Math.min(12e4, b.loadMs)) : null };
    if (b.type === 'leave') return { ...base, path: String(b.path || '').slice(0, 120), durationMs: Math.max(0, Math.min(DAY, Math.round(+b.durationMs) || 0)) };
    if (b.type === 'event' && allowed.has(b.name) && LABEL.test(b.label ?? '')) return { ...base, path: String(b.path || '').slice(0, 120), name: b.name, label: String(b.label ?? '').slice(0, 60),
      value: Number.isFinite(b.value) ? Math.max(0, Math.min(1e7, Math.round(b.value))) : null };
    return null;
  };

  const readBody = (req, max = 4096) => new Promise((ok, no) => { let s = ''; req.on('data', (c) => { s += c; if (s.length > max) { no(new Error('too big')); req.destroy(); } }); req.on('end', () => ok(s)); req.on('error', no); });
  const isAdmin = (h) => { if (!adminToken || !h?.startsWith('Bearer ')) return false; const a = Buffer.from(h.slice(7)), b = Buffer.from(adminToken); return a.length === b.length && timingSafeEqual(a, b); };
  const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };

  async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && url.pathname === trackPath) {
      if (!store) await load(); // a remote store keeps no in-memory copy, so a beacon never pays for a full read
      if (limited(req.socket?.remoteAddress || '')) { res.writeHead(429).end(); return true; }
      try { const row = clean(JSON.parse(await readBody(req))); if (row) await persist(row); } catch { /* malformed beacon: ignore */ }
      res.writeHead(204).end(); return true;
    }
    if (req.method === 'GET' && url.pathname === summaryPath) {
      if (!adminToken) { json(res, 503, { error: 'Admin access is not configured. Set ADMIN_TOKEN.' }); return true; }
      if (!isAdmin(req.headers.authorization)) { json(res, 401, { error: 'Wrong admin token.' }); return true; }
      await load();
      const s = summarize(rows, { days: 30, funnel });
      json(res, 200, s); return true;
    }
    return false;
  }
  const middleware = (req, res, next) => { handle(req, res).then((done) => done || next()).catch(next); };
  return { handle, middleware, load, rows: () => rows, summarize: (o) => summarize(rows, { funnel, ...o }) };
}
