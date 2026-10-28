// Load-in: gold binary rains down in columns and wipes the page into view (~3.5s).
(function () {
    var c = document.getElementById('intro');
    if (!c) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { c.remove(); return; }

    var ctx = c.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = innerWidth, h = innerHeight;
    c.width = w * dpr; c.height = h * dpr;
    ctx.scale(dpr, dpr);

    var GOLD = '#E8D4A8', HEAD = '#FFF6DC', BG = '#050506';
    var T1 = 0, TRAIL = 12, CW = 16;
    var rnd = function (n) { return Math.random() * n; };
    var clamp = function (u) { return Math.max(0, Math.min(1, u)); };

    // rain columns: head position is wipe progress; everything below the head is still covered
    var cols = [];
    for (var k = 0; k < Math.ceil(w / CW); k++) cols.push({ d: rnd(1000), dur: 1500 + rnd(800) });

    var start = performance.now(), ended = false;
    function end() {
        if (ended) return;
        ended = true;
        c.style.transition = 'opacity 300ms ease';
        c.style.opacity = 0;
        setTimeout(function () { c.remove(); }, 350);
    }
    c.addEventListener('click', end);
    ctx.textBaseline = 'top';

    function frame(now) {
        if (ended) return;
        var T = now - start, alive = false;
        ctx.clearRect(0, 0, w, h);

        {
            c.style.background = 'transparent';
            ctx.font = '14px "JetBrains Mono", monospace';
            cols.forEach(function (col, ci) {
                var u = clamp((T - T1 - col.d) / col.dur), head = u * (h + TRAIL * CW);
                if (T - T1 - col.d < col.dur + 200) alive = true;
                ctx.fillStyle = BG;
                ctx.fillRect(ci * CW, head, CW, h - head);
                var row = Math.floor(head / CW);
                if (u <= 0 || u >= 1) return;
                for (var t = 0; t < TRAIL; t++) {
                    var y = (row - t) * CW;
                    if (y < -CW || y > h) continue;
                    var ch = ((ci * 31 + (row - t) * 17 + Math.floor(T / 90)) % 7) < 3 ? '0' : '1';
                    ctx.globalAlpha = t ? Math.pow(1 - t / TRAIL, 1.5) * 0.85 : 1;
                    ctx.fillStyle = t ? GOLD : HEAD;
                    ctx.fillText(ch, ci * CW + 3, y);
                }
                ctx.globalAlpha = 1;
            });
            if (!alive) { ended = true; c.remove(); return; }
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();
