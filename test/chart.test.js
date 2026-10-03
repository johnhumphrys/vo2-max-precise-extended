const test = require('node:test');
const assert = require('node:assert/strict');
const { niceStep, yScale, xTicks, layout, nearestPoint, formatDate } = require('../src/chart.js');

test('niceStep picks 1/2/5 x 10^n', () => {
  assert.equal(niceStep(1.5, 5), 0.5);
  assert.equal(niceStep(10, 5), 2);
  assert.equal(niceStep(100, 5), 20);
  assert.equal(niceStep(0.6, 5), 0.2);
});

test('yScale pads to whole steps and lists ticks', () => {
  assert.deepEqual(yScale([51.2, 52.3, 50.8]), { min: 50.5, max: 52.5, step: 0.5, ticks: [50.5, 51, 51.5, 52, 52.5] });
});

test('yScale copes with a flat series', () => {
  const s = yScale([52.3, 52.3]);
  assert.equal(s.min, 52.2);
  assert.equal(s.max, 52.4);
  assert.equal(s.ticks.length, 2);
});

test('xTicks: first-of-month for long ranges', () => {
  assert.deepEqual(xTicks({ start: '2026-05-01', end: '2026-10-31' }).map((t) => t.label), ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']);
  assert.deepEqual(xTicks({ start: '2026-05-15', end: '2026-08-20' }).map((t) => t.label), ['Jun', 'Jul', 'Aug']);
});

test('xTicks: weekly for short ranges', () => {
  assert.deepEqual(xTicks({ start: '2026-09-07', end: '2026-10-03' }).map((t) => t.label), ['7 Sep', '14 Sep', '21 Sep', '28 Sep']);
});

test('xTicks: labels carry a 2-digit year when the range exceeds 400 days', () => {
  const labels = xTicks({ start: '2025-01-01', end: '2026-06-30' }).map((t) => t.label);
  assert.equal(labels[0], "Jan '25");
  assert.equal(labels[12], "Jan '26");
});

const size = { width: 870, height: 400 };
const range = { start: '2026-05-01', end: '2026-10-31' };

test('layout maps range edges to the plot edges and values to y', () => {
  const rows = [
    { date: '2026-05-01', vo2MaxPrecise: 50 },
    { date: '2026-10-31', vo2MaxPrecise: 52 },
  ];
  const l = layout(rows, range, size);
  assert.deepEqual(l.plot, { left: 48, top: 26, right: 856, bottom: 370 });
  assert.deepEqual(l.points.map((p) => [p.x, p.y, p.date, p.value]), [
    [48, 370, '2026-05-01', 50],
    [856, 26, '2026-10-31', 52],
  ]);
  assert.equal(l.path, 'M48 370 L856 26');
  assert.equal(l.yTicks[0].label, '50.0');
  assert.equal(l.yTicks.length, 5);
  assert.equal(l.xTicks.length, 6);
  assert.equal(l.xTicks[0].x, 48);
});

test('layout ignores rows outside the range and returns null when nothing is left', () => {
  const rows = [{ date: '2026-04-30', vo2MaxPrecise: 50 }, { date: '2026-06-01', vo2MaxPrecise: 51 }];
  assert.equal(layout(rows, range, size).points.length, 1);
  assert.equal(layout([{ date: '2025-01-01', vo2MaxPrecise: 50 }], range, size), null);
  assert.equal(layout([], range, size), null);
});

test('nearestPoint picks the closest x', () => {
  const pts = [{ x: 10 }, { x: 100 }, { x: 400 }];
  assert.equal(nearestPoint(pts, 90).x, 100);
  assert.equal(nearestPoint(pts, 1000).x, 400);
  assert.equal(nearestPoint([], 5), null);
});

test('formatDate', () => {
  assert.equal(formatDate('2026-10-03'), '3 Oct 2026');
  assert.equal(formatDate('2025-01-15'), '15 Jan 2025');
});

test('xTicks: bad start date returns empty', () => {
  assert.deepEqual(xTicks({ start: 'bad', end: '2026-10-31' }), []);
});

test('xTicks: reversed range returns empty (behaviour pin)', () => {
  // Reversed range: e - s is negative, so weekly loop never runs and monthly loop produces nothing
  assert.deepEqual(xTicks({ start: '2026-10-31', end: '2026-05-01' }), []);
});

test('layout: valid start with invalid end returns null', () => {
  // Rows pass string filter (2026-06-01 >= 2026-05-01 && 2026-06-01 <= 'zzz' in string compare)
  // but dayNum('zzz') is NaN; guard prevents division by NaN
  const rows = [{ date: '2026-06-01', vo2MaxPrecise: 50 }];
  assert.equal(layout(rows, { start: '2026-05-01', end: 'zzz' }, size), null);
});

test('layout: invalid start with valid end returns null', () => {
  // Rows pass string filter ('2026-06-01' >= '2026-06-1x' && '2026-06-01' <= '2026-10-31' in string compare)
  // but dayNum('2026-06-1x') is NaN; guard prevents division by NaN
  const rows = [{ date: '2026-06-01', vo2MaxPrecise: 50 }];
  assert.equal(layout(rows, { start: '2026-06-1x', end: '2026-10-31' }, size), null);
});
