const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { renderChart, chartKey, gaugeLegendKey, renderGaugeLegend } = require('../src/chart.js');

const doc = new JSDOM('<body></body>').window.document;
const range = { start: '2026-05-01', end: '2026-10-31' };
const rows = [
  { date: '2026-05-01', vo2MaxPrecise: 50 },
  { date: '2026-08-01', vo2MaxPrecise: 51.2 },
  { date: '2026-10-31', vo2MaxPrecise: 52 },
];

test('renders an svg line with one dot per point and axis labels', () => {
  const el = renderChart(doc, rows, range);
  assert.equal(el.getAttribute('data-gvp'), 'chart');
  assert.equal(el.getAttribute('data-gvp-key'), '2026-05-01_2026-10-31');
  assert.equal(el.querySelectorAll('svg').length, 1);
  assert.equal(el.querySelector('svg').getAttribute('viewBox'), '0 0 870 400');
  assert.equal(el.querySelectorAll('[data-gvp="dot"]').length, 3);
  assert.match(el.querySelector('[data-gvp="line"]').getAttribute('d'), /^M48 370 L/);
  const texts = [...el.querySelectorAll('svg text')].map((t) => t.textContent);
  assert.ok(texts.includes('50.0'));
  assert.ok(texts.includes('May'));
  assert.ok(texts.includes('ml/kg/min'));
});

test('empty range renders a message and no svg', () => {
  const el = renderChart(doc, [], range);
  assert.equal(el.querySelector('svg'), null);
  assert.equal(el.textContent, 'No VO₂ max data in this range.');
  assert.equal(el.getAttribute('data-gvp'), 'chart');
});

test('hover shows the nearest point in the tooltip, leaving hides it', () => {
  const el = renderChart(doc, rows, range);
  doc.body.appendChild(el);
  const svg = el.querySelector('svg');
  const tip = el.querySelector('[data-gvp="tooltip"]');
  assert.equal(tip.style.display, 'none');
  // jsdom reports a zero-size rect, so clientX is used as the svg x directly
  svg.dispatchEvent(new doc.defaultView.MouseEvent('mousemove', { clientX: 850, bubbles: true }));
  assert.equal(tip.style.display, 'block');
  assert.equal(tip.textContent, '31 Oct 2026: 52.0');
  svg.dispatchEvent(new doc.defaultView.MouseEvent('mouseleave', { bubbles: true }));
  assert.equal(tip.style.display, 'none');
});

test('renderChart with valid start and invalid end returns empty-message wrapper', () => {
  // Rows pass string filter but dayNum('zzz') is NaN; guard prevents the error
  const testRows = [{ date: '2026-06-01', vo2MaxPrecise: 50 }];
  const el = renderChart(doc, testRows, { start: '2026-05-01', end: 'zzz' });
  assert.equal(el.querySelector('svg'), null);
  assert.equal(el.textContent, 'No VO₂ max data in this range.');
  assert.equal(el.getAttribute('data-gvp'), 'chart');
});

test('renderChart with invalid start and valid end returns empty-message wrapper', () => {
  // Rows pass string filter ('2026-06-01' >= '2026-06-1x') but dayNum('2026-06-1x') is NaN
  const testRows = [{ date: '2026-06-01', vo2MaxPrecise: 50 }];
  const el = renderChart(doc, testRows, { start: '2026-06-1x', end: '2026-10-31' });
  assert.equal(el.querySelector('svg'), null);
  assert.equal(el.textContent, 'No VO₂ max data in this range.');
  assert.equal(el.getAttribute('data-gvp'), 'chart');
});

