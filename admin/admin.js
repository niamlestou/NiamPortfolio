// Admin dashboard renderer. Views are data (VIEWS below): add or remove widgets there, not in the markup.
// Widget types: kpis, trend, rank, funnel, table, heat, cohort, note. All text goes through textContent (no HTML injection).
(() => {
  const API = '/api/admin/summary', KEY = 'admin_token';
  const $ = (id) => document.getElementById(id);
  const num = (n, d = 0) => (n === null || n === undefined ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: d }));
  const pct = (n) => (n === null || n === undefined ? '—' : `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`);
  const dur = (ms) => (ms === null || ms === undefined ? '—' : ms < 1000 ? `${ms} ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const token = { get: () => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } }, set: (v) => { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch {} } };

  const THEME_NAMES = { control: 'Compute', meadow: 'Meadow' };
  const AB_ROWS = [ // [label, key, formatter, which direction is better: 1 higher, -1 lower, 0 neither]
    ['Sessions', 'sessions', num, 0], ['Visitors', 'visitors', num, 0], ['Pages per visit', 'pagesPerSession', (n) => num(n, 2), 1], ['Avg. visit length', 'avgSessionMs', dur, 1],
    ['Median visit length', 'medianSessionMs', dur, 1], ['Avg. time per page', 'avgPageMs', dur, 1], ['Avg. scroll depth', 'avgScroll', (n) => (n === null ? '—' : `${n}%`), 1], ['Read to 75%', 'reached75', pct, 1],
    ['Engaged visits', 'engagedRate', pct, 1], ['Bounce rate', 'bounceRate', pct, -1], ['Clicked something', 'clickRate', pct, 1], ['Viewed a project', 'projectRate', pct, 1],
    ['Reached contact page', 'contactRate', pct, 1], ['Resume or email click', 'ctaRate', pct, 1]];
  const sessionCols = [['Sessions', (r) => num(r.sessions)], ['Avg. length', (r) => dur(r.avgMs)], ['Engaged', (r) => pct(r.engagedRate)], ['Bounce', (r) => pct(r.bounceRate)]];
  const EVENT_NAMES = { link_click: 'Link', ui_click: 'Button' }; // optional friendly names:  { signup_click: 'Sign-up clicks' }
  const VITAL = { perf_ttfb: 'Time to first byte', perf_fcp: 'First contentful paint', perf_lcp: 'Largest contentful paint', perf_inp: 'Interaction to next paint', perf_cls: 'Layout shift (x1000)' };

  // ---- The views. Edit this list to add project-specific panels (see SKILL.md "Project-specific views"). ----
  const VIEWS = [
    { id: 'overview', title: 'Overview', widgets: [
      { type: 'kpis', items: (s) => [['Page views', num(s.totals.pageviews), 'First-party aggregate'], ['Visitors', num(s.totals.visitors), `${num(s.totals.newVisitors)} new · ${num(s.totals.returningVisitors)} returning`],
        ['Sessions', num(s.totals.sessions), `${num(s.totals.pagesPerSession, 1)} pages per session`], ['Engaged rate', pct(s.totals.engagedRate), '10 s on site, or 2+ pages']] },
      { type: 'trend', title: 'Daily attention', sub: 'Page views per day.', series: (s) => [{ name: 'Page views', values: s.series.map((d) => d.pageviews) }], days: (s) => s.series.map((d) => d.day), wide: true },
      { type: 'rank', title: 'Where visitors come from', sub: 'First-touch channel of each session.', rows: (s) => s.channels },
      { type: 'rank', title: 'Top pages', sub: 'Paths are aggregated, not tied to visitors.', rows: (s) => s.pages.slice(0, 8) },
    ] },
    { id: 'pages', title: 'Pages', widgets: [
      { type: 'kpis', items: (s) => { const t = s.pageStats.filter((p) => p.avgTimeMs !== null).sort((a, b) => b.avgTimeMs - a.avgTimeMs)[0]; return [['Pages seen', num(s.pageStats.length)], ['Most viewed', s.pageStats[0] ? s.pageStats[0].path : '—', s.pageStats[0] ? `${num(s.pageStats[0].views)} views` : ''],
        ['Longest read', t ? t.path : '—', t ? `${dur(t.avgTimeMs)} average` : '']]; } },
      { type: 'table', title: 'Every page', sub: 'Time is active time with the tab in view. Scroll is the average deepest point reached. Clicked = sessions that clicked any link or button on the page.', wide: true, first: 'Page', rows: (s) => s.pageStats.map((p) => ({ ...p, label: p.path })),
        cols: [['Views', (r) => num(r.views)], ['Visitors', (r) => num(r.visitors)], ['Avg. time', (r) => dur(r.avgTimeMs)], ['Median time', (r) => dur(r.medianTimeMs)], ['Avg. scroll', (r) => (r.avgScroll === null ? '—' : `${r.avgScroll}%`)], ['Read to 75%', (r) => pct(r.reached75)], ['Clicked', (r) => pct(r.clickRate)], ['Played video', (r) => pct(r.videoRate)]] },
      { type: 'rank', title: 'Top pages', sub: 'Page views.', rows: (s) => s.pages.slice(0, 12) },
    ] },
    { id: 'clicks', title: 'Clicks', widgets: [
      { type: 'table', title: 'Clicks by page', sub: 'Where on the site people clicked, and where it took them. Links are labelled by destination (page, download, email or outside site); buttons by their tracking name.', wide: true, first: 'Page → target', rows: (s) => s.clicks.map((c) => ({ ...c, label: `${c.path}  →  ${c.label}` })),
        cols: [['Type', (r) => r.kind], ['Clicks', (r) => num(r.n)], ['Sessions', (r) => num(r.sessions)]] },
    ] },
    { id: 'videos', title: 'Videos', widgets: [
      { type: 'table', title: 'Video watching', sub: 'Watch time counts only real playback (skipping ahead does not count). Finished = watched at least 95%.', wide: true, first: 'Video', rows: (s) => s.videos,
        cols: [['Page', (r) => r.page || '—'], ['Sessions that played', (r) => num(r.playedSessions)], ['Play rate', (r) => pct(r.playRate)], ['Avg. watched', (r) => (r.avgWatchedSec === null ? '—' : `${r.avgWatchedSec} s`)], ['Reached 50%', (r) => pct(r.reached50)], ['Finished', (r) => pct(r.finished)]] },
    ] },
    { id: 'website', title: 'Website & SEO', widgets: [
      { type: 'kpis', items: (s) => [['Visitors', num(s.totals.visitors)], ['New visitors', num(s.totals.newVisitors)], ['Dark social', num(s.darkSocial), 'Direct sessions landing on a deep page'], ['Languages', num(s.languages.length)]] },
      { type: 'trend', title: 'Unique visitors', sub: 'Daily unique visitors (random ids, no cookies).', series: (s) => [{ name: 'Visitors', values: s.series.map((d) => d.visitors) }], days: (s) => s.series.map((d) => d.day) },
      { type: 'trend', title: 'Sessions', sub: 'Daily sessions.', series: (s) => [{ name: 'Sessions', values: s.series.map((d) => d.sessions) }], days: (s) => s.series.map((d) => d.day) },
      { type: 'rank', title: 'Referrers', sub: 'Referrer hosts; direct traffic is a channel on Overview.', rows: (s) => s.referrers },
      { type: 'rank', title: 'Campaigns (UTM)', sub: 'utm_campaign, or utm_source when no campaign.', rows: (s) => s.campaigns },
      { type: 'table', title: 'Landing pages', sub: 'Where sessions start.', wide: true, first: 'Landing page', rows: (s) => s.landings, cols: sessionCols },
      { type: 'table', title: 'Devices', first: 'Device', rows: (s) => s.devices, cols: sessionCols },
      { type: 'rank', title: 'Languages', rows: (s) => s.languages },
      { type: 'heat', title: 'When people visit', sub: 'Weekday by hour, UTC.', wide: true },
    ] },
    { id: 'signals', title: 'Speed & errors', widgets: [
      { type: 'kpis', items: (s) => [['Script errors', num(s.totals.errors)]] },
      { type: 'table', title: 'Core Web Vitals by URL', sub: 'p75 from real visitors. Good = LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1.', wide: true, first: 'URL', rows: (s) => s.vitals.map((v) => ({ ...v, label: v.path })),
        cols: [['Samples', (r) => num(r.n)], ['LCP p75', (r) => `${num(r.lcpMs)} ms`], ['INP p75', (r) => `${num(r.inpMs)} ms`], ['CLS p75', (r) => num((r.clsX1000 ?? 0) / 1000, 3)], ['Verdict', (r) => r.verdict]] },
      { type: 'table', title: 'Timings', first: 'Metric', rows: (s) => s.performance.map((p) => ({ ...p, label: VITAL[p.metric] })), cols: [['Samples', (r) => num(r.n)], ['p50', (r) => num(r.p50)], ['p75', (r) => num(r.p75)], ['p95', (r) => num(r.p95)]] },
      { type: 'rank', title: 'Errors by message', rows: (s) => s.errorsByMessage },
    ] },
    { id: 'engagement', title: 'Engagement', widgets: [
      { type: 'kpis', items: (s) => [['Engaged rate', pct(s.totals.engagedRate)], ['Bounce rate', pct(s.totals.bounceRate)], ['Avg. engagement', dur(s.totals.avgEngagementMs)], ['Pages / session', num(s.totals.pagesPerSession, 1)]] },
      { type: 'table', title: 'Engagement by channel', wide: true, first: 'Channel', rows: (s) => s.channelEngagement, cols: sessionCols },
      { type: 'table', title: 'Feature adoption', sub: 'Tracked interactions (data-track clicks and your own events), ranked by volume.', wide: true, first: 'Signal', rows: (s) => s.features.map((f) => ({ ...f, label: `${EVENT_NAMES[f.name] || f.name}${f.label ? ` · ${f.label}` : ''}` })),
        cols: [['Events', (r) => num(r.events)], ['Sessions', (r) => num(r.sessions)], ['Share of sessions', (r) => pct(r.share)]] },
      { type: 'rank', title: 'Session depth', sub: 'Pages viewed per session.', rows: (s) => s.depth },
    ] },
    { id: 'funnel', title: 'Funnel & health', widgets: [
      { type: 'funnel', title: 'Activation path', sub: 'Unique sessions at each step. Configure steps in the collector (funnel option).', wide: true },
      { type: 'kpis', items: (s) => [['Daily active', num(s.stickiness.dau)], ['Monthly active', num(s.stickiness.mau)], ['Stickiness', pct(s.stickiness.ratio), 'Daily ÷ monthly active']] },
      { type: 'cohort', title: 'Weekly retention', sub: 'Share of each first-seen-week cohort that came back, by weeks since first visit.', wide: true },
    ] },
    { id: 'ab', title: 'Style test', widgets: [
      { type: 'kpis', items: (s) => s.variants.map((v) => [`${THEME_NAMES[v.theme] || v.theme} sessions`, num(v.sessions), `${num(v.visitors)} visitors`]) },
      { type: 'compare', title: 'Side by side', sub: 'Each session counts toward the style its first page was shown in. The better value is highlighted once both styles have 30+ sessions; below that, differences are mostly noise.', wide: true },
      { type: 'pagecompare', title: 'Average time on each page', sub: 'Active time with the tab in view, per page and style. Delta is Meadow vs Compute.', wide: true },
    ] },
    { id: 'links', title: 'Referral links', widgets: [
      { type: 'generator', title: 'Referral link generator', sub: 'Tag a link so the dashboard can show which placement and campaign sent each visit.', wide: true },
      { type: 'rank', title: 'Campaign · placement', sub: 'Sessions that arrived through a tagged link in this period.', rows: (s) => s.links },
      { type: 'rank', title: 'Campaigns', sub: 'utm_campaign (or utm_source when no campaign).', rows: (s) => s.campaigns },
      { type: 'table', title: 'Pages seen by campaign', sub: 'What visitors from each tagged link (LinkedIn, Handshake, a cross-promo) actually looked at.', wide: true, first: 'Campaign → page', rows: (s) => s.campaignPages.map((c) => ({ ...c, label: `${c.campaign}  →  ${c.path}` })),
        cols: [['Page views', (r) => num(r.n)], ['Sessions', (r) => num(r.sessions)]] },
    ] },
  ];

  const DAYS = 30; // fixed reporting window
  const tabGet = () => { try { return sessionStorage.getItem('admin_view'); } catch { return null; } };
  let data = null, current = tabGet() || 'overview', exportRows = [];

  const panel = (w, title, sub) => { const p = el('article', `panel${w.wide ? ' wide' : ''}`); if (title) { const h = el('div', 'panel-head'); h.append(el('h3', '', title)); if (sub) h.append(el('p', '', sub)); p.append(h); } return p; };
  const empty = (p, text = 'No data in this period yet.') => p.append(el('p', 'empty', text));

  const draw = {
    kpis(w) { const items = w.items(data); if (!items.length) return null; const box = el('section', 'metrics'); for (const [label, value, sub] of items) { const a = el('article', 'metric'); a.append(el('p', '', label), el('strong', '', value), el('span', '', sub || '')); box.append(a); exportRows.push([label, value]); } return box; },
    trend(w) {
      const p = panel(w, w.title, w.sub), series = w.series(data), values = series[0].values, labels = w.days(data), max = Math.max(1, ...values);
      if (!values.some(Boolean)) { empty(p); return p; }
      const W = 600, H = 190, L = 38, B = 26, T = 10, x = (i) => L + (values.length > 1 ? (i / (values.length - 1)) * (W - L - 8) : 0), y = (v) => T + (1 - v / max) * (H - T - B);
      const ns = 'http://www.w3.org/2000/svg', node = (n, a = {}, text) => { const e = document.createElementNS(ns, n); for (const k in a) e.setAttribute(k, a[k]); if (text !== undefined) e.textContent = text; return e; };
      const svg = node('svg', { class: 'line', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${w.title}: ${values.join(', ')}` });
      for (const f of [0, 0.5, 1]) { const gy = y(max * f); svg.append(node('line', { class: 'grid', x1: L, x2: W - 8, y1: gy, y2: gy }), node('text', { class: 'tick', x: L - 6, y: gy + 4, 'text-anchor': 'end' }, num(max * f))); }
      const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
      svg.append(node('polygon', { class: 'area', points: `${x(0)},${y(0)} ${pts} ${x(values.length - 1)},${y(0)}` }), node('polyline', { class: 'path', points: pts }));
      svg.append(node('text', { class: 'tick', x: L, y: H - 6 }, labels[0]), node('text', { class: 'tick', x: W - 8, y: H - 6, 'text-anchor': 'end' }, labels[labels.length - 1]));
      values.forEach((v, i) => { if (v) { const c = node('circle', { cx: x(i), cy: y(v), r: 3.5 }); c.append(node('title', {}, `${labels[i]}: ${num(v)}`)); svg.append(c); } });
      p.append(svg); labels.forEach((d, i) => exportRows.push([`${w.title} ${d}`, values[i]])); return p;
    },
    rank(w) {
      const p = panel(w, w.title, w.sub), rows = w.rows(data); if (!rows.length) { empty(p); return p; }
      const max = Math.max(1, ...rows.map((r) => r.n)), list = el('div', 'rank-list');
      for (const r of rows) { const row = el('div', 'rank-row'); row.style.setProperty('--share', `${(r.n / max) * 100}%`); row.append(el('span', '', r.label), el('b', '', num(r.n))); list.append(row); exportRows.push([`${w.title} · ${r.label}`, r.n]); }
      p.append(list); return p;
    },
    funnel(w) {
      const p = panel(w, w.title, w.sub), steps = data.funnel, top = Math.max(1, steps[0].n), list = el('ol', 'funnel');
      for (const s of steps) { const li = el('li'), row = el('div', 'row'); row.append(el('span', '', s.label), el('b', '', `${num(s.n)} · ${pct(s.n / top)}`)); const tr = el('div', 'track'), f = el('div', 'fill'); f.style.setProperty('--w', `${(s.n / top) * 100}%`); tr.append(f); li.append(row, tr); list.append(li); exportRows.push([`Funnel · ${s.label}`, s.n]); }
      p.append(list); return p;
    },
    table(w) {
      const p = panel(w, w.title, w.sub), rows = w.rows(data); if (!rows.length) { empty(p); return p; }
      const wrap = el('div', 'table-wrap'), t = el('table'), head = el('tr'); head.append(el('th', '', w.first)); w.cols.forEach(([h]) => head.append(el('th', '', h))); const thead = el('thead'); thead.append(head); t.append(thead);
      const body = el('tbody'); for (const r of rows) { const tr = el('tr'); const th = el('th', '', r.label); th.scope = 'row'; tr.append(th); w.cols.forEach(([, f]) => tr.append(el('td', '', String(f(r))))); body.append(tr); exportRows.push([`${w.title} · ${r.label}`, w.cols.map(([h, f]) => `${h}: ${f(r)}`).join('; ')]); }
      t.append(body); wrap.append(t); p.append(wrap); return p;
    },
    heat(w) {
      const p = panel(w, w.title, w.sub), max = Math.max(1, ...data.heat.flat()); if (!data.heat.flat().some(Boolean)) { empty(p); return p; }
      const g = el('div', 'heat'); g.append(el('span'));
      for (let h = 0; h < 24; h++) g.append(el('span', '', h % 6 === 0 ? String(h) : ''));
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((d, i) => { g.append(el('span', '', d)); data.heat[i].forEach((v, h) => { const c = el('b'); c.style.setProperty('--v', v / max); c.title = `${d} ${h}:00 UTC: ${v}`; g.append(c); }); });
      p.append(g); return p;
    },
    cohort(w) {
      const p = panel(w, w.title, w.sub), rows = data.retention.filter((r) => r.size); if (!rows.length) { empty(p, 'Cohorts appear once visitors have a week of history.'); return p; }
      const t = el('table', 'cohort'), head = el('tr'); ['Cohort week', 'Visitors', ...rows[0].retained.map((_, i) => `Wk ${i}`)].forEach((h) => head.append(el('th', '', h))); const thead = el('thead'); thead.append(head); t.append(thead);
      const body = el('tbody'); for (const r of rows) { const tr = el('tr'); tr.append(el('th', '', r.week), el('td', '', num(r.size))); r.retained.forEach((v) => { const td = el('td', 'cell', pct(v)); td.style.setProperty('--v', v || 0); tr.append(td); }); body.append(tr); exportRows.push([`Cohort ${r.week}`, `${r.size} visitors; ${r.retained.map(pct).join(' ')}`]); }
      t.append(body); const wrap = el('div', 'table-wrap'); wrap.append(t); p.append(wrap); return p;
    },
    compare(w) {
      const p = panel(w, w.title, w.sub), vs = data.variants.filter((v) => ['control', 'meadow'].includes(v.theme)); if (!vs.some((v) => v.sessions)) { empty(p, 'No sessions yet. Visit the site with ?theme=meadow and without to generate some.'); return p; }
      const ready = vs.every((v) => v.sessions >= 30), wrap = el('div', 'table-wrap'), t = el('table'), head = el('tr'), thead = el('thead'), body = el('tbody');
      head.append(el('th', '', 'Metric')); vs.forEach((v) => head.append(el('th', '', THEME_NAMES[v.theme] || v.theme))); thead.append(head); t.append(thead);
      for (const [label, key, fmt, dir] of AB_ROWS) {
        const tr = el('tr'), vals = vs.map((v) => v[key]), ok = vals.filter((x) => x !== null), best = dir && ready && ok.length > 1 && new Set(ok).size > 1 ? (dir > 0 ? Math.max(...ok) : Math.min(...ok)) : null;
        const th = el('th', '', label); th.scope = 'row'; tr.append(th);
        vals.forEach((x) => tr.append(el('td', x !== null && x === best ? 'win' : '', fmt(x)))); body.append(tr); exportRows.push([`A/B · ${label}`, vs.map((v, i) => `${THEME_NAMES[v.theme] || v.theme}: ${fmt(vals[i])}`).join('; ')]);
      }
      t.append(body); wrap.append(t); p.append(wrap); if (!ready) p.append(el('p', 'empty', 'Low sample: a style has fewer than 30 sessions, so no winner is called yet.')); return p;
    },
    pagecompare(w) {
      const p = panel(w, w.title, w.sub), rows = data.variantPages; if (!rows.length) { empty(p); return p; }
      const wrap = el('div', 'table-wrap'), t = el('table'), head = el('tr'), thead = el('thead'), body = el('tbody');
      ['Page', 'Compute time', 'Compute views', 'Meadow time', 'Meadow views', 'Delta'].forEach((h) => head.append(el('th', '', h))); thead.append(head); t.append(thead);
      for (const r of rows) {
        const a = r.byTheme.control || {}, b = r.byTheme.meadow || {}, d = a.avgTimeMs !== null && b.avgTimeMs !== null && a.avgTimeMs ? (b.avgTimeMs - a.avgTimeMs) / a.avgTimeMs : null, tr = el('tr'), th = el('th', '', r.path); th.scope = 'row';
        tr.append(th, el('td', '', dur(a.avgTimeMs)), el('td', '', num(a.views)), el('td', '', dur(b.avgTimeMs)), el('td', '', num(b.views)), el('td', d === null ? '' : d > 0 ? 'win' : 'lose', d === null ? '—' : `${d > 0 ? '+' : ''}${Math.round(d * 100)}%`));
        body.append(tr); exportRows.push([`A/B page · ${r.path}`, `Compute ${dur(a.avgTimeMs)} (${a.views}); Meadow ${dur(b.avgTimeMs)} (${b.views})`]);
      }
      t.append(body); wrap.append(t); p.append(wrap); return p;
    },
    generator(w) {
      const p = panel(w, w.title, w.sub), form = el('form', 'gen'), mk = (id, label, hint) => { const l = el('label'); l.append(el('span', '', label)); const i = el('input'); i.id = id; i.required = true; i.maxLength = 60; i.placeholder = hint; i.autocomplete = 'off'; l.append(i); form.append(l); return i; };
      const where = mk('gen-where', 'Where will this link be placed?', 'e.g. instagram bio, spring newsletter, flyer qr');
      const campaign = mk('gen-campaign', 'Which campaign is it part of?', 'e.g. spring launch');
      const more = el('details', 'gen-more'); more.append(el('summary', '', 'Link to a page other than the home page'));
      const path = el('input'); path.id = 'gen-path'; path.placeholder = '/pricing'; path.autocomplete = 'off'; more.append(path); form.append(more);
      const go = el('button', 'btn primary', 'Create link'); go.type = 'submit'; form.append(go);
      const out = el('div', 'gen-out'), history = el('div', 'rank-list gen-history');
      const slug = (v) => v.toLowerCase().trim().replace(/[\s.]+/g, '-').replace(/[^a-z0-9_-]/g, '').replace(/-+/g, '-').slice(0, 40);
      const saved = () => { try { return JSON.parse(localStorage.getItem('admin_links') || '[]'); } catch { return []; } };
      const copy = async (url, btn) => { try { await navigator.clipboard.writeText(url); btn.textContent = 'Copied'; } catch { btn.textContent = 'Press Ctrl+C'; } setTimeout(() => (btn.textContent = 'Copy'), 1600); };
      const row = (r) => { const d = el('div', 'gen-row'); d.append(el('code', '', r.url)); const b = el('button', 'btn quiet', 'Copy'); b.type = 'button'; b.addEventListener('click', () => copy(r.url, b)); d.append(b); return d; };
      const paint = () => { history.replaceChildren(...saved().map(row)); };
      form.addEventListener('submit', (e) => {
        e.preventDefault(); const src = slug(where.value), camp = slug(campaign.value);
        if (!src || !camp) { out.replaceChildren(el('p', 'form-note error', 'Use letters or numbers in both fields.')); return; }
        let target = (path.value.trim() || '/'); if (!target.startsWith('/')) target = '/' + target;
        const u = new URL(target, location.origin); u.search = ''; u.hash = '';
        u.searchParams.set('utm_source', src); u.searchParams.set('utm_medium', 'referral'); u.searchParams.set('utm_campaign', camp);
        const r = { url: u.toString(), at: Date.now() }; out.replaceChildren(row(r));
        try { localStorage.setItem('admin_links', JSON.stringify([r, ...saved().filter((x) => x.url !== r.url)].slice(0, 10))); } catch {} paint();
      });
      p.append(form, out); if (saved().length) { p.append(el('h4', 'gen-title', 'Recent links')); p.append(history); paint(); }
      return p;
    },
  };

  function render() {
    const view = VIEWS.find((v) => v.id === current) || VIEWS[0]; current = view.id; exportRows = [];
    try { sessionStorage.setItem('admin_view', current); } catch {}
    $('dashboard-title').textContent = view.title;
    $('updated-at').textContent = data ? `Live · updated ${new Date(data.generatedAt).toLocaleTimeString()}` : 'Loading…';
    document.querySelectorAll('#admin-navigation button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view.id)));
    const root = $('view'); root.replaceChildren(); if (!data) return;
    let grid = null;
    for (const w of view.widgets) {
      const node = draw[w.type](w); if (!node) continue;
      if (w.type === 'kpis' || w.type === 'note') { grid = null; root.append(node); continue; }
      if (!grid) { grid = el('section', 'analysis-grid'); root.append(grid); }
      grid.append(node);
    }
  }

  async function load() {
    const err = $('load-error'); err.hidden = true;
    const res = await fetch(`${API}?days=${DAYS}`, { headers: { Authorization: `Bearer ${token.get()}` }, cache: 'no-store' });
    if (res.status === 401 || res.status === 503) { const e = new Error((await res.json().catch(() => ({}))).error || 'Unauthorized'); e.auth = true; throw e; }
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    data = await res.json(); render();
  }
  const showGate = (open) => { $('unlock-panel').hidden = open; $('dashboard').hidden = !open; };
  async function open() {
    try { showGate(true); await load(); }
    catch (e) {
      if (e.auth) { token.set(''); data = null; showGate(false); const n = $('unlock-note'); n.textContent = e.message; n.classList.add('error'); }
      else { const err = $('load-error'); err.textContent = e.message; err.hidden = false; }
    }
  }

  const nav = $('admin-navigation');
  for (const v of VIEWS) { const b = el('button', '', v.title); b.type = 'button'; b.dataset.view = v.id; b.addEventListener('click', () => { current = v.id; render(); }); nav.append(b); }
  $('unlock-form').addEventListener('submit', (e) => { e.preventDefault(); token.set($('admin-token').value.trim()); $('unlock-note').classList.remove('error'); $('unlock-note').textContent = 'Checking…'; open(); });
  $('refresh').addEventListener('click', () => load().catch((e) => { const err = $('load-error'); err.textContent = e.message; err.hidden = false; }));
  $('export').addEventListener('click', () => {
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`, csv = [['Metric', 'Value'], ...exportRows].map((r) => r.map(q).join(',')).join('\n');
    const a = el('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `${current}-${DAYS}d.csv`; a.click(); URL.revokeObjectURL(a.href);
  });
  if (token.get()) open();
})();
