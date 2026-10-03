const test = require('node:test');
const assert = require('node:assert/strict');
const { toCsv, toJson, filename } = require('../src/format.js');

const rows = [
  { date: '2026-10-01', sport: 'running', vo2MaxPrecise: 52.2, vo2MaxRounded: 52, fitnessAge: null },
  { date: '2026-10-02', sport: 'cycling', vo2MaxPrecise: 48.4, vo2MaxRounded: 48, fitnessAge: 35 },
];

test('toCsv writes a header and keeps the precise decimal', () => {
  assert.equal(
    toCsv(rows),
    'date,sport,vo2max_precise,vo2max_rounded,fitness_age\r\n' +
      '2026-10-01,running,52.2,52,\r\n' +
      '2026-10-02,cycling,48.4,48,35\r\n'
  );
});

test('toCsv quotes cells that contain commas or quotes', () => {
  const out = toCsv([{ date: 'd', sport: 'a,"b"', vo2MaxPrecise: null, vo2MaxRounded: null, fitnessAge: null }]);
  assert.equal(out.split('\r\n')[1], 'd,"a,""b""",,,');
});

test('toCsv with no rows is just the header', () => {
  assert.equal(toCsv([]), 'date,sport,vo2max_precise,vo2max_rounded,fitness_age\r\n');
});

test('toJson keeps the raw response and the range', () => {
  const raw = [{ generic: { vo2MaxPreciseValue: 52.2 } }];
  const parsed = JSON.parse(toJson(raw, { start: '2026-01-01', end: '2026-10-03' }));
  assert.deepEqual(parsed.range, { start: '2026-01-01', end: '2026-10-03' });
  assert.deepEqual(parsed.days, raw);
  assert.equal(typeof parsed.source, 'string');
});

test('filename', () => {
  assert.equal(filename({ start: '2026-01-01', end: '2026-10-03' }, 'csv'), 'vo2max-2026-01-01_2026-10-03.csv');
  assert.equal(filename({ start: '2024-02-09', end: '2026-10-03', allTime: true }, 'json'), 'vo2max-all-time.json');
});
