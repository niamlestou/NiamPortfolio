'use strict'
const P = JSON.parse(document.getElementById('payload').textContent)
const $ = s => document.querySelector(s)
const NS = 'http://www.w3.org/2000/svg'
const num = v => Number(v) || 0

// ---------- CSV ----------
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  const rows = []; let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; rows.push(row); row = [] }
    else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  const head = rows.shift() || []
  const unguard = s => (/^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s)
  return rows.filter(r => r.length > 1 || r[0] !== '').map(r => Object.fromEntries(head.map((h, i) => [h, unguard(r[i] ?? '')])))
}

// ---------- data ----------
const TODAY = P.today
const days = parseCsv(P.csv['usage-days.csv']).map(r => ({
  date: r.date, sessions: num(r.sessions), prompts: num(r.prompts), replies: num(r.replies), messages: num(r.messages),
  input: num(r.input_tokens), output: num(r.output_tokens), cr: num(r.cache_read_tokens), cw: num(r.cache_write_tokens),
  total: num(r.total_tokens), peak: r.peak_hour === '' ? null : num(r.peak_hour), partial: r.partial === '1',
})).sort((a, b) => (a.date < b.date ? -1 : 1))
const mrows = parseCsv(P.csv['usage-models.csv']).map(r => ({
  date: r.date, model: r.model, scope: r.scope, calls: num(r.calls),
  input: num(r.input_tokens), output: num(r.output_tokens), cr: num(r.cache_read_tokens), cw: num(r.cache_write_tokens),
}))
const crows = P.csv['usage-cost.csv'] ? parseCsv(P.csv['usage-cost.csv']) : []
const hkrows = P.csv['usage-hooks.csv'] ? parseCsv(P.csv['usage-hooks.csv']).map(r => ({ date: r.date, source: r.source, event: r.event, fires: num(r.fires), tok: num(r.est_tokens), saved: num(r.tokens_saved) })) : []
const group = (rows) => { const m = new Map(); for (const r of rows) { if (!m.has(r.date)) m.set(r.date, []); m.get(r.date).push(r) } return m }
const dayBy = new Map(days.map(d => [d.date, d]))
const mBy = group(mrows)

// model colour follows the entity: slots by all-time tokens, never by the current filter
const totals = new Map(); for (const r of mrows) totals.set(r.model, (totals.get(r.model) || 0) + r.input + r.output + r.cr + r.cw)
const MODELS = [...totals].sort((a, b) => b[1] - a[1]).map(x => x[0])
// With a provider or model filter there is no "Other": every model of that provider gets its own colour (cycling after 14).
const filtered = () => Boolean(st.provider || st.model)
const shown = () => (st.provider ? MODELS.filter(m => provOf(m) === st.provider) : MODELS)
const bucket = m => (filtered() || MODELS.indexOf(m) < 13 ? m : 'Other')
const colorOf = k => (k === 'Other' ? 'var(--s-other)' : `var(--s${(filtered() ? shown() : MODELS).indexOf(k) % 14 + 1})`)

