const test = require('node:test');
const assert = require('node:assert/strict');
const { todayIso, shiftIso, parseRangeLabel } = require('../src/dates.js');

const NOW = new Date(2026, 9, 3); // 3 Oct 2026, local

test('todayIso uses the local calendar date', () => {
  assert.equal(todayIso(NOW), '2026-10-03');
});

test('shiftIso moves by days across month and year ends', () => {
  assert.equal(shiftIso('2026-10-03', -365), '2025-10-03');
  assert.equal(shiftIso('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftIso('2026-02-28', 1), '2026-03-01');
});

test('parseRangeLabel: no years means the current year', () => {
  assert.deepEqual(parseRangeLabel('Sep 7 - Oct 3', NOW), { start: '2026-09-07', end: '2026-10-03' });
  assert.deepEqual(parseRangeLabel('May 1 - Oct 31', NOW), { start: '2026-05-01', end: '2026-10-31' });
});

test('parseRangeLabel: explicit years', () => {
  assert.deepEqual(parseRangeLabel('Nov 1, 2025 - Oct 31, 2026', NOW), { start: '2025-11-01', end: '2026-10-31' });
});

test('parseRangeLabel: start month after end month without years spans a year boundary', () => {
  assert.deepEqual(parseRangeLabel('Nov 1 - Feb 28', new Date(2026, 1, 10)), { start: '2025-11-01', end: '2026-02-28' });
});

test('parseRangeLabel rejects anything that is not exactly a label', () => {
  assert.equal(parseRangeLabel('Most Recent', NOW), null);
  assert.equal(parseRangeLabel('ExportSep 7 - Oct 3Most Recent', NOW), null);
  assert.equal(parseRangeLabel('', NOW), null);
});
