/* Meadow, "Growing Season": the markup and motion behind themes/meadow-extras.css.
 * Runs before the site's own deferred scripts (theme.js writes this tag into <head>), so motion.js reveals whatever is added here.
 * Adds: the pivot-sweep opening that hands the name off to the hero (home), a ticker, a live aerial field behind each hero, section kickers,
 * a Farmstead World lot, a quote and a scroll-pinned yield band (home), a supply-chain strip (Farmstead page), a seed-tag marquee,
 * a wheat line and closing line on the footer, and a scroll vine. Decorative pieces are aria-hidden. */
(function () {
  var doc = document.documentElement, still = matchMedia('(prefers-reduced-motion: reduce)').matches, hover = matchMedia('(hover: hover)').matches;
  var SVG = 'http://www.w3.org/2000/svg', $ = function (s, r) { return (r || document).querySelector(s); };
  var el = function (tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
  var clamp = function (v) { return Math.max(0, Math.min(1, v)); }, easeOut = function (v) { return 1 - Math.pow(1 - v, 3); };
  var seed = 7, rnd = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; // seeded so the farm is the same every visit
  var home = $('.hero--split'), onScroll = [];

  var old = document.getElementById('intro'); if (old) old.remove(); // Compute's binary rain; intro.js bails without it
  if (doc.classList.contains('m-intro') && !still) doc.classList.add('m-hold'); // hero waits for the opening to hand off

  // ---- ticker: the site's own figures, farm ones first, run like a market wire ----
  var header = $('.site-header');
  if (header) {
    var facts = ['Farmstead World: 13 active farms', '10,355 dozen eggs produced', '148 bushels of corn harvested', 'Phoenix, Arizona', 'Field data, grown into decisions',
      '4 projects built', '15 users across projects', 'Python / PostgreSQL / AWS / Power BI', 'Open to internships and full-time roles', 'Regime AUC 0.925, Tick Forward'];
    var t = el('div', 'm-ticker'), set = facts.map(function (f) { return '<span>' + f + '</span>'; }).join('');
    t.setAttribute('aria-hidden', 'true'); t.innerHTML = '<div>' + set + set + '</div>';
    header.after(t);
  }

  if (home) {
        var stats = $('.stats-grid'), statSec = stats && stats.closest('section');
    if (statSec) {

      // ---- yield band pins while its figures count up and their stalks grow with the scroll (motion.js leaves these alone) ----
      if (!still) {
        statSec.classList.add('m-pin');
        var figs = [].map.call(stats.querySelectorAll('.stat-card'), function (c) {
          var v = $('[data-count]', c); if (!v) return null;
          var f = { c: c, v: v, to: parseFloat(v.dataset.count), s: v.dataset.suffix || '', d: +v.dataset.decimals || 0, best: 0 };
          v.removeAttribute('data-count'); v.textContent = (0).toFixed(f.d) + f.s; return f;
        }).filter(Boolean);
        onScroll.push(function () {
          var r = statSec.getBoundingClientRect(), p = clamp((innerHeight * .5 - r.top) / (innerHeight * 1.05)); // 0 as the band rises past mid-screen, 1 just before the 60vh pin lets go
          statSec.style.setProperty('--yp', p.toFixed(3));
          figs.forEach(function (f, i) {
            var g = Math.max(f.best, easeOut(clamp((p - i * .1) / .5))); // only grows, so scrolling back up never un-counts
            if (g === f.best && f.best) return;
            f.best = g; f.v.textContent = (f.to * g).toFixed(f.d) + f.s; f.c.style.setProperty('--g', g.toFixed(3));
          });
        });
      }
    }

    // ---- Farmstead World joins the featured lots, first in line for this audience ----
    var flag = $('article.card.flagship');
    if (flag) {
      var farm = el('article', 'card m-farm',
        '<a class="m-farm-media" href="farmstead-world.html" tabindex="-1" aria-hidden="true"><img src="assets/poster-farmsteadworld.jpg" alt="" loading="lazy" decoding="async"></a>' +
        '<div><span class="badge">Food &amp; farm</span><p class="project-meta">Game &middot; Web app &middot; Supply chain</p>' +
        '<h3 class="project-title"><a href="farmstead-world.html">Farmstead World</a></h3>' +
        '<p class="project-description">A free-to-play farming game where you plant, harvest and discover your way through real crops, foods and farm concepts, built to replicate the actual supply chain that controls our food.</p>' +
        '<div class="tech-stack"><span class="tech-tag">Web app</span><span class="tech-tag">Free to play</span><span class="tech-tag">Supply chain</span></div>' +
        '<a class="case-link" href="farmstead-world.html">Read case study &nearr;</a></div>');
      flag.before(farm);
      onScroll.push(function () { var r = farm.getBoundingClientRect(); farm.style.setProperty('--fp', ((r.top + r.height / 2) / innerHeight - .5).toFixed(3)); });
    }

    // ---- core stack: two counter-running rows of seed tags (the first copy stays readable; the rest are aria-hidden) ----
    var stack = $('main > .section > .container > .tech-stack');
    if (stack && !still) {
      var tags = stack.innerHTML, rows = el('div', 'm-rows');
      stack.before(rows); rows.append(stack);
      stack.innerHTML = tags + '<span aria-hidden="true" style="display:contents">' + tags + tags + tags + '</span>';
      var back = el('div', 'tech-stack', tags + tags + tags + tags); back.setAttribute('aria-hidden', 'true');
      [].slice.call(back.children).reverse().forEach(function (c) { back.append(c); });
      rows.append(back);
    }
  }

  // ---- section kickers; on the home page the titles take the farm's voice and the kicker keeps the plain name ----
  var NAMES = { 'Impact at a Glance': 'This season’s yield', 'Featured Work': 'Lots from the field', 'Core Stack': 'Tools in the shed' };
  var k = 0;
  document.querySelectorAll('main > .section').forEach(function (sec) {
    var h = $('.section-header, .m-quote', sec); if (!h) return;
    var title = $('.section-title', h), was = title ? title.textContent.trim() : '', kick = el('p', 'm-kick');
    kick.setAttribute('aria-hidden', 'true');
    kick.innerHTML = '<b>' + String(++k).padStart(2, '0') + '</b>' + (h.dataset.kick || (home && NAMES[was] ? was : ''));
    if (home && NAMES[was]) title.textContent = NAMES[was];
    h.prepend(kick);

    // Farmstead page: the supply chain from "How It Works", drawn in as the section scrolls by
    if (was === 'How It Works') {
      var steps = ['Homestead', '10 chickens', 'Corn', 'Corn products', 'Ethanol & beauty products'];
      var chain = el('div', 'm-chain', steps.map(function (s) { return '<span>' + s.replace('&', '&amp;') + '</span>'; }).join(''));
      chain.setAttribute('aria-hidden', 'true'); $('.container', sec).append(chain);
      var links = [].slice.call(chain.children);
      onScroll.push(function () {
        var r = chain.getBoundingClientRect(), p = still ? 1 : clamp((innerHeight * .9 - r.top) / (innerHeight * .55));
        chain.style.setProperty('--cp', p.toFixed(3));
        links.forEach(function (s, i) { s.classList.toggle('lit', p >= i / (links.length - 1) - .02); });
      });
    }
  });

  // ---- projects as traceable lots: lot number, origin, and a source > process > decision strip ----
  var n = 0;
  document.querySelectorAll('article.card.flagship, article.card.work-secondary, article.card.project-card, article.card.m-farm').forEach(function (card) {
    var meta = $('.project-meta', card); if (!meta) return;
    var lot = el('div', 'lot', '<span>Lot ' + String(++n).padStart(2, '0') + '</span><span>Origin: ' + meta.textContent.trim().replace(/[<>&]/g, '') + '</span>');
    meta.replaceWith(lot);
    var flow = el('div', 'flow', '<span>Source</span><span>Process</span><b>Decision</b>'); flow.setAttribute('aria-hidden', 'true');
    var anchor = $('.tech-stack', card) || $('.project-description', card);
    if (anchor) anchor.after(flow);
  });

  // ---- live aerial field behind the hero: parcels, center pivots, a satellite pass that reads NDVI, and a cursor probe ----
  var hero = $('main .hero');
  if (hero) (function () {
    var cv = el('canvas', 'm-field'), base = document.createElement('canvas'), ctx = cv.getContext('2d'), b = base.getContext('2d');
    cv.setAttribute('aria-hidden', 'true'); hero.prepend(cv);
    var probe = el('div', 'm-probe', '<span></span>'); probe.setAttribute('aria-hidden', 'true'); hero.append(probe);
    if (home) { var hint = el('div', 'm-scroll', 'Scroll'); hint.setAttribute('aria-hidden', 'true'); hero.append(hint); }
    // name, field colour, row colour, typical NDVI
    var CROPS = [['Alfalfa', '#86A257', '#728F4A', .78], ['Durum wheat', '#D9BC6E', '#C6A658', .55], ['Lettuce', '#A9C470', '#91AE5B', .72], ['Cotton', '#E4DAC4', '#D1C3A5', .46],
      ['Fallow', '#CDB893', '#BCA37D', .1], ['Sorghum', '#BE9358', '#AA7F46', .4], ['Citrus', '#6E8F4B', '#5D7C3E', .81], ['Onion', '#9DB56B', '#88A05A', .64]];
    var W = 0, H = 0, dpr = Math.min(devicePixelRatio || 1, 2), parcels = [], pivots = [], ptr = null, pp = null, running = false, visible = true;
    var ramp = function (v) { return v < .2 ? '#B5532E' : v < .4 ? '#D99A3A' : v < .6 ? '#E3CF62' : v < .75 ? '#9CC064' : '#3F7A33'; };

    function cut(x, y, w, h, d) {
      if (d > 5 || w < 110 || h < 90 || (w < 280 && h < 210 && rnd() < .55)) {
        var c = CROPS[Math.floor(rnd() * CROPS.length)];
        parcels.push({ x: x, y: y, w: w, h: h, c: c, ang: (rnd() < .5 ? 0 : Math.PI / 2) + (rnd() - .5) * .12, v: clamp(c[3] + (rnd() - .5) * .16), seen: -1e9 });
        return;
      }
      var vert = w / h > 1.25 || (w / h > .8 && rnd() < .5), f = .32 + rnd() * .36, g = 4;
      if (vert) { var a = w * f; cut(x, y, a - g, h, d + 1); cut(x + a + g, y, w - a - g, h, d + 1); }
      else { var e = h * f; cut(x, y, w, e - g, d + 1); cut(x, y + e + g, w, h - e - g, d + 1); }
    }
    function build() {
      W = hero.clientWidth; H = hero.clientHeight; if (!W || !H) return;
      [cv, base].forEach(function (c) { c.width = W * dpr; c.height = H * dpr; });
      seed = 7; parcels = []; pivots = [];
      cut(-30, -30, W + 60, H + 60, 0);
      var pr = Math.max(64, Math.min(W * .16, H * .28));
      (home && W > 900 ? [[.86, .22, 1], [.93, .8, .74], [.62, .86, .7]] : [[.1, .55, .8], [.9, .4, .9]]).forEach(function (s, i) {
        pivots.push({ x: s[0] * W, y: s[1] * H, r: pr * s[2], a: rnd() * 6.28, v: (i % 2 ? -1 : 1) * (.00022 + rnd() * .0001) });
      });
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      b.fillStyle = '#E6DBC2'; b.fillRect(0, 0, W, H); // farm roads show between parcels
      parcels.forEach(function (p) {
        b.save(); b.beginPath(); b.rect(p.x, p.y, p.w, p.h); b.clip();
        b.fillStyle = p.c[1]; b.fillRect(p.x, p.y, p.w, p.h);
        var g = b.createRadialGradient(p.x + p.w * rnd(), p.y + p.h * rnd(), 0, p.x + p.w / 2, p.y + p.h / 2, Math.max(p.w, p.h));
        g.addColorStop(0, 'rgba(255,252,235,.22)'); g.addColorStop(1, 'rgba(70,45,15,.12)');
        b.fillStyle = g; b.fillRect(p.x, p.y, p.w, p.h);
        b.translate(p.x + p.w / 2, p.y + p.h / 2); b.rotate(p.ang);
        var L = Math.hypot(p.w, p.h) / 2 + 4; b.strokeStyle = p.c[2]; b.lineWidth = 1.4; b.beginPath();
        for (var i = -L; i < L; i += 5) { b.moveTo(-L, i); b.lineTo(L, i); }
        b.stroke(); b.restore();
      });
      // an irrigation canal through the left of the frame
      b.beginPath(); b.moveTo(W * .08, -20); b.bezierCurveTo(W * .3, H * .3, W * .12, H * .7, W * .42, H + 20);
      b.lineCap = 'round'; b.strokeStyle = '#E6DBC2'; b.lineWidth = 18; b.stroke(); b.strokeStyle = '#7FA4AA'; b.lineWidth = 7; b.stroke();
      b.strokeStyle = 'rgba(255,255,255,.35)'; b.lineWidth = 1.5; b.stroke();
      pivots.forEach(function (q) {
        b.beginPath(); b.arc(q.x, q.y, q.r + 7, 0, 6.2832); b.fillStyle = '#D6C49E'; b.fill();
        b.beginPath(); b.arc(q.x, q.y, q.r, 0, 6.2832); b.fillStyle = '#93B05C'; b.fill();
        b.strokeStyle = 'rgba(66,96,42,.45)'; b.lineWidth = 1.2;
        for (var r = 7; r < q.r; r += 5) { b.beginPath(); b.arc(q.x, q.y, r, 0, 6.2832); b.stroke(); }
      });
      frame(still ? 0 : performance.now());
    }
    function label(x, y, s) {
      ctx.font = '600 10px "JetBrains Mono", ui-monospace, monospace'; s = s.toUpperCase();
      var w = ctx.measureText(s).width + 16;
      ctx.fillStyle = 'rgba(251,248,241,.92)'; ctx.fillRect(x, y, w, 21); ctx.fillStyle = '#E2B85A'; ctx.fillRect(x, y + 19, w, 2);
      ctx.fillStyle = '#1E1811'; ctx.fillText(s, x + 8, y + 14);
    }
    function frame(t) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(base, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // satellite pass every 10s: parcels flash their NDVI as the band crosses, then fade back
      var u = still ? 2 : (t % 10000) / 4600, sx = -100 + u * (W + 200), labelFrom = home ? W * .55 : 0;
      parcels.forEach(function (p) {
        if (u <= 1 && sx > p.x + p.w / 2 && t - p.seen > 6000) p.seen = t;
        var age = t - p.seen; if (age > 5600) return;
        var a = 1 - age / 5600;
        ctx.globalAlpha = .6 * a; ctx.fillStyle = ramp(p.v); ctx.fillRect(p.x, p.y, p.w, p.h);
        if (p.w > 150 && p.h > 80 && p.x > -10 && p.y > -10 && p.x + p.w / 2 > labelFrom) { ctx.globalAlpha = clamp(a * 1.8); label(p.x + 12, p.y + 12, p.c[0] + ' · NDVI ' + p.v.toFixed(2)); }
        ctx.globalAlpha = 1;
      });
      if (u <= 1) {
        var g = ctx.createLinearGradient(sx - 140, 0, sx, 0);
        g.addColorStop(0, 'rgba(255,250,232,0)'); g.addColorStop(1, 'rgba(255,250,232,.45)');
        ctx.fillStyle = g; ctx.fillRect(sx - 140, 0, 140, H); ctx.fillStyle = 'rgba(255,255,245,.9)'; ctx.fillRect(sx, 0, 1.5, H);
      }
      // center pivots: a wet wake trails each arm as it turns
      pivots.forEach(function (q) {
        var a = q.a + t * q.v, wake = 1.7, dir = q.v > 0 ? 1 : -1;
        if (ctx.createConicGradient) {
          var cg = ctx.createConicGradient(dir > 0 ? a - wake : a, q.x, q.y), s = wake / 6.2832;
          if (dir > 0) { cg.addColorStop(0, 'rgba(40,70,28,0)'); cg.addColorStop(s, 'rgba(40,70,28,.38)'); cg.addColorStop(s + .001, 'rgba(40,70,28,0)'); }
          else { cg.addColorStop(0, 'rgba(40,70,28,.38)'); cg.addColorStop(s, 'rgba(40,70,28,0)'); }
          cg.addColorStop(1, 'rgba(40,70,28,0)');
          ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.2832); ctx.fillStyle = cg; ctx.fill();
        }
        var ex = q.x + Math.cos(a) * q.r, ey = q.y + Math.sin(a) * q.r;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(30,24,17,.22)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(q.x + 3, q.y + 3); ctx.lineTo(ex + 3, ey + 3); ctx.stroke();
        ctx.strokeStyle = '#F7F2E6'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(ex, ey); ctx.stroke();
        for (var i = 1; i <= 5; i++) {
          var tx = q.x + Math.cos(a) * q.r * i / 5.2, ty = q.y + Math.sin(a) * q.r * i / 5.2;
          ctx.fillStyle = '#F7F2E6'; ctx.beginPath(); ctx.arc(tx, ty, 2.6, 0, 6.2832); ctx.fill();
          if (!still) { ctx.fillStyle = 'rgba(225,240,245,.55)'; ctx.beginPath(); ctx.arc(tx + (Math.random() - .5) * 9, ty + (Math.random() - .5) * 9, 1.6, 0, 6.2832); ctx.fill(); }
        }
        ctx.fillStyle = '#1E1811'; ctx.beginPath(); ctx.arc(q.x, q.y, 4.5, 0, 6.2832); ctx.fill();
      });
      // probe: eases toward the cursor, outlines what is under it and reads it out
      if (ptr) {
        if (!pp || still) pp = { x: ptr.x, y: ptr.y };
        else { pp.x += (ptr.x - pp.x) * .18; pp.y += (ptr.y - pp.y) * .18; }
        var hit = null;
        pivots.forEach(function (q) { if (Math.hypot(pp.x - q.x, pp.y - q.y) < q.r) hit = { pivot: q }; });
        if (!hit) parcels.forEach(function (p) { if (pp.x >= p.x && pp.x <= p.x + p.w && pp.y >= p.y && pp.y <= p.y + p.h) hit = p; });
        ctx.strokeStyle = '#E2B85A'; ctx.lineWidth = 2.5;
        if (hit && hit.pivot) { ctx.beginPath(); ctx.arc(hit.pivot.x, hit.pivot.y, hit.pivot.r + 2, 0, 6.2832); ctx.stroke(); }
        else if (hit) ctx.strokeRect(hit.x + 1, hit.y + 1, hit.w - 2, hit.h - 2);
        probe.style.transform = 'translate(' + pp.x.toFixed(1) + 'px,' + pp.y.toFixed(1) + 'px)';
        probe.firstChild.textContent = !hit ? 'Farm road' : hit.pivot ? 'Center pivot · irrigating' :
          hit.c[0] + ' · NDVI ' + hit.v.toFixed(2) + ' · rows ' + String(Math.round(((hit.ang * 180 / Math.PI) + 360) % 180)).padStart(3, '0') + '°';
      } else pp = null;
    }
    function loop(t) { if (!running) return; frame(t); requestAnimationFrame(loop); }
    function sync() { var go = visible && !still && !document.hidden; if (go && !running) { running = true; requestAnimationFrame(loop); } else if (!go) running = false; }
    new ResizeObserver(function () { requestAnimationFrame(build); }).observe(hero);
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; sync(); }).observe(hero);
    document.addEventListener('visibilitychange', sync);
    if (hover) {
      hero.addEventListener('pointermove', function (e) {
        var over = !e.target.closest('a, button, .card, h1, p, .hero-status');
        var r = hero.getBoundingClientRect(); ptr = over ? { x: e.clientX - r.left, y: e.clientY - r.top } : null;
        probe.classList.toggle('on', !!ptr); if (still) frame(0);
      });
      hero.addEventListener('pointerleave', function () { ptr = null; probe.classList.remove('on'); if (still) frame(0); });
    }
    if (!still) onScroll.push(function () { hero.style.setProperty('--hp', clamp(scrollY / hero.offsetHeight).toFixed(3)); });
  })();

  // ---- footer: a closing line, then wheat in three depths; the front two sway and lean away from the cursor ----
  var foot = $('.site-footer');
  if (foot) {
    var close = el('div', 'container m-close', '<p>Open to internships and <em>full-time roles.</em></p><a class="btn btn--primary" href="contact.html">Contact me &nearr;</a>');
    foot.prepend(close);
    var svg = document.createElementNS(SVG, 'svg'), stalks = [], VW = 1600, VH = 190;
    svg.setAttribute('class', 'm-wheat'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('viewBox', '0 0 ' + VW + ' ' + VH); svg.setAttribute('preserveAspectRatio', 'xMidYMax slice');
    var parts = ['<defs><linearGradient id="m-wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9A24A"/><stop offset=".6" stop-color="#8C6A2A"/><stop offset="1" stop-color="#1E1811"/></linearGradient></defs>'];
    seed = 11;
    // depth layers: count, height range, opacity, head colours, sways
    [[110, [40, 90], .45, ['#C9AE74', '#BFA466'], false], [100, [70, 130], .85, ['#D3A84A', '#C4973A'], true], [60, [100, 175], 1, ['#E2B85A', '#C99A36'], true]].forEach(function (L) {
      parts.push('<g class="' + (L[4] ? 'sway' : 'still') + '" opacity="' + L[2] + '">');
      for (var i = 0; i < L[0]; i++) {
        var x = (i + rnd()) * (VW / L[0]), h = L[1][0] + rnd() * (L[1][1] - L[1][0]), lean = (rnd() - .5) * 16, tx = x + lean, ty = VH - h, head = '', sz = h / 120;
        for (var j = 0; j < 6; j++) {
          var cx = (tx + (j % 2 ? 2.6 : -2.6) * sz).toFixed(1), cy = (ty + j * 4.4 * sz).toFixed(1);
          head += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + (2 * sz).toFixed(1) + '" ry="' + (4.6 * sz).toFixed(1) + '" transform="rotate(' + (j % 2 ? 24 : -24) + ' ' + cx + ' ' + cy + ')"/>';
        }
        var stalk = '<g><path d="M' + x.toFixed(1) + ' ' + VH + 'Q' + (x + lean * .3).toFixed(1) + ' ' + (VH - h / 2).toFixed(1) + ' ' + tx.toFixed(1) + ' ' + ty.toFixed(1) +
          '" stroke="url(#m-wg)" stroke-width="' + (1.2 * sz + .4).toFixed(2) + '" fill="none"/><g fill="' + L[3][i % 2] + '">' + head + '</g></g>';
        parts.push(L[4] ? '<g style="--d:' + (-rnd() * 4).toFixed(2) + 's;--s:' + (3 + rnd() * 2.5).toFixed(2) + 's">' + stalk + '</g>' : stalk);
      }
      parts.push('</g>');
    });
    svg.innerHTML = parts.join('');
    foot.prepend(svg);
    var swaying = [].slice.call(svg.querySelectorAll('.sway > g'));
    stalks = swaying.map(function (g) { return { g: g.firstChild, x: null }; });
    if (still) swaying.forEach(function (g) { g.style.animation = 'none'; });
    else new IntersectionObserver(function (es) { swaying.forEach(function (g) { g.style.animationPlayState = es[0].isIntersecting ? 'running' : 'paused'; }); }).observe(foot);
    if (hover && !still) {
      var wind = false;
      document.addEventListener('pointermove', function (e) {
        if (wind) return; wind = true;
        requestAnimationFrame(function () {
          wind = false;
          var top = foot.getBoundingClientRect().top, near = e.clientY > top - 210 && e.clientY < top + 20;
          if (!near && !stalks.some(function (s) { return s.on; })) return;
          stalks.forEach(function (s) {
            if (s.x === null) { var r = s.g.getBoundingClientRect(); s.x = r.left + r.width / 2; }
            var d = e.clientX - s.x, push = near && Math.abs(d) < 90 ? (d > 0 ? -1 : 1) * (1 - Math.abs(d) / 90) * 16 : 0;
            s.on = !!push; s.g.style.rotate = push.toFixed(1) + 'deg';
          });
        });
      }, { passive: true });
      addEventListener('resize', function () { stalks.forEach(function (s) { s.x = null; }); });
    }
  }

  // ---- scroll vine (wide screens): the stem grows with reading progress, leaves unfurl as it passes; it turns sprout-green over dark bands ----
  if (!still && matchMedia('(min-width: 1280px)').matches) {
    var vine = document.createElementNS(SVG, 'svg'), stem, leaves = [], darks = [].slice.call(document.querySelectorAll('.m-pin, .site-footer'));
    vine.setAttribute('class', 'm-vine'); vine.setAttribute('aria-hidden', 'true');
    document.body.append(vine);
    var grow = function () {
      var H = innerHeight, d = 'M30 0', y, i;
      for (y = 12; y <= H; y += 12) d += 'L' + (30 + Math.sin(y / 70) * 12).toFixed(1) + ' ' + y;
      var html = '<path class="stem" d="' + d + '"/>';
      for (y = 60, i = 0; y < H - 20; y += 64, i++) {
        var lx = 30 + Math.sin(y / 70) * 12, side = i % 2 ? 1 : -1;
        html += '<g transform="translate(' + lx.toFixed(1) + ' ' + y + ') rotate(' + (side > 0 ? -28 : 208) + ')"><path class="leaf" data-y="' + y + '" d="M0 0C5-8 16-9 22-1 15 6 6 6 0 0Z" fill="' + (i % 3 ? '#5E8C3F' : '#9CC064') + '"/></g>';
      }
      vine.setAttribute('viewBox', '0 0 60 ' + H); vine.innerHTML = html;
      stem = vine.firstChild; leaves = [].slice.call(vine.querySelectorAll('.leaf'));
      var len = stem.getTotalLength(); stem.style.strokeDasharray = len; stem.dataset.len = len;
    };
    grow(); addEventListener('resize', function () { grow(); tick(); });
    onScroll.push(function () {
      var p = clamp(scrollY / Math.max(1, doc.scrollHeight - innerHeight)), len = +stem.dataset.len, mid = innerHeight / 2;
      stem.style.strokeDashoffset = (len * (1 - p)).toFixed(1);
      leaves.forEach(function (l) { l.classList.toggle('on', +l.dataset.y < p * innerHeight); });
      vine.classList.toggle('dark', darks.some(function (s) { var r = s.getBoundingClientRect(); return r.top < mid && r.bottom > mid; }));
    });
  }

  // ---- one rAF-throttled scroll handler drives everything above ----
  var ticking = false, tick = function () { onScroll.forEach(function (f) { f(); }); };
  addEventListener('scroll', function () { if (ticking) return; ticking = true; requestAnimationFrame(function () { ticking = false; tick(); }); }, { passive: true });
  tick();

  // ---- opening (home): a center-pivot arm sweeps once around and waters the page into view, then the name flies into the hero title ----
  if (doc.classList.contains('m-intro')) {
    if (still) { doc.classList.remove('m-intro'); return; }
    var quick = false; try { quick = !!sessionStorage.getItem('m_seen'); sessionStorage.setItem('m_seen', '1'); } catch (e) {} // repeat visits get a short sweep
    var o = el('div', quick ? 'quick' : '', '<div class="mi-cover"><div class="mi-rings"></div></div><div class="mi-arm"></div><div class="mi-hub"></div>' +
      (quick ? '' : '<div class="mi-sign"><p class="mi-kicker">Phoenix, Arizona &middot; Field data</p><p class="mi-name">Niam <i>LeStourgeon</i></p></div>'));
    o.id = 'm-intro'; o.setAttribute('aria-hidden', 'true');
    document.body.append(o); doc.style.overflow = 'hidden'; doc.classList.remove('m-intro');
    var title = $('.hero--split .hero-title'), name = $('.mi-name', o), timers = [], flown = false, done = false;
    var clear = function (els) { els.forEach(function (e) { e.style.removeProperty('transform'); e.style.removeProperty('opacity'); }); };
    var fly = function () { // FLIP: the centred name travels to where the hero title sits
      if (!name || !title) return;
      var nr = name.getBoundingClientRect(), tr = title.getBoundingClientRect(), s = parseFloat(getComputedStyle(title).fontSize) / parseFloat(getComputedStyle(name).fontSize);
      name.classList.add('fly'); name.style.transform = 'translate(' + (tr.left - nr.left) + 'px,' + (tr.top - nr.top) + 'px) scale(' + s.toFixed(3) + ')';
      flown = true;
    };
    var reveal = function () {
      if (done) return; done = true; timers.forEach(clearTimeout);
      doc.classList.remove('m-hold'); doc.style.overflow = '';
      o.classList.add('out'); setTimeout(function () { o.remove(); }, 600);
      var A = window.anime, col = $('.hero--split .hero-inner > div'), card = $('.hero--split .preview');
      if (!A || !col || doc.classList.contains('m-skip')) return;
      var rest = [].filter.call(col.children, function (c) { return flown ? c !== title : true; });
      A.animate(rest, { opacity: [0, 1], y: [24, 0], duration: 900, delay: A.stagger(90), ease: 'outExpo', onComplete: function () { clear(rest); } });
      if (card) A.animate(card, { opacity: [0, 1], x: [40, 0], duration: 1100, delay: 250, ease: 'outExpo', onComplete: function () { clear([card]); } });
    };
    o.addEventListener('click', reveal); addEventListener('keydown', reveal, { once: true });
    if (quick) timers.push(setTimeout(reveal, 750));
    else { timers.push(setTimeout(fly, 2500)); timers.push(setTimeout(reveal, 3450)); }
  }
})();
