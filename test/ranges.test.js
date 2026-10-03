const test = require('node:test');
const assert = require('node:assert/strict');
const { ageOn, bracketFor, parseEntries, formatRange, categoryOf, describe } = require('../src/ranges.js');

const NOW = new Date(2026, 9, 3); // 3 Oct 2026, local
// Male 30-39 thresholds are Garmin's published values; the FEMALE row is synthetic test data.
const TABLE = {
  MALE: {
    '20-29': [{ category: 'Superior', max: '', min: '55' }, { category: 'Poor', max: '41', min: '' }],
    '30-39': [
      { category: 'Superior', max: '', min: '54' },
      { category: 'Excellent', max: '54', min: '48.3' },
      { category: 'Good', max: '48.3', min: '44' },
      { category: 'Fair', max: '44', min: '40.5' },
      { category: 'Poor', max: '40.5', min: '' },
    ],
  },
  FEMALE: {
    '30-39': [{ category: 'Superior', max: '', min: '47' }, { category: 'Poor', max: '34', min: '' }],
  },
};

test('ageOn counts completed years', () => {
  assert.equal(ageOn('1990-06-15', NOW), 36);
  assert.equal(ageOn('1990-10-03', NOW), 36); // birthday today
  assert.equal(ageOn('1990-10-04', NOW), 35); // birthday tomorrow
  assert.equal(ageOn('2026-10-03', NOW), 0);
});

test('ageOn rejects missing, malformed and future dates', () => {
  assert.equal(ageOn(null, NOW), null);
  assert.equal(ageOn('', NOW), null);
  assert.equal(ageOn('not a date', NOW), null);
  assert.equal(ageOn('2030-01-01', NOW), null);
});

test('bracketFor finds the age bracket, case-insensitive on gender', () => {
  assert.equal(bracketFor(TABLE, 'MALE', 36).key, '30-39');
  assert.equal(bracketFor(TABLE, 'male', 20).key, '20-29');
  assert.equal(bracketFor(TABLE, 'FEMALE', 39).key, '30-39');
});

test('bracketFor returns null outside the table or for unknown input', () => {
  assert.equal(bracketFor(TABLE, 'MALE', 19), null);
  assert.equal(bracketFor(TABLE, 'MALE', 80), null);
  assert.equal(bracketFor(TABLE, 'OTHER', 36), null);
  assert.equal(bracketFor(TABLE, null, 36), null);
  assert.equal(bracketFor(null, 'MALE', 36), null);
  assert.equal(bracketFor(TABLE, 'MALE', null), null);
});

test('parseEntries turns strings into numbers and empty strings into null', () => {
  assert.deepEqual(parseEntries(TABLE.MALE['30-39']).map((e) => [e.category, e.min, e.max]), [
    ['Superior', 54, null],
    ['Excellent', 48.3, 54],
    ['Good', 44, 48.3],
    ['Fair', 40.5, 44],
    ['Poor', null, 40.5],
  ]);
  assert.deepEqual(parseEntries(undefined), []);
});

test('formatRange', () => {
  assert.equal(formatRange({ min: 54, max: null }), '54+');
  assert.equal(formatRange({ min: 48.3, max: 54 }), '48.3–54');
  assert.equal(formatRange({ min: null, max: 40.5 }), '<40.5');
  assert.equal(formatRange({ min: null, max: null }), '');
});

test('categoryOf: lower bound inclusive, upper bound exclusive', () => {
  const e = parseEntries(TABLE.MALE['30-39']);
  assert.equal(categoryOf(e, 54), 'Superior');
  assert.equal(categoryOf(e, 53.9), 'Excellent');
  assert.equal(categoryOf(e, 48.3), 'Excellent');
  assert.equal(categoryOf(e, 44), 'Good');
  assert.equal(categoryOf(e, 40.5), 'Fair');
  assert.equal(categoryOf(e, 40.4), 'Poor');
  assert.equal(categoryOf(e, 10), 'Poor');
  assert.equal(categoryOf(e, null), null);
});

test('describe builds the labelled rows and marks the current category', () => {
  const d = describe(TABLE, { gender: 'MALE', birthDate: '1990-06-15' }, NOW, 52.3);
  assert.equal(d.label, 'Men 30-39');
  assert.equal(d.current, 'Excellent');
  assert.deepEqual(d.rows, [
    { category: 'Superior', text: '54+', current: false },
    { category: 'Excellent', text: '48.3–54', current: true },
    { category: 'Good', text: '44–48.3', current: false },
    { category: 'Fair', text: '40.5–44', current: false },
    { category: 'Poor', text: '<40.5', current: false },
  ]);
});

test('describe: no value means no current row; women are labelled Women', () => {
  const d = describe(TABLE, { gender: 'FEMALE', birthDate: '1990-06-15' }, NOW, null);
  assert.equal(d.label, 'Women 30-39');
  assert.equal(d.current, null);
  assert.equal(d.rows.some((r) => r.current), false);
});

test('describe returns null when it cannot place the user', () => {
  assert.equal(describe(TABLE, null, NOW, 50), null);
  assert.equal(describe(TABLE, { gender: 'MALE', birthDate: null }, NOW, 50), null);
  assert.equal(describe(TABLE, { gender: 'MALE', birthDate: '2010-01-01' }, NOW, 50), null); // age 16, no bracket
  assert.equal(describe(null, { gender: 'MALE', birthDate: '1990-06-15' }, NOW, 50), null);
});
