// Model statistics demo: a synthetic, seeded snapshot (30 days to 10-27) so the widget needs no backend.
    (() => {
        // Real rows go in <script id="ms-data"> (see the Supabase query); if it is empty, the sample data below is used.
        const pad = n => String(n).padStart(2, '0');
        const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
        // Daily call shape read off the admin dashboard; each model's total is spread over it.
        const SHAPE = [0,0,0,630,628,5,8,0,30,0,25,0,0,8,0,30,0,490,930,935,750,70,35,0,490,930,935,750,70,30];
        const TOOLS = [['Lineup optimizer', .34], ['Player lookup', .31], ['Waiver wire', .2], ['Trade analyzer', .15]];
        const OUTCOMES = [['Success', .94], ['Error', .04], ['Fallback', .02]];
        const MODELS = [
            { name: 'claude-sonnet-5-5', prov: 'Claude', total: 7753, tok: [2800, 3200], from: 0 },
            { name: 'jev-1.13.0', prov: 'Jev', total: 54, tok: [250, 500], from: 0 },
            { name: 'jev-1.14.0', prov: 'Jev', total: 21, tok: [250, 500], from: 17 },
        ];

        let a = 7; // mulberry32
        const rnd = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
        const pick = list => { let r = rnd(); for (const [v, w] of list) if ((r -= w) < 0) return v; return list[0][0]; };

        const sample = () => {
        const cells = new Map();
        MODELS.forEach(m => {
            const shape = SHAPE.map((v, i) => i < m.from ? 0 : v), sum = shape.reduce((x, y) => x + y);
            let cum = 0, done = 0;
            shape.forEach((v, d) => {
                cum += v;
                for (const upto = Math.round(cum * m.total / sum); done < upto; done++) {
                    const tool = pick(TOOLS), outcome = pick(OUTCOMES), key = [d, m.name, tool, outcome].join('|');
                    const c = cells.get(key) || { day: iso(new Date(2026, 8, 28 + d)), model: m.name, tool, outcome, calls: 0, tokens: 0 };
                    c.calls++; c.tokens += Math.round(m.tok[0] + rnd() * m.tok[1]);
                    cells.set(key, c);
                }
            });
        });
        // Zero row: stretches the range back to the first (empty) day, like the anchor rows in the SQL.
        return [{ day: '2026-09-28', model: MODELS[0].name, tool: TOOLS[0][0], outcome: 'Success', calls: 0, tokens: 0 }, ...cells.values()];
        };

        // Rows are { day: 'YYYY-MM-DD', model, tool, outcome, calls, tokens }.
        const ROWS = JSON.parse(document.getElementById('ms-data').textContent.trim() || 'null') || sample();
        const days = ROWS.map(r => r.day).sort();
        const DAYS = [];
        for (let d = parse(days[0]); iso(d) <= days[days.length - 1]; d.setDate(d.getDate() + 1)) DAYS.push(iso(d));
        const N = DAYS.length;
        const LABELS = DAYS.map(s => s.slice(5));
        const DATES = DAYS.map(s => parse(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        const FACTS = ROWS.map(r => ({ d: DAYS.indexOf(r.day), model: r.model, prov: r.model.startsWith('jev') ? 'Jev' : 'Claude', tool: r.tool, outcome: r.outcome, calls: +r.calls, tokens: +r.tokens }));
        const uniq = k => [...new Set(FACTS.map(f => f[k]))].sort().map(v => [v, v]);

        const OPTS = {
            measure: [['calls', 'Calls'], ['tokens', 'Tokens']],
            prov: [['all', 'Claude + Jev'], ['Claude', 'Claude'], ['Jev', 'Jev']],
            tool: [['all', 'All tools'], ...uniq('tool')],
            outcome: [['all', 'All outcomes'], ...uniq('outcome')],
            by: [['model', 'Model'], ['tool', 'Tool'], ['outcome', 'Outcome']],
        };
        const s = { measure: 'calls', prov: 'all', tool: 'all', outcome: 'all', by: 'model' };
        const root = document.getElementById('ms'), chartEl = document.getElementById('ms-chart');
        const num = v => v.toLocaleString('en-US', { maximumFractionDigits: 1 });
        const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
        const tick = v => s.measure === 'tokens' ? compact.format(v) : num(v);
        let groups = {}, keys = [], cur = null, act = null;

        root.querySelectorAll('select').forEach(sel => {
            sel.innerHTML = OPTS[sel.name].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
            sel.addEventListener('change', () => { s[sel.name] = sel.value; if (sel.name === 'by') cur = null; act = null; render(); });
        });

        const H = 270, L = 52, R = 18, T = 34, B = 30;
        let step = 1;
        function draw() {
            const g = groups[cur], W = chartEl.clientWidth;
            if (!g) { chartEl.innerHTML = '<p class="ms-empty">No calls match these filters.</p>'; return; }
            step = (W - L - R) / (N - 1);
            const max = Math.max(...g.days) || 1, X = i => L + i * step, Y = v => T + (H - T - B) * (1 - v / max);
            let h = `<svg width="${W}" height="${H}">`;
            for (let k = 0; k <= 4; k++) {
                const y = Y(max * k / 4);
                h += `<line class="ms-grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text class="ms-tick" x="${L - 8}" y="${y + 4}" text-anchor="end">${tick(max * k / 4)}</text>`;
            }
            LABELS.forEach((l, i) => { if (i % 5 === 0 || (i === N - 1 && W > 520)) h += `<text class="ms-tick" x="${X(i)}" y="${H - 8}" text-anchor="middle">${l}</text>`; });
            if (act !== null) h += `<line class="ms-cross" x1="${X(act)}" x2="${X(act)}" y1="${T}" y2="${H - B}"/>`;
            h += `<path class="ms-line" d="${g.days.map((v, i) => (i ? 'L' : 'M') + X(i) + ',' + Y(v)).join('')}"/>`;
            g.days.forEach((v, i) => h += `<circle class="ms-dot${i === act ? ' on' : ''}" cx="${X(i)}" cy="${Y(v)}" r="${i === act ? 6 : 4}"/>`);
            h += '</svg>';
            if (act !== null) h += `<div class="ms-tip" style="left:${Math.min(Math.max(X(act), 70), W - 70)}px;top:${Y(g.days[act]) - 12}px"><b>${DATES[act]}</b> &middot; ${num(g.days[act])} ${s.measure}</div>`;
            chartEl.innerHTML = h;
        }

        function render() {
            groups = {};
            FACTS.forEach(f => {
                if (!f[s.measure] || (s.prov !== 'all' && f.prov !== s.prov) || (s.tool !== 'all' && f.tool !== s.tool) || (s.outcome !== 'all' && f.outcome !== s.outcome)) return;
                const g = groups[f[s.by]] ||= { total: 0, days: Array(N).fill(0) };
                g.total += f[s.measure]; g.days[f.d] += f[s.measure];
            });
            keys = Object.keys(groups).sort((x, y) => groups[y].total - groups[x].total);
            if (!groups[cur]) cur = keys[0];
            document.getElementById('ms-meta').textContent = `${N} days · ${s.measure} · ${keys.length} ${s.by} group${keys.length === 1 ? '' : 's'}`;
            document.getElementById('ms-list-h').textContent = `By ${s.by}`;
            document.getElementById('ms-list').innerHTML = keys.map(k => `<button type="button" class="ms-row" data-k="${k}" aria-pressed="${k === cur}"><span>${k}</span><b>${num(groups[k].total)}</b></button>`).join('');
            document.getElementById('ms-table').innerHTML = `<thead><tr><th>Date</th>${keys.map(k => `<th>${k}</th>`).join('')}</tr></thead><tbody>${LABELS.map((l, i) => `<tr><td>${l}</td>${keys.map(k => `<td>${num(groups[k].days[i])}</td>`).join('')}</tr>`).join('')}</tbody>`;
            draw();
        }

        document.getElementById('ms-list').addEventListener('click', e => {
            const b = e.target.closest('.ms-row'); if (!b) return;
            cur = b.dataset.k; render();
            document.querySelector(`#ms-list [data-k="${cur}"]`).focus();
        });
        const at = e => { act = Math.min(N - 1, Math.max(0, Math.round((e.clientX - chartEl.getBoundingClientRect().left - L) / step))); draw(); };
        chartEl.addEventListener('pointermove', at);
        chartEl.addEventListener('pointerdown', at);
        ['pointerleave', 'blur'].forEach(ev => chartEl.addEventListener(ev, () => { act = null; draw(); }));
        chartEl.addEventListener('keydown', e => {
            const d = { ArrowLeft: -1, ArrowRight: 1 }[e.key]; if (!d) return;
            e.preventDefault(); act = Math.min(N - 1, Math.max(0, (act ?? (d > 0 ? -1 : N)) + d)); draw();
        });
        new ResizeObserver(draw).observe(chartEl);
        render();
    })();
