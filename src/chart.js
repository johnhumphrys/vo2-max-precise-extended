(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GVP = Object.assign(root.GVP || {}, api);
})(typeof self !== 'undefined' ? self : globalThis, function () {
  const MARGIN = { left: 48, right: 14, top: 26, bottom: 30 }; // top leaves room for the unit label
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAY_MS = 86400000;
  const WEEKLY_MAX_DAYS = 45;
  const YEAR_LABEL_MIN_DAYS = 400;

  const round6 = (n) => Math.round(n * 1e6) / 1e6;
  const round2 = (n) => Math.round(n * 100) / 100;
  const dayNum = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / DAY_MS;
  };

  function niceStep(span, targetTicks) {
    const raw = span / targetTicks;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / pow;
    const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return round6(nice * pow);
  }

  function yScale(values) {
    const vmin = Math.min(...values);
    const vmax = Math.max(...values);
    const step = niceStep(Math.max(vmax - vmin, 1), 5);
    const min = round6(Math.floor(vmin / step) * step);
    let max = round6(Math.ceil(vmax / step) * step);
    if (max === min) max = round6(max + step);
    const ticks = [];
    for (let v = min; v <= max + step / 2; v = round6(v + step)) ticks.push(v);
    return { min, max, step, ticks };
  }

  function xTicks(range) {
    const s = dayNum(range.start);
    const e = dayNum(range.end);
    if (!Number.isFinite(s) || !Number.isFinite(e)) return [];
    const out = [];
    if (e - s <= WEEKLY_MAX_DAYS) {
      for (let d = s; d <= e; d += 7) {
        const dt = new Date(d * DAY_MS);
        out.push({ day: d, label: `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}` });
      }
      return out;
    }
    const withYear = e - s > YEAR_LABEL_MIN_DAYS;
    const start = new Date(s * DAY_MS);
    const y = start.getUTCFullYear();
    let m = start.getUTCDate() === 1 ? start.getUTCMonth() : start.getUTCMonth() + 1;
    for (;; m++) {
      const d = Date.UTC(y, m, 1) / DAY_MS;
      if (d > e) break;
      const dt = new Date(d * DAY_MS);
      const yy = String(dt.getUTCFullYear()).slice(2);
      out.push({ day: d, label: withYear ? `${MONTHS[dt.getUTCMonth()]} '${yy}` : MONTHS[dt.getUTCMonth()] });
    }
    return out;
  }

  function layout(rows, range, size) {
    const s = dayNum(range.start);
    const e = dayNum(range.end);
    if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
    const inRange = rows
      .filter((r) => r.date >= range.start && r.date <= range.end && r.vo2MaxPrecise != null)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (!inRange.length) return null;
    const plot = {
      left: MARGIN.left,
      top: MARGIN.top,
      right: size.width - MARGIN.right,
      bottom: size.height - MARGIN.bottom,
    };
    const eMax = Math.max(e, s + 1);
    const ys = yScale(inRange.map((r) => r.vo2MaxPrecise));
    const X = (day) => round2(plot.left + ((day - s) / (eMax - s)) * (plot.right - plot.left));
    const Y = (v) => round2(plot.bottom - ((v - ys.min) / (ys.max - ys.min)) * (plot.bottom - plot.top));
    const points = inRange.map((r) => ({ x: X(dayNum(r.date)), y: Y(r.vo2MaxPrecise), date: r.date, value: r.vo2MaxPrecise }));
    return {
      plot,
      points,
      path: points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' '),
      yTicks: ys.ticks.map((v) => ({ y: Y(v), label: v.toFixed(ys.step < 1 ? 1 : 0) })),
      xTicks: xTicks(range).map((t) => ({ x: X(t.day), label: t.label })),
    };
  }

  function nearestPoint(points, x) {
    let best = null;
    for (const p of points) if (best === null || Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    return best;
  }

  function formatDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const LINE = 'var(--data-viz-green-primary, #2e8b57)';

  function svgEl(doc, name, attrs, text) {
    const el = doc.createElementNS(SVG_NS, name);
    for (const k of Object.keys(attrs)) el.setAttribute(k, attrs[k]);
    if (text != null) el.textContent = text;
    return el;
  }

  function chartKey(range, legend) {
    return `${range.start}_${range.end}` + (legend ? `|${legend.label}|${legend.current || ''}` : '');
  }

  function renderLegend(doc, legend) {
    const box = doc.createElement('div');
    box.setAttribute('data-gvp', 'legend');
    box.style.cssText = 'flex:0 0 170px;font-size:14px;line-height:1.4';
    const title = doc.createElement('div');
    title.style.cssText = 'font-weight:600;margin-bottom:8px';
    title.appendChild(doc.createTextNode('VO₂ max ranges, '));
    // keep "Men 30-39" in one piece so a narrow box wraps before it, never inside it
    const who = doc.createElement('span');
    who.style.whiteSpace = 'nowrap';
    who.textContent = legend.label;
    title.appendChild(who);
    box.appendChild(title);
    for (const r of legend.rows) {
      const row = doc.createElement('div');
      row.setAttribute('data-gvp', 'legend-row');
      if (r.current) row.setAttribute('data-gvp-current', '');
      row.style.cssText =
        'display:flex;justify-content:space-between;gap:8px;padding:3px 6px;border-radius:4px' +
        (r.current ? ';font-weight:700;background:rgba(46,139,87,0.15)' : '');
      const name = doc.createElement('span');
      name.textContent = r.category;
      const range = doc.createElement('span');
      range.textContent = r.text;
      row.appendChild(name);
      row.appendChild(range);
      box.appendChild(row);
    }
    return box;
  }

  function gaugeLegendKey(legend) {
    return `${legend.label}|${legend.current || ''}`;
  }

  function renderGaugeLegend(doc, legend) {
    const wrap = doc.createElement('div');
    wrap.setAttribute('data-gvp', 'gauge-legend');
    wrap.setAttribute('data-gvp-key', gaugeLegendKey(legend));
    wrap.style.cssText = 'position:absolute;top:0;right:0;width:170px;font:14px "Open Sans","Helvetica Neue",sans-serif';
    wrap.appendChild(renderLegend(doc, legend));
    return wrap;
  }

  function renderChart(doc, rows, range, size = { width: 870, height: 400 }, legend = null) {
    const wrap = doc.createElement('div');
    wrap.setAttribute('data-gvp', 'chart');
    wrap.setAttribute('data-gvp-key', chartKey(range, legend));
    wrap.style.cssText = 'position:relative;display:flex;gap:16px;align-items:flex-start;width:100%;font:14px "Open Sans","Helvetica Neue",sans-serif';
    const lay = layout(rows, range, size);
    if (!lay) {
      wrap.style.padding = '24px';
      wrap.textContent = 'No VO₂ max data in this range.';
      return wrap;
    }
    const { plot } = lay;
    const svg = svgEl(doc, 'svg', {
      viewBox: `0 0 ${size.width} ${size.height}`,
      width: '100%',
      role: 'img',
      'aria-label': 'VO₂ max, precise daily values',
    });
    svg.style.cssText = 'display:block;max-width:100%;height:auto;color:inherit';
    for (const t of lay.yTicks) {
      svg.appendChild(svgEl(doc, 'line', { x1: plot.left, x2: plot.right, y1: t.y, y2: t.y, stroke: 'currentColor', 'stroke-opacity': '0.15' }));
      svg.appendChild(svgEl(doc, 'text', { x: plot.left - 8, y: t.y + 5, 'text-anchor': 'end', fill: 'currentColor', 'font-size': '14' }, t.label));
    }
    for (const t of lay.xTicks) {
      svg.appendChild(svgEl(doc, 'text', { x: t.x, y: plot.bottom + 22, 'text-anchor': 'middle', fill: 'currentColor', 'font-size': '14' }, t.label));
    }
    svg.appendChild(svgEl(doc, 'text', { x: 4, y: 10, fill: 'currentColor', 'font-size': '12', 'fill-opacity': '0.7' }, 'ml/kg/min'));
    svg.appendChild(svgEl(doc, 'path', { 'data-gvp': 'line', d: lay.path, fill: 'none', stroke: LINE, 'stroke-width': '2.5', 'stroke-linejoin': 'round' }));
    for (const p of lay.points) {
      svg.appendChild(svgEl(doc, 'circle', { 'data-gvp': 'dot', cx: p.x, cy: p.y, r: '3', fill: LINE }));
    }
    const marker = svgEl(doc, 'circle', { r: '6', fill: 'none', stroke: LINE, 'stroke-width': '2', visibility: 'hidden' });
    svg.appendChild(marker);

    const tip = doc.createElement('div');
    tip.setAttribute('data-gvp', 'tooltip');
    tip.style.cssText =
      'display:none;position:absolute;pointer-events:none;background:#333;color:#fff;padding:4px 8px;border-radius:4px;font-size:13px;white-space:nowrap';

    svg.addEventListener('mousemove', (e) => {
      const rect = svg.getBoundingClientRect();
      const scale = rect.width ? size.width / rect.width : 1;
      const p = nearestPoint(lay.points, (e.clientX - rect.left) * scale);
      if (!p) return;
      tip.textContent = `${formatDate(p.date)}: ${p.value.toFixed(1)}`;
      tip.style.left = `${(p.x / size.width) * 100}%`;
      tip.style.top = `${(p.y / size.height) * 100}%`;
      const xFrac = p.x / size.width;
      const yFrac = p.y / size.height;
      const hAlign = xFrac > 0.8 ? '-100%' : xFrac < 0.2 ? '0%' : '-50%';
      const vAlign = yFrac < 0.15 ? '40%' : '-140%';
      tip.style.transform = `translate(${hAlign},${vAlign})`;
      tip.style.display = 'block';
      marker.setAttribute('cx', p.x);
      marker.setAttribute('cy', p.y);
      marker.setAttribute('visibility', 'visible');
    });
    svg.addEventListener('mouseleave', () => {
      tip.style.display = 'none';
      marker.setAttribute('visibility', 'hidden');
    });

    const col = doc.createElement('div');
    col.style.cssText = 'position:relative;flex:1;min-width:0';
    col.appendChild(svg);
    col.appendChild(tip);
    wrap.appendChild(col);
    if (legend) wrap.appendChild(renderLegend(doc, legend));
    return wrap;
  }

  return { niceStep, yScale, xTicks, layout, nearestPoint, formatDate, renderChart, chartKey, gaugeLegendKey, renderGaugeLegend };
});
