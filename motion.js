// Compute structure (not motion, so it also runs with reduced motion): mono section indices, an "on this page" index in the
// inner-page heroes, and a reading-progress bar. Meadow builds its own kickers in themes/meadow.js.
(function () {
    var main = document.querySelector('main');
    if (!main || document.documentElement.dataset.theme === 'meadow') return;
    var slug = function (s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
    var found = [];
    [].forEach.call(main.querySelectorAll(':scope > section'), function (sec) {
        var head = sec.querySelector('.section-header'), title = head && head.querySelector('.section-title');
        if (!title) return;
        var n = String(found.length + 1).padStart(2, '0'), name = title.textContent.trim(), idx = document.createElement('p'), b = document.createElement('b');
        idx.className = 'sec-idx'; idx.setAttribute('aria-hidden', 'true');
        b.textContent = n; idx.append(b, ' / ' + name);
        head.prepend(idx);
        if (!sec.id) sec.id = 's' + n + '-' + slug(name);
        found.push({ n: n, name: name, id: sec.id });
    });

    var hero = main.querySelector('.hero:not(.hero--split)'), inner = hero && hero.querySelector('.hero-inner');
    if (inner && found.length > 1) {
        var toc = document.createElement('nav'), ol = document.createElement('ol'), k = document.createElement('p');
        toc.className = 'hero-toc card'; toc.setAttribute('aria-label', 'On this page');
        k.className = 'toc-k'; k.textContent = 'On this page';
        found.forEach(function (f) {
            var li = document.createElement('li'), a = document.createElement('a'), b = document.createElement('b');
            a.href = '#' + f.id; b.textContent = f.n; a.append(b, f.name); li.append(a); ol.append(li);
        });
        toc.append(k, ol); inner.append(toc); hero.classList.add('has-toc');
    }

    var bar = document.createElement('div'), pending = false;
    bar.className = 'read-bar'; bar.setAttribute('aria-hidden', 'true'); document.body.append(bar);
    var update = function () {
        var max = document.documentElement.scrollHeight - innerHeight;
        bar.style.setProperty('--read', max > 0 ? Math.min(1, scrollY / max).toFixed(4) : 0);
    };
    addEventListener('scroll', function () { if (!pending) { pending = true; requestAnimationFrame(function () { pending = false; update(); }); } }, { passive: true });
    addEventListener('resize', update); update();
})();

(function () {
    var base = document.currentScript && document.currentScript.src;
    var root = document.documentElement;
    var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var hover = window.matchMedia('(hover: hover)').matches;

    // CSS hides the start states under .js:not(.m-skip); skipping shows everything as-is.
    if (still || !window.anime) { root.classList.add('m-skip'); return; }

    try {
        var A = window.anime, animate = A.animate, stagger = A.stagger, tl = A.createTimeline, split = A.splitText;
        var done = function (el) { el.style.removeProperty('transform'); el.style.removeProperty('opacity'); el.classList.add('m-done'); };
        var rise = function (targets, extra) {
            return animate(targets, Object.assign({
                opacity: [0, 1], y: [28, 0], duration: 900, ease: 'outExpo',
                onComplete: function (a) { [].concat(a.targets || targets).forEach(done); }
            }, extra));
        };

        // ---- hero entrance ----
        var split_hero = document.querySelector('.hero--split .hero-inner');
        if (split_hero) {
            var col = split_hero.firstElementChild, title = col.querySelector('.hero-title');
            var rest = [].filter.call(col.children, function (c) { return c !== title; });
            var chars = split(title, { chars: true }).chars;
            chars.forEach(function (c) { c.style.opacity = 0; });
            title.classList.add('m-done');
            var line = tl({ defaults: { ease: 'outExpo' } });
            line.add(rest[0], { opacity: [0, 1], y: [16, 0], duration: 700 }, 0)
                .add(chars, { opacity: [0, 1], y: ['0.5em', 0], rotate: [6, 0], duration: 900, delay: stagger(30) }, 100)
                .add(rest.slice(1), { opacity: [0, 1], y: [24, 0], duration: 900, delay: stagger(110) }, 450)
                .add(split_hero.querySelector('.preview'), { opacity: [0, 1], x: [40, 0], duration: 1100 }, 500);
            line.then(function () {
                chars.forEach(function (c) { c.style.removeProperty('opacity'); c.style.removeProperty('transform'); });
                rest.concat(split_hero.querySelector('.preview')).forEach(done);
            });

            // pipeline: each step lights up as the CSS dot passes it (7s cycle)
            var pipe = split_hero.querySelector('.pipe');
            if (pipe) pipe.style.setProperty('--end', (pipe.lastElementChild.offsetTop + 9) + 'px'); // pulse stops on the last dot
            [].forEach.call(split_hero.querySelectorAll('.pipe li b'), function (b, i) {
                animate(b, { color: ['#F5F5F0', '#E8D4A8', '#F5F5F0'], duration: 1400, delay: 2200 + i * 1700, loop: true, loopDelay: 5600, ease: 'inOutSine' });
            });

            // readout: each step's payload is typed out as the pulse reaches it (same 7s cycle); the page labels them illustrative
            var rd = split_hero.querySelector('.rd-code'), cap = split_hero.querySelector('.rd-cap');
            if (rd) {
                var PAY = ['{"src":"market-feed","bars":25,"headlines":312,"asof":"09:30:00"}',
                    '{"ridge_p_up":0.81,"laya":"unsure","route":"logistic","tiebreak":false}',
                    '{"size_usd":1840,"cap_usd":5000,"day_pnl":-62,"loss_limit":250,"approved":true}',
                    '{"venue":"alpaca-paper","side":"buy","qty":12,"grade_at":"t+1d"}'];
                var type = function (i) {
                    var s = PAY[i], o = { c: 0 };
                    if (cap) cap.textContent = 'payload · step ' + (i + 1) + ' · illustrative';
                    animate(o, { c: s.length, duration: Math.min(1100, s.length * 16), ease: 'linear', onUpdate: function () { rd.textContent = s.slice(0, Math.round(o.c)); } });
                };
                var cycle = function () { PAY.forEach(function (_, i) { setTimeout(function () { type(i); }, 2200 + i * 1700); }); setTimeout(cycle, 7000); };
                cycle();
            }
        } else {
            var inner = document.querySelector('.hero:not(.hero--split) .hero-inner');
            if (inner) {
                var h1 = inner.querySelector('.hero-title'), others = [].filter.call(inner.children, function (c) { return c !== h1; });
                if (h1) {
                    var cs = split(h1, { chars: true }).chars;
                    cs.forEach(function (c) { c.style.opacity = 0; });
                    h1.classList.add('m-done');
                    animate(cs, { opacity: [0, 1], y: ['0.5em', 0], rotate: [5, 0], duration: 900, delay: stagger(28), ease: 'outExpo',
                        onComplete: function () { cs.forEach(function (c) { c.style.removeProperty('opacity'); c.style.removeProperty('transform'); }); } });
                }
                if (others.length) rise(others, { delay: stagger(110, { start: 350 }) });
            }
        }

        // ---- scroll reveals + count-ups ----
        var SEL = 'main > section:not(.hero) :is(.sec-idx,.section-title,.card,.timeline-item,.tech-stack,.stat-card,.highlight-item,.code-fig)';
        var items = [].slice.call(document.querySelectorAll(SEL)).filter(function (el) {
            if (el.parentElement.closest(SEL)) { el.classList.add('m-done'); return false; } // nested: parent carries it
            return true;
        });
        var fmt = function (el, v) {
            var d = +el.dataset.decimals || 0;
            var n = el.dataset.group ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : v.toFixed(d);
            el.textContent = (el.dataset.prefix || '') + n + (el.dataset.suffix || '');
        };
        var count = function (el) {
            var o = { v: 0 };
            animate(o, { v: parseFloat(el.dataset.count), duration: 1600, ease: 'outExpo', onUpdate: function () { fmt(el, o.v); } });
        };
        [].forEach.call(document.querySelectorAll('[data-count]'), function (el) { fmt(el, 0); });
        // sparklines in a revealed card draw in with it (SVG paths start hidden only once the reveal runs, so a skipped reveal leaves them visible)
        var spark = function (el) {
            var paths = el.querySelectorAll('.spark path'), dots = el.querySelectorAll('.spark circle');
            if (!paths.length) return;
            var d = A.svg.createDrawable(paths);
            A.utils.set(d, { draw: '0 0' }); A.utils.set(dots, { opacity: 0 });
            animate(d, { draw: ['0 0', '0 1'], duration: 1300, delay: stagger(140, { start: 250 }), ease: 'inOutQuad' });
            animate(dots, { opacity: [0, 1], duration: 400, delay: 1500 });
        };
        var io = new IntersectionObserver(function (entries) {
            var seen = entries.filter(function (e) { return e.isIntersecting; }).map(function (e) { io.unobserve(e.target); return e.target; });
            if (!seen.length) return;
            rise(seen, { delay: stagger(90), duration: 800 });
            seen.forEach(function (el) { [].forEach.call(el.querySelectorAll('[data-count]'), count); spark(el); });
        }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
        items.forEach(function (el) { io.observe(el); });

        // a jump past an element (anchor, reload mid-page) never intersects it: show it without animating
        var pending = items.slice(), ticking = false;
        window.addEventListener('scroll', function () {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () {
                ticking = false;
                pending = pending.filter(function (el) {
                    if (!el.isConnected || el.classList.contains('m-done')) return false;
                    if (el.getBoundingClientRect().bottom >= 0) return true;
                    io.unobserve(el); done(el);
                    [].forEach.call(el.querySelectorAll('[data-count]'), function (n) { fmt(n, parseFloat(n.dataset.count)); });
                    return false;
                });
            });
        }, { passive: true });

        // ---- circuit traces: inline the margin SVGs, draw them in per 1000px tile as they scroll into view ----
        if (base && root.dataset.theme !== 'meadow' && window.matchMedia('(min-width: 640px)').matches) { // meadow grows vines instead (themes/meadow.js)
            var tiles = Math.ceil(document.body.scrollHeight / 1000) + 1, layer = document.createElement('div'), lit = [], u = 0;
            layer.className = 'circuit'; layer.setAttribute('aria-hidden', 'true');
            Promise.all(['left', 'right'].map(function (side) {
                return fetch(new URL('assets/circuit-' + side + '.svg', base)).then(function (r) { if (!r.ok) throw 0; return r.text(); });
            })).then(function (src) {
                var rows = [];
                for (var i = 0; i < tiles; i++) {
                    var row = document.createElement('div');
                    row.className = 'circuit-row'; row.style.top = i * 1000 + 'px';
                    layer.appendChild(row); rows.push(row);
                }
                document.body.appendChild(layer);
                var tio = new IntersectionObserver(function (es) {
                    es.forEach(function (e) {
                        if (!e.isIntersecting) return;
                        tio.unobserve(e.target);
                        [0, 1].forEach(function (side) {
                            var id = ++u, h = document.createElement('div');
                            // ids f and m differ between sides; g is identical, so it can stay shared
                            h.className = side ? 'r' : 'l';
                            h.innerHTML = src[side].replace(/id="(f|m)"/g, 'id="$1' + id + '"').replace(/url\(#(f|m)\)/g, 'url(#$1' + id + ')');
                            e.target.appendChild(h);
                            var paths = h.querySelectorAll('g[stroke] > path'), dots = h.querySelectorAll('g[stroke] > circle'), pulses = h.querySelectorAll('path.p');
                            var draw = A.svg.createDrawable(paths);
                            A.utils.set(draw, { draw: '0 0' });
                            A.utils.set(dots, { opacity: 0 }); A.utils.set(pulses, { opacity: 0 });
                            dots.forEach(function (d) { d.style.transformBox = 'fill-box'; d.style.transformOrigin = 'center'; });
                            animate(draw, { draw: ['0 0', '0 1'], duration: 1800, delay: stagger(70, { start: 250 }), ease: 'inOutQuad' });
                            animate(dots, { opacity: [0, 1], scale: [0, 1], duration: 500, delay: stagger(60, { start: 1300 }), ease: 'outBack' });
                            animate(pulses, { opacity: [0, 1], duration: 800, delay: 2400 });
                            h.querySelector('svg').style.display = 'block';
                            [].forEach.call(paths, function (p) {
                                var r = p.getBoundingClientRect();
                                lit.push({ el: p, x: r.left + r.width / 2 + scrollX, y0: r.top + scrollY, y1: r.bottom + scrollY });
                            });
                        });
                        root.classList.add('circuit-live');
                    });
                }, { rootMargin: '200px 0px' });
                rows.forEach(function (r) { tio.observe(r); });
            }).catch(function () { /* file:// or offline: the CSS background stays */ });

            // the trace nearest the cursor brightens while it is over the margins
            var tick = false, on = [];
            document.addEventListener('pointermove', function (e) {
                if (!hover || tick) return;
                tick = true;
                requestAnimationFrame(function () {
                    tick = false;
                    on.forEach(function (p) { p.style.removeProperty('stroke-opacity'); }); on = [];
                    if (e.clientX > 340 && e.clientX < innerWidth - 340) return;
                    var px = e.clientX + scrollX, py = e.clientY + scrollY;
                    lit.forEach(function (c) {
                        var dx = Math.abs(c.x - px);
                        if (dx > 90 || py < c.y0 || py > c.y1) return;
                        c.el.style.strokeOpacity = (0.55 + 0.45 * (1 - dx / 90)).toFixed(2); on.push(c.el);
                    });
                });
            }, { passive: true });
        }

        // ---- data-flow diagram: nodes fade up, edges draw with the same stroke as the circuit traces, end dots pop ----
        var dg = document.querySelector('.dg');
        if (dg && dg.getBoundingClientRect().top > innerHeight * 0.9) { // already on screen (reload mid-page): leave it drawn
            var nodes = dg.querySelectorAll('.dg-node'), dots = dg.querySelectorAll('.dg-dot'), edges = A.svg.createDrawable(dg.querySelectorAll('.dg-edge'));
            A.utils.set(edges, { draw: '0 0' }); A.utils.set(nodes, { opacity: 0 }); A.utils.set(dots, { opacity: 0 });
            dots.forEach(function (d) { d.style.transformBox = 'fill-box'; d.style.transformOrigin = 'center'; });
            var dio = new IntersectionObserver(function (es) {
                if (!es[0].isIntersecting) return;
                dio.disconnect();
                animate(nodes, { opacity: [0, 1], y: [10, 0], duration: 700, delay: stagger(110), ease: 'outExpo' });
                animate(edges, { draw: ['0 0', '0 1'], duration: 1100, delay: stagger(130, { start: 350 }), ease: 'inOutQuad' });
                animate(dots, { opacity: [0, 1], scale: [0, 1], duration: 450, delay: stagger(110, { start: 900 }), ease: 'outBack' });
            }, { threshold: 0.2 });
            dio.observe(dg);
        }

        // ---- Compute: the featured recording plays muted while in view (not on data saver); a manual pause is respected ----
        var fv = document.querySelector('.flagship video');
        if (fv && root.dataset.theme !== 'meadow' && !(navigator.connection && navigator.connection.saveData)) {
            var ours = false, off = false;
            fv.loop = true;
            fv.addEventListener('pause', function () { if (!ours) off = true; ours = false; });
            new IntersectionObserver(function (es) {
                if (es[0].isIntersecting) { if (!off) fv.play().catch(function () {}); }
                else if (!fv.paused) { ours = true; fv.pause(); }
            }, { threshold: 0.6 }).observe(fv);
        }

        // ---- pointer effects (CSS reads the variables) ----
        if (hover) {
            document.addEventListener('pointermove', function (e) {
                var card = e.target.closest && e.target.closest('.card, .kpi');
                if (card) {
                    var r = card.getBoundingClientRect();
                    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
                    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
                    if (card.classList.contains('preview')) {
                        card.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 8).toFixed(2) + 'deg');
                        card.style.setProperty('--rx', ((0.5 - (e.clientY - r.top) / r.height) * 8).toFixed(2) + 'deg');
                    }
                }
            }, { passive: true });
            document.addEventListener('pointerout', function (e) {
                var t = e.target.closest && e.target.closest('.preview');
                if (!t || t.contains(e.relatedTarget)) return;
                ['--rx', '--ry'].forEach(function (p) { t.style.removeProperty(p); });
            });
        }
    } catch (err) {
        root.classList.add('m-skip');
    }
})();
