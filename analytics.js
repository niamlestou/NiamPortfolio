/*! First-party analytics beacon. Cookieless: random ids in storage, no IP, no fingerprint, no copied text or form input.
 *  Honors Do Not Track and Global Privacy Control (sends nothing). Skips /admin pages.
 *  Include on every page:  <script src="/analytics.js" defer data-endpoint="/api/track"></script>
 *  Custom event:           window.track('signup_click', 'hero')     or   <button data-track="hero-cta">
 */
(() => {
  const script = document.currentScript;
  const ENDPOINT = (script && script.dataset.endpoint) || '/api/track';
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl) return;
  if (/^\/admin/.test(location.pathname)) return;

  const store = (area, key) => {
    try { const s = window[area]; return s.getItem(key) || (s.setItem(key, crypto.randomUUID()), s.getItem(key)); } catch { return crypto.randomUUID(); }
  };
  const vid = store('localStorage', 'fp_vid'), sid = store('sessionStorage', 'fp_sid');
  const send = (body) => {
    const data = JSON.stringify({ vid, sid, theme: document.documentElement.dataset.theme || 'control', ...body }); // theme = visual style under A/B test
    if (!(navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([data], { type: 'text/plain' })))) fetch(ENDPOINT, { method: 'POST', body: data, keepalive: true }).catch(() => {});
  };
  const clean = (s) => String(s ?? '').replace(/[^\w .:/#-]/g, '').slice(0, 60);

  let sent = 0, last = '';
  const here = () => (last || location.pathname || '/').slice(0, 120); // the page an event belongs to
  window.track = (name, label = '', value = null) => {
    if (sent++ >= 120) return; // per page load
    send({ type: 'event', path: here(), name, label: clean(label), value: Number.isFinite(value) ? Math.max(0, Math.min(1e7, Math.round(value))) : null });
  };

  const refOrigin = () => { try { return document.referrer ? new URL(document.referrer).origin : ''; } catch { return ''; } };
  const params = new URLSearchParams(location.search);
  const slug = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  const utm = slug(params.get('utm_campaign') || params.get('utm_source')), src = slug(params.get('utm_source')); // campaign label + placement (where the link lives)
  const external = refOrigin() && refOrigin() !== location.origin ? refOrigin() : '';
  const ref = external;

  const started = performance.now();
  let first = true;
  const pageview = () => {
    const path = (location.pathname || '/').slice(0, 120);
    if (path === last) return;
    last = path;
    const nav = performance.getEntriesByType('navigation')[0];
    send({ type: 'pageview', path, ref: first ? ref : '', utm: first ? utm : '', src: first ? src : '', w: Math.round(innerWidth), lang: navigator.language.slice(0, 20),
      loadMs: first && nav && nav.loadEventEnd > 0 ? Math.round(nav.loadEventEnd) : null });
    first = false;
  };
  const afterLoad = () => document.readyState === 'complete' ? pageview() : addEventListener('load', () => setTimeout(pageview), { once: true });
  afterLoad();
  for (const m of ['pushState', 'replaceState']) { const o = history[m]; history[m] = function () { const r = o.apply(this, arguments); setTimeout(pageview); return r; }; }
  addEventListener('popstate', pageview);
  let active = 0, shownAt = document.visibilityState === 'visible' ? performance.now() : null;
  const report = () => {
    if (shownAt !== null) { active += performance.now() - shownAt; shownAt = performance.now(); }
    send({ type: 'leave', path: here(), durationMs: Math.min(864e5, Math.round(active)) });
  };
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { report(); shownAt = null; } else shownAt = performance.now(); });
  addEventListener('pagehide', report);

  // Opt-in clicks: elements carrying data-track="slug". Nothing else about a click is read.
  document.addEventListener('click', (e) => {
    const tag = e.target.closest && e.target.closest('[data-track]');
    if (tag) window.track('ui_click', tag.getAttribute('data-track'));
    // Every link, labelled by where it goes (never its text): page path, download file, mailto/tel, or external host.
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    let u; try { u = new URL(a.href, location.href); } catch { return; }
    if (u.protocol === 'mailto:' || u.protocol === 'tel:') return window.track('link_click', u.protocol.slice(0, -1));
    if (u.origin !== location.origin) return window.track('link_click', 'out:' + u.hostname);
    if (u.pathname === location.pathname && u.hash) return; // in-page anchor
    window.track('link_click', a.hasAttribute('download') ? 'download:' + u.pathname.split('/').pop() : u.pathname);
  });

  // Scroll depth: the deepest 25/50/75/100% milestone reached on this page.
  const marks = new Set();
  const depth = () => {
    const h = document.documentElement.scrollHeight, pct = h <= innerHeight + 4 ? 100 : Math.min(100, ((scrollY + innerHeight) / h) * 100);
    for (const m of [25, 50, 75, 100]) if (pct >= m - 0.5 && !marks.has(m)) { marks.add(m); window.track('scroll_depth', here(), m); }
  };
  let ticking = false;
  addEventListener('scroll', () => { if (!ticking) { ticking = true; setTimeout(() => { ticking = false; depth(); }, 150); } }, { passive: true });
  addEventListener('load', () => setTimeout(depth, 300), { once: true });

  // Video: plays, how far people really watched (seeking does not count), and total seconds watched, per video file.
  const vids = new WeakMap();
  const vstate = (v) => {
    let st = vids.get(v);
    if (!st) { const f = (v.currentSrc || v.src || (v.querySelector('source') || {}).src || 'video').split('?')[0].split('/').pop().replace(/\.[^.]+$/, ''); vids.set(v, (st = { name: clean(f) || 'video', watched: 0, at: null, marks: new Set(), played: false, sent: 0 })); }
    return st;
  };
  const vflush = (v) => { const st = vstate(v), s = Math.round(st.watched); if (s > st.sent) { st.sent = s; window.track('video_watch', st.name, s); } };
  document.addEventListener('play', (e) => { if (e.target.tagName !== 'VIDEO') return; const st = vstate(e.target); st.at = e.target.currentTime; if (!st.played) { st.played = true; window.track('video_play', st.name); } }, true);
  document.addEventListener('timeupdate', (e) => {
    const v = e.target; if (v.tagName !== 'VIDEO') return; const st = vstate(v), d = v.currentTime - (st.at ?? v.currentTime);
    if (d > 0 && d < 1.5 && !v.paused) st.watched += d; st.at = v.currentTime;
    const p = v.duration > 0 ? (st.watched / v.duration) * 100 : 0;
    for (const m of [25, 50, 75, 95]) if (p >= m && !st.marks.has(m)) { st.marks.add(m); window.track('video_progress', st.name, m); }
  }, true);
  for (const ev of ['pause', 'ended']) document.addEventListener(ev, (e) => { if (e.target.tagName === 'VIDEO') vflush(e.target); }, true);
  const flushVideos = () => document.querySelectorAll('video').forEach((v) => { if (vids.has(v)) vflush(v); });
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushVideos(); });
  addEventListener('pagehide', flushVideos);

  // Failures (a few distinct messages per page load).
  const seen = new Set();
  const fail = (name, msg) => { const l = clean(msg); if (seen.size < 5 && !seen.has(l)) { seen.add(l); window.track(name, l); } };
  addEventListener('error', (e) => fail('client_error', e.message));
  addEventListener('unhandledrejection', (e) => fail('unhandled_rejection', (e.reason && e.reason.message) || e.reason));

  // Real-user performance, labelled with the page so vitals can be judged per URL.
  if ('PerformanceObserver' in window) {
    const v = { lcp: 0, cls: 0, inp: 0 };
    const watch = (type, read, extra) => { try { new PerformanceObserver((l) => l.getEntries().forEach(read)).observe({ type, buffered: true, ...extra }); } catch {} };
    watch('largest-contentful-paint', (e) => { v.lcp = e.startTime; });
    watch('layout-shift', (e) => { if (!e.hadRecentInput) v.cls += e.value; });
    watch('event', (e) => { if (e.interactionId) v.inp = Math.max(v.inp, e.duration); }, { durationThreshold: 40 }); // worst interaction approximates INP
    let done = false;
    const flush = () => {
      if (done) return; done = true;
      const nav = performance.getEntriesByType('navigation')[0], fcp = performance.getEntriesByName('first-contentful-paint')[0];
      if (nav && nav.responseStart > 0) window.track('perf_ttfb', last, nav.responseStart);
      if (fcp) window.track('perf_fcp', last, fcp.startTime);
      if (v.lcp) window.track('perf_lcp', last, v.lcp);
      window.track('perf_cls', last, v.cls * 1000);
      if (v.inp) window.track('perf_inp', last, v.inp);
    };
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    addEventListener('pagehide', flush);
  }
})();