test('tooltip aligns left at the left edge', () => {
  const el = renderChart(doc, rows, range);
  doc.body.appendChild(el);
  const svg = el.querySelector('svg');
  const tip = el.querySelector('[data-gvp="tooltip"]');
  svg.dispatchEvent(new doc.defaultView.MouseEvent('mousemove', { clientX: 48, bubbles: true }));
  assert.equal(tip.style.display, 'block');
  assert.match(tip.style.transform, /^translate\(0/);
});

test('tooltip aligns right at the right edge', () => {
  const el = renderChart(doc, rows, range);
  doc.body.appendChild(el);
  const svg = el.querySelector('svg');
  const tip = el.querySelector('[data-gvp="tooltip"]');
  svg.dispatchEvent(new doc.defaultView.MouseEvent('mousemove', { clientX: 850, bubbles: true }));
  assert.equal(tip.style.display, 'block');
  assert.match(tip.style.transform, /^translate\(-100%/);
});

test('tooltip centers in the middle', () => {
  const el = renderChart(doc, rows, range);
  doc.body.appendChild(el);
  const svg = el.querySelector('svg');
  const tip = el.querySelector('[data-gvp="tooltip"]');
  svg.dispatchEvent(new doc.defaultView.MouseEvent('mousemove', { clientX: 435, bubbles: true }));
  assert.equal(tip.style.display, 'block');
  assert.match(tip.style.transform, /^translate\(-50%/);
});

test('tooltip positions below point near the top and above point in the middle', () => {
  // Create series with high spread to get one point near top (y fraction < 0.15) and one mid-height
  const wideRows = [
    { date: '2026-05-01', vo2MaxPrecise: 50 },
    { date: '2026-10-31', vo2MaxPrecise: 55 },
  ];
  const wideRange = { start: '2026-05-01', end: '2026-10-31' };
  const el = renderChart(doc, wideRows, wideRange);
  doc.body.appendChild(el);
  const svg = el.querySelector('svg');
  const tip = el.querySelector('[data-gvp="tooltip"]');

  // Hover the top point (highest value, lowest y pixel, y fraction < 0.15)
  svg.dispatchEvent(new doc.defaultView.MouseEvent('mousemove', { clientX: 856, bubbles: true }));
  assert.equal(tip.style.display, 'block');
  assert.match(tip.style.transform, /translate\([^,]+,40%\)/);

  // Hover the bottom point (lowest value, highest y pixel, y fraction > 0.15)
  svg.dispatchEvent(new doc.defaultView.MouseEvent('mousemove', { clientX: 48, bubbles: true }));
  assert.equal(tip.style.display, 'block');
  assert.match(tip.style.transform, /translate\([^,]+,-140%\)/);
});

const legend = {
  label: 'Men 30-39',
  current: 'Excellent',
  rows: [
    { category: 'Superior', text: '54+', current: false },
    { category: 'Excellent', text: '48.3–54', current: true },
    { category: 'Good', text: '44–48.3', current: false },
    { category: 'Fair', text: '40.5–44', current: false },
    { category: 'Poor', text: '<40.5', current: false },
  ],
};

test('chartKey is the range, plus the legend identity when there is one', () => {
  assert.equal(chartKey(range), '2026-05-01_2026-10-31');
  assert.equal(chartKey(range, null), '2026-05-01_2026-10-31');
  assert.equal(chartKey(range, legend), '2026-05-01_2026-10-31|Men 30-39|Excellent');
  assert.equal(chartKey(range, { ...legend, current: null }), '2026-05-01_2026-10-31|Men 30-39|');
});

test('legend panel lists the ranges to the right of the chart and marks the current one', () => {
  const el = renderChart(doc, rows, range, undefined, legend);
  assert.equal(el.getAttribute('data-gvp-key'), '2026-05-01_2026-10-31|Men 30-39|Excellent');
  const panel = el.querySelector('[data-gvp="legend"]');
  assert.ok(panel);
  assert.equal(panel.previousElementSibling.querySelector('svg') !== null, true); // legend sits after the chart column
  assert.match(panel.firstElementChild.textContent, /VO₂ max ranges, Men 30-39/);
  const rowEls = [...panel.querySelectorAll('[data-gvp="legend-row"]')];
  assert.deepEqual(rowEls.map((r) => r.textContent), ['Superior54+', 'Excellent48.3–54', 'Good44–48.3', 'Fair40.5–44', 'Poor<40.5']);
  assert.deepEqual(rowEls.map((r) => r.hasAttribute('data-gvp-current')), [false, true, false, false, false]);
});

test('without a legend there is no panel and the key is the range only', () => {
  const el = renderChart(doc, rows, range);
  assert.equal(el.querySelector('[data-gvp="legend"]'), null);
  assert.equal(el.getAttribute('data-gvp-key'), '2026-05-01_2026-10-31');
});

test('an empty range shows only the message, even with a legend', () => {
  const el = renderChart(doc, [], range, undefined, legend);
  assert.equal(el.querySelector('[data-gvp="legend"]'), null);
  assert.equal(el.textContent, 'No VO₂ max data in this range.');
});

test('hover still works when the legend is present', () => {
  const el = renderChart(doc, rows, range, undefined, legend);
  doc.body.appendChild(el);
  el.querySelector('svg').dispatchEvent(new doc.defaultView.MouseEvent('mousemove', { clientX: 850, bubbles: true }));
  assert.equal(el.querySelector('[data-gvp="tooltip"]').textContent, '31 Oct 2026: 52.0');
});

test('gaugeLegendKey is the legend label plus the current category', () => {
  assert.equal(gaugeLegendKey(legend), 'Men 30-39|Excellent');
  assert.equal(gaugeLegendKey({ ...legend, current: null }), 'Men 30-39|');
});

test('renderGaugeLegend is an absolutely positioned ranges list with the current row marked', () => {
  const el = renderGaugeLegend(doc, legend);
  assert.equal(el.getAttribute('data-gvp'), 'gauge-legend');
  assert.equal(el.getAttribute('data-gvp-key'), 'Men 30-39|Excellent');
  assert.match(el.style.cssText, /position:\s*absolute/);
  assert.match(el.querySelector('[data-gvp="legend"]').firstElementChild.textContent, /^VO₂ max ranges, Men 30-39$/);
  const rowEls = [...el.querySelectorAll('[data-gvp="legend-row"]')];
  assert.equal(rowEls.length, 5);
  assert.deepEqual(rowEls.map((r) => r.hasAttribute('data-gvp-current')), [false, true, false, false, false]);
});

test('unit label sits clear of the top y tick label', () => {
  const el = renderChart(doc, rows, range);
  const texts = [...el.querySelectorAll('svg text')];
  const unit = texts.find((t) => t.textContent === 'ml/kg/min');
  const topTick = texts.filter((t) => t.getAttribute('text-anchor') === 'end').map((t) => Number(t.getAttribute('y'))).sort((a, b) => a - b)[0];
  const unitBaseline = Number(unit.getAttribute('y'));
  // the unit label's baseline plus a descender must end above the top tick label's cap height (14px font)
  assert.ok(unitBaseline + 3 < topTick - 11, `unit baseline ${unitBaseline} too close to top tick baseline ${topTick}`);
});

test('legend title keeps "Men 30-39" together so it wraps before it, not inside it', () => {
  const el = renderChart(doc, rows, range, undefined, legend);
  const title = el.querySelector('[data-gvp="legend"]').firstElementChild;
  assert.equal(title.textContent, 'VO₂ max ranges, Men 30-39');
  const nowrap = [...title.querySelectorAll('span')].find((s) => s.textContent === 'Men 30-39');
  assert.ok(nowrap, 'label is in its own span');
  assert.match(nowrap.style.whiteSpace, /nowrap/);
});