// ---------- helpers ----------
const pad = n => String(n).padStart(2, '0')
const fmtDate = t => `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
const shift = (d, n) => { const [y, m, x] = d.split('-').map(Number); return fmtDate(new Date(y, m - 1, x + n)) }
const dow = d => { const [y, m, x] = d.split('-').map(Number); return new Date(y, m - 1, x).getDay() }
const commas = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const compact = n => {
  const f = (v, s) => `${v.toFixed(v >= 100 ? 0 : 1).replace(/\.0$/, '')}${s}`
  const a = Math.abs(n)
  return a >= 1e9 ? f(n / 1e9, 'B') : a >= 1e6 ? f(n / 1e6, 'M') : a >= 1e3 ? f(n / 1e3, 'K') : String(Math.round(n))
}
const hourLabel = h => (h === null || h === undefined ? 'none' : `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`)
const pct = (a, b) => (b > 0 ? `${(a / b * 100).toFixed(a / b < 0.1 ? 1 : 0)}%` : '0%')
function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) { if (k === 'text') n.textContent = v; else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v) }
  for (const k of kids.flat()) if (k != null) n.append(k)
  return n
}
function s(tag, attrs = {}, ...kids) {
  const n = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) { if (k === 'text') n.textContent = v; else if (v != null) n.setAttribute(k, v) }
  for (const k of kids.flat()) if (k != null) n.append(k)
  return n
}
function niceScale(max) {
  if (max <= 0) return { top: 4, step: 1 }
  const raw = max / 4, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p
  return { top: Math.ceil(max / step) * step, step }
}

// ---------- tooltip ----------
const tip = $('#tip')
function tipRow(color, value, name) {
  return h('div', { class: 'r' }, color ? h('i', { class: 'ln', style: `background:${color}` }) : null, h('b', { text: value }), h('span', { text: name }))
}
function showTip(title, rows, x, y) {
  tip.replaceChildren(h('div', { class: 't', text: title }), ...rows)
  tip.style.display = 'block'
  const r = tip.getBoundingClientRect()
  const left = Math.max(8, Math.min(innerWidth - r.width - 8, x + 12))
  const top = y - r.height - 12 < 8 ? Math.min(innerHeight - r.height - 8, y + 16) : y - r.height - 12
  tip.style.left = `${left}px`; tip.style.top = `${top}px`
}
const hideTip = () => { tip.style.display = 'none' }
const showAtEl = (el, title, rows) => { const r = el.getBoundingClientRect(); showTip(title, rows, r.left + r.width / 2 - 12, r.top) }

// ---------- state ----------
const st = { range: 'all', from: '', to: '', model: '', provider: '', cache: false, mcp: 'server', q: '', sort: 'date', dir: -1 }
const firstDate = days[0] ? days[0].date : TODAY
function bounds() {
  if (st.range === '7d') return [shift(TODAY, -6), TODAY]
  if (st.range === '30d') return [shift(TODAY, -29), TODAY]
  if (st.range === 'custom') { let f = st.from || firstDate, t = st.to || TODAY; if (f > t) [f, t] = [t, f]; return [f, t] }
  return [firstDate, TODAY]
}
const provOf = m => /^(Codex|OpenCode|Freebuff|Copilot|Mistral): /.exec(m)?.[1] || 'Claude Code'
const pick = r => (!st.model || r.model === st.model) && (!st.provider || provOf(r.model) === st.provider)
const tokOf = (a, cache) => a.input + a.output + a.cw + (cache ? a.cr : 0)
function aggDate(date) {
  const a = { calls: 0, input: 0, output: 0, cr: 0, cw: 0 }
  for (const r of mBy.get(date) || []) if (pick(r)) { a.calls += r.calls; a.input += r.input; a.output += r.output; a.cr += r.cr; a.cw += r.cw }
  a.tokens = tokOf(a, st.cache); a.all = tokOf(a, true)
  return a
}
let view = []
function compute() {
  const [from, to] = bounds()
  const out = []
  for (let d = from, i = 0; d <= to && i < 4000; d = shift(d, 1), i++) out.push({ date: d, day: dayBy.get(d), agg: aggDate(d), partial: d >= TODAY })
  view = out
}
const isActive = v => ((st.model || st.provider) ? v.agg.calls > 0 : Boolean(v.day))

// ---------- generic column chart ----------
// cols: [{ title, xlabel, partial, segs: [{ key, color, value, name }] }]; one segment per column for a single series.
function colChart(box, cols, o = {}) {
  box.replaceChildren()
  const W = Math.max(260, box.clientWidth), H = o.height || (W < 500 ? 210 : 260)
  const m = { l: o.axis === false ? 4 : 44, r: 6, t: 8, b: o.axis === false ? 4 : 24 }
  const pw = W - m.l - m.r, ph = H - m.t - m.b, n = cols.length
  const tot = c => c.segs.reduce((a, g) => a + g.value, 0)
  const max = Math.max(0, ...cols.map(tot))
  const sc = niceScale(max)
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img', tabindex: '0', 'aria-label': `${o.label}. ${n} bars. Use the left and right arrow keys to read each one.` })
  if (o.axis !== false) {
    for (let v = 0; v <= sc.top + 1e-9; v += sc.step) {
      const y = m.t + ph - (v / sc.top) * ph
      svg.append(s('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, stroke: v === 0 ? 'var(--axis)' : 'var(--grid)', 'stroke-width': 1 }))
      svg.append(s('text', { x: m.l - 6, y: y + 4, 'text-anchor': 'end', text: compact(v) }))
    }
  } else svg.append(s('line', { x1: m.l, x2: W - m.r, y1: m.t + ph, y2: m.t + ph, stroke: 'var(--axis)' }))
  const band = pw / Math.max(1, n), bw = Math.max(1.5, Math.min(24, band - 2))
  const every = Math.max(1, Math.ceil((o.labelGap || 46) / band))
  const groups = []
  cols.forEach((c, i) => {
    const x = m.l + band * i + (band - bw) / 2
    const g = s('g', { class: 'col' })
    g.append(s('rect', { class: 'bgc', x: m.l + band * i, y: m.t, width: band, height: ph, fill: 'transparent' }))
    let y0 = 0
    const live = c.segs.filter(sg => sg.value > 0)
    live.forEach((sg, j) => {
      const hh = (sg.value / sc.top) * ph
      const bottom = m.t + ph - y0 - (j === 0 ? 0 : 1)
      const top = m.t + ph - (y0 + hh)
      y0 += hh
      if (bottom - top < 0.6) return
      const last = j === live.length - 1, r = last ? Math.min(4, bw / 2, (bottom - top) / 2) : 0
      const d = last ? `M${x},${bottom}L${x},${top + r}Q${x},${top} ${x + r},${top}L${x + bw - r},${top}Q${x + bw},${top} ${x + bw},${top + r}L${x + bw},${bottom}Z` : `M${x},${bottom}L${x},${top}L${x + bw},${top}L${x + bw},${bottom}Z`
      g.append(s('path', { class: 'seg', d, fill: sg.color, opacity: c.partial ? 0.55 : 1 }))
    })
    if (o.axis !== false && i % every === 0) g.append(s('text', { x: m.l + band * i + band / 2, y: H - 6, 'text-anchor': 'middle', text: c.xlabel }))
    svg.append(g); groups.push(g)
  })
  const show = (i, x, y, el) => {
    const c = cols[i]; if (!c) return
    groups.forEach((g, k) => g.classList.toggle('hot', k === i))
    const rows = [tipRow(null, o.fmtTotal ? o.fmtTotal(c) : commas(tot(c)), o.totalName || 'total')]
    if (c.segs.length > 1) for (const sg of c.segs) if (sg.value > 0) rows.push(tipRow(sg.color, commas(sg.value), sg.name))
    if (c.partial) rows.push(h('div', { class: 'r' }, h('span', { text: 'Partial day, still in progress' })))
    if (x == null) showAtEl(groups[i], c.title, rows); else showTip(c.title, rows, x, y)
  }
  const clear = () => { groups.forEach(g => g.classList.remove('hot')); hideTip() }
  svg.addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect()
    const i = Math.floor(((e.clientX - r.left) * (W / r.width) - m.l) / band)
    if (i >= 0 && i < n) show(i, e.clientX, e.clientY); else clear()
  })
  svg.addEventListener('pointerleave', clear)
  let cur = -1
  svg.addEventListener('focus', () => { if (n) { cur = cur < 0 ? n - 1 : cur; show(cur) } })
  svg.addEventListener('blur', () => { clear() })
  svg.addEventListener('keydown', e => {
    const k = { ArrowLeft: -1, ArrowRight: 1, Home: -1e9, End: 1e9 }[e.key]
    if (e.key === 'Escape') { clear(); return }
    if (k === undefined || !n) return
    e.preventDefault(); cur = Math.max(0, Math.min(n - 1, cur + k)); show(cur)
  })
  box.append(svg)
}

// ---------- sections ----------
function renderHeader() {
  const hrs = (Date.now() - new Date(P.generated).getTime()) / 36e5
  const st_ = $('#stale')
  st_.hidden = hrs < 30
  st_.textContent = `Heads up: this page is ${Math.round(hrs)} hours old. The nightly job may not have run; run it again to refresh.`
  const sel = $('#model'); sel.replaceChildren(h('option', { value: '', text: 'All models' }), ...MODELS.map(m => h('option', { value: m, text: m })))
  const [lo, hi] = [firstDate, TODAY]
  for (const id of ['from', 'to']) { $('#' + id).min = lo; $('#' + id).max = hi }
}

function renderKpis() {
  const act = view.filter(isActive)
  let sessions = 0, messages = 0, prompts = 0, replies = 0, tokens = 0, all = 0
  const calls = new Map()
  for (const v of view) {
    if (v.day) { sessions += v.day.sessions; messages += v.day.messages; prompts += v.day.prompts; replies += v.day.replies }
    tokens += v.agg.tokens; all += v.agg.all
    for (const r of mBy.get(v.date) || []) if (pick(r)) calls.set(r.model, (calls.get(r.model) || 0) + r.calls)
  }
  const fav = [...calls].sort((a, b) => b[1] - a[1])[0]
  const per = act.length ? tokens / act.length : 0
  const tag = (st.model || st.provider) ? ' (all models)' : ''
  const kp = [
    ['Sessions', commas(sessions), 'summed per day' + tag],
    ['Messages', commas(messages), `${commas(prompts)} prompts + ${commas(replies)} replies${tag}`],
    ['Tokens', compact(tokens), st.cache ? 'includes cache reads' : `${compact(all)} with cache reads`],
    ['Active days', commas(act.length), `of ${view.length} in range`],
    ['Favorite model', fav ? fav[0] : 'none', fav ? `${commas(fav[1])} calls` : ''],
    ['Tokens per active day', compact(per), st.cache ? 'includes cache reads' : 'without cache reads'],
  ]
  $('#kpis').replaceChildren(...kp.map(([l, v, sub]) => h('div', { class: 'kpi' }, h('div', { class: 'l', text: l }), h('div', { class: 'v', style: v.length > 11 ? 'font-size:17px' : null, text: v }), h('div', { class: 's', text: sub }))))
  $('#live').textContent = `Showing ${view.length} days from ${view[0] ? view[0].date : ''} to ${view.length ? view[view.length - 1].date : ''}${st.model ? ` for ${st.model}` : ''}.`
}

function drawDaily() {
  const keys = []
  const present = new Set(); for (const v of view) for (const r of mBy.get(v.date) || []) if (pick(r)) present.add(bucket(r.model))
  for (const m of MODELS) if (present.has(m)) keys.push(m)
  if (present.has('Other')) keys.push('Other')
  $('#daily-legend').replaceChildren(...keys.map(k => h('span', {}, h('i', { class: 'key', style: `background:${colorOf(k)}` }), k)))
  const box = $('#daily')
  if (!view.some(v => v.agg.all > 0)) { box.replaceChildren(h('p', { class: 'empty', text: 'No token activity in this range.' })); return }
  const cols = view.map(v => {
    const by = {}
    for (const r of mBy.get(v.date) || []) if (pick(r)) by[bucket(r.model)] = (by[bucket(r.model)] || 0) + tokOf(r, st.cache)
    return { title: v.date, xlabel: v.date.slice(5), partial: v.partial, segs: keys.map(k => ({ key: k, color: colorOf(k), value: by[k] || 0, name: k })) }
  })
  colChart(box, cols, { label: `Daily tokens by model${st.cache ? ', including cache reads' : ', without cache reads'}`, totalName: 'tokens', height: Math.max(400, Math.round(innerHeight * 0.55)) })
  const all = view.reduce((a, v) => a + v.agg.all, 0), cr = view.reduce((a, v) => a + v.agg.cr, 0)
  $('#daily-note').textContent = st.cache
    ? `Cache reads are included (${pct(cr, all)} of the tokens in this range), so they dominate the bars.`
    : `Cache reads are left out: the same saved context is re-read on every call, so they are ${pct(cr, all)} of all tokens here and would flatten everything else. Tick "Count cache-read tokens" to add them.`
}

function renderMix() {
  const t = view.reduce((a, v) => ({ input: a.input + v.agg.input, output: a.output + v.agg.output, cr: a.cr + v.agg.cr, cw: a.cw + v.agg.cw }), { input: 0, output: 0, cr: 0, cw: 0 })
  const sum = t.input + t.output + t.cr + t.cw
  const rows = [['Input', t.input], ['Output', t.output], ['Cache read', t.cr], ['Cache write', t.cw]]
  $('#mix').replaceChildren(...(sum ? rows.map(([l, v]) => h('div', { class: 'mix-row' }, h('span', { text: l }), h('div', { class: 'bar', role: 'img', 'aria-label': `${l}: ${pct(v, sum)}` }, h('i', { style: `width:${(v / sum) * 100}%` })), h('span', { class: 'val', text: `${compact(v)} (${pct(v, sum)})` }))) : [h('p', { class: 'empty', text: 'No tokens in this range.' })]))
}

function renderModels() {
  const by = new Map()
  for (const v of view) for (const r of mBy.get(v.date) || []) {
    if (!pick(r)) continue
    const a = by.get(r.model) || { calls: 0, tokens: 0, sub: 0 }
    a.calls += r.calls; a.tokens += tokOf(r, st.cache); if (r.scope === 'subagent') a.sub += r.calls
    by.set(r.model, a)
  }
  const list = [...by].sort((a, b) => b[1].tokens - a[1].tokens), tot = list.reduce((n, [, a]) => n + a.tokens, 0)
  const tb = $('#models-tbl')
  tb.replaceChildren(h('caption', { class: 'sr-only', text: 'Calls and tokens per model' }),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Model' }), h('th', { scope: 'col', text: 'Calls' }), h('th', { scope: 'col', class: 'opt', text: 'Subagent calls' }), h('th', { scope: 'col', text: 'Tokens' }), h('th', { scope: 'col', text: 'Share' }))),
    h('tbody', {}, ...(list.length ? list.map(([m, a]) => h('tr', {}, h('td', {}, h('i', { class: 'key', style: `background:${colorOf(bucket(m))}` }), m), h('td', { text: commas(a.calls) }), h('td', { class: 'opt', text: commas(a.sub) }), h('td', { text: compact(a.tokens) }), h('td', { text: pct(a.tokens, tot) }))) : [h('tr', {}, h('td', { colspan: 5, class: 'empty', text: 'No model activity in this range.' }))])))
}

function renderCost() {
  const rows = crows.filter(r => !st.provider || r.tool === st.provider)
  const usd = v => (v === '' ? '' : '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  const isTotal = r => r.model.startsWith('TOTAL') || r.model.startsWith('GRAND')
  const tok = r => compact(num(r.input_tokens) + num(r.output_tokens) + num(r.cache_read_tokens) + num(r.cache_write_tokens))
  const cost = r => (r.priced === 'yes' ? usd(r.cost_usd) : 'no price')
  const tools = [...new Set(rows.filter(r => r.tool !== 'ALL').map(r => r.tool))]
  const body = []
  for (const t of tools) {
    const kids = rows.filter(r => r.tool === t && !isTotal(r))
    const tot = rows.find(r => r.tool === t && isTotal(r))
    const kidRows = kids.map(r => h('tr', { class: 'cost-child', hidden: '' }, h('td', { text: r.model }), h('td', { text: commas(num(r.calls)) }), h('td', { text: tok(r) }), h('td', { text: cost(r) })))
    const btn = h('button', { type: 'button', class: 'cost-toggle', 'aria-expanded': costOpen.has(t) ? 'true' : 'false', text: `${t} (${kids.length} model${kids.length === 1 ? '' : 's'})` })
    const show = () => { const o = btn.getAttribute('aria-expanded') === 'true'; kidRows.forEach(k => { k.hidden = !o }) }
    btn.addEventListener('click', () => { const o = btn.getAttribute('aria-expanded') !== 'true'; btn.setAttribute('aria-expanded', o); o ? costOpen.add(t) : costOpen.delete(t); show() })
    show()
    body.push(h('tr', { style: 'font-weight:600' }, h('td', {}, btn), h('td', { text: commas(kids.reduce((a, r) => a + num(r.calls), 0)) }), h('td', { text: compact(kids.reduce((a, r) => a + num(r.input_tokens) + num(r.output_tokens) + num(r.cache_read_tokens) + num(r.cache_write_tokens), 0)) }), h('td', { text: usd(tot ? tot.cost_usd : 0) })), ...kidRows)
  }
  const grand = rows.find(r => r.tool === 'ALL' && isTotal(r))
  if (grand && !st.provider) body.push(h('tr', { style: 'font-weight:600' }, h('td', { text: 'All providers' }), h('td', {}), h('td', {}), h('td', { text: usd(grand.cost_usd) })))
  $('#cost-tbl').replaceChildren(h('caption', { class: 'sr-only', text: 'Estimated cost per provider, expandable to models' }),
    h('thead', {}, h('tr', {}, ...['Provider / model', 'Calls', 'Tokens', 'Cost (USD)'].map(t => h('th', { scope: 'col', text: t })))),
    h('tbody', {}, ...(body.length ? body : [h('tr', {}, h('td', { colspan: 4, class: 'empty', text: 'No cost data yet. Run the nightly job again.' }))])))
}
const costOpen = new Set()

function spark(values) {
  const w = 84, hh = 22, max = Math.max(1, ...values), n = values.length
  const pt = (v, i) => `${n < 2 ? w / 2 : (i / (n - 1)) * (w - 6) + 3},${hh - 4 - (v / max) * (hh - 8)}`
  const last = pt(values[n - 1] || 0, n - 1).split(',')
  return s('svg', { class: 'spark', viewBox: `0 0 ${w} ${hh}`, width: w, height: hh, role: 'img', 'aria-label': `Calls per day, peak ${max}` }, s('polyline', { points: values.map(pt).join(' ') }), s('circle', { cx: last[0], cy: last[1], r: 3.5 }))
}
function topList(box, rows, keyOf) {
  const dates = view.map(v => v.date), inR = new Set(dates)
  const by = new Map()
  for (const r of rows) {
    if (!inR.has(r.date)) continue
    const k = keyOf(r)
    const e = by.get(k) || { n: 0, per: new Map() }
    e.n += r.calls; e.per.set(r.date, (e.per.get(r.date) || 0) + r.calls); by.set(k, e)
  }
  const list = [...by].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0])).slice(0, 10)
  if (!list.length) { box.replaceChildren(h('p', { class: 'empty', text: 'None in this range.' })); return }
  const max = list[0][1].n
  box.replaceChildren(...list.map(([k, e]) => h('div', { class: 'top-row' },
    h('span', { class: 'n', title: k, text: k }),
    h('span', { class: 'b' }, h('i', { style: `width:${Math.max(2, (e.n / max) * 70)}%` }), h('span', { text: commas(e.n) })),
    spark(dates.map(d => e.per.get(d) || 0)))))
}
// ---------- hook-injected tools ----------
// Retroactive estimate: tokens the model router moved off Opus, repriced at Opus rates. All-time, ignores the date range.
const ROUTER_SAVED = 1.18e9
function renderHooks() {
  const dates = view.map(v => v.date), inR = new Set(dates)
  const by = new Map()
  for (const r of hkrows) {
    if (!inR.has(r.date)) continue
    const e = by.get(r.source) || { fires: 0, tok: 0, saved: 0, calls: 0, per: new Map() }
    if (r.event === 'savings') { e.calls += r.fires; e.saved += r.saved } else { e.fires += r.fires; e.tok += r.tok }
    e.per.set(r.date, (e.per.get(r.date) || 0) + r.fires)
    by.set(r.source, e)
  }
  const head = h('thead', {}, h('tr', {}, ...['Tool', 'Fires', 'Injected', 'Saved', 'Net', 'Per day'].map(t => h('th', { scope: 'col', text: t }))))
  const list = [...by].sort((a, b) => b[1].tok - a[1].tok)
  const body = list.length
    ? list.map(([k, e]) => { if (k === 'model-router') Object.assign(e, { saved: ROUTER_SAVED, calls: 0, est: true }); return h('tr', {}, h('td', { text: k }), h('td', { text: commas(e.fires) }), h('td', { text: e.tok ? compact(e.tok) : '–' }),
        h('td', { text: e.est ? compact(e.saved) : e.calls ? `${compact(e.saved)} (${commas(e.calls)} calls)` : '–' }), h('td', { text: e.est || e.calls ? compact(e.saved - e.tok) : '–' }),
        h('td', {}, spark(dates.map(d => e.per.get(d) || 0)))) })
    : [h('tr', {}, h('td', { text: 'None in this range.' }))]
  $('#hooks-tbl').replaceChildren(h('caption', { class: 'sr-only', text: 'Hook-injected tools in the range' }), head, h('tbody', {}, ...body))
}

// ---------- wiring ----------
function renderAll() {
  compute()
  document.querySelectorAll('#range-seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.r === st.range)))
  $('#from-l').hidden = $('#to-l').hidden = st.range !== 'custom'
  $('#filter-note').textContent = (st.model || st.provider) ? 'Sessions and messages are not split by model or provider, so they still show everything.' : ''
  renderKpis(); drawDaily(); renderMix(); renderModels(); renderCost(); renderHooks()
}
$('#range-seg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; st.range = b.dataset.r; renderAll() })
$('#from').addEventListener('change', e => { st.from = e.target.value; renderAll() })
$('#to').addEventListener('change', e => { st.to = e.target.value; renderAll() })
$('#model').addEventListener('change', e => { st.model = e.target.value; renderAll() })
$('#provider').addEventListener('change', e => { st.provider = e.target.value; renderAll() })
$('#cache').addEventListener('change', e => { st.cache = e.target.checked; renderAll() })
let lastW = 0, raf = 0
new ResizeObserver(() => {
  const w = document.body.clientWidth
  if (w === lastW) return
  lastW = w; cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => { drawDaily(); drawLocal() })
}).observe(document.body)
// ---------- local models (own area: not in MODELS, filters or cost) ----------
let localRows = []
// Calls per day over the whole local history, stacked by model, gaps filled with zero days.
function drawLocal() {
  const box = $('#local-chart')
  if (!localRows.length) { box.replaceChildren(); $('#local-legend').replaceChildren(); return }
  const models = [...new Set(localRows.map(r => r.model))].sort()
  const color = m => `var(--s${models.indexOf(m) % 14 + 1})`
  const by = new Map(localRows.map(r => [`${r.date}|${r.model}`, r.calls]))
  const dates = [], end = new Date(localRows.reduce((a, r) => (r.date > a ? r.date : a), '') + 'T12:00:00')
  for (const d = new Date(localRows.reduce((a, r) => (r.date < a ? r.date : a), '9') + 'T12:00:00'); d <= end; d.setDate(d.getDate() + 1)) dates.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
  $('#local-legend').replaceChildren(...models.map(m => h('span', {}, h('i', { class: 'key', style: `background:${color(m)}` }), m)))
  colChart(box, dates.map(d => ({ title: d, xlabel: d.slice(5), partial: d >= TODAY, segs: models.map(m => ({ color: color(m), value: by.get(`${d}|${m}`) || 0, name: m })) })), { label: 'Local model calls per day', totalName: 'calls', height: 200, labelGap: 46 })
}
function renderLocal() {
  const rows = (P.csv['usage-local.csv'] ? parseCsv(P.csv['usage-local.csv']) : []).map(r => ({ ...r, calls: num(r.calls), seconds: num(r.seconds) }))
  localRows = rows
  drawLocal()
  const tok = v => (v === '' ? '–' : compact(num(v)))
  const dur = sec => (sec < 90 ? `${Math.round(sec)} s` : sec < 5400 ? `${Math.round(sec / 60)} min` : `${(sec / 3600).toFixed(1)} h`)
  const head = cols => h('thead', {}, h('tr', {}, ...cols.map(t => h('th', { scope: 'col', text: t }))))
  const empty = t => [h('caption', { class: 'sr-only', text: t }), h('tbody', {}, h('tr', {}, h('td', { text: 'No local model use recorded yet.' })))]
  if (!rows.length) { $('#local-tbl').replaceChildren(...empty('Local models')); $('#local-days').replaceChildren(); return }
  const by = new Map()
  for (const r of rows) {
    const a = by.get(r.model) || { calls: 0, seconds: 0, i: '', o: '', last: '' }
    a.calls += r.calls; a.seconds += r.seconds; if (r.date > a.last) a.last = r.date
    if (r.input_tokens !== '') a.i = num(a.i) + num(r.input_tokens)
    if (r.output_tokens !== '') a.o = num(a.o) + num(r.output_tokens)
    by.set(r.model, a)
  }
  $('#local-tbl').replaceChildren(h('caption', { class: 'sr-only', text: 'Calls, time and tokens per local model, all time' }), head(['Model', 'Calls', 'Time', 'Input tokens', 'Output tokens', 'Last used']),
    h('tbody', {}, ...[...by].sort((a, b) => b[1].calls - a[1].calls).map(([m, a]) => h('tr', {}, h('td', { text: m }), h('td', { text: commas(a.calls) }), h('td', { text: dur(a.seconds) }), h('td', { text: tok(a.i) }), h('td', { text: tok(a.o) }), h('td', { text: a.last })))))
  $('#local-days').replaceChildren(h('caption', { class: 'sr-only', text: 'Local model use by day, newest first' }), head(['Date', 'Model', 'Calls', 'Time', 'Input tokens', 'Output tokens']),
    h('tbody', {}, ...rows.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.model.localeCompare(b.model))).slice(0, 60).map(r => h('tr', {}, h('td', { text: r.date }), h('td', { text: r.model }), h('td', { text: commas(r.calls) }), h('td', { text: dur(r.seconds) }), h('td', { text: tok(r.input_tokens) }), h('td', { text: tok(r.output_tokens) })))))
}
renderHeader()
renderAll()
renderLocal()
