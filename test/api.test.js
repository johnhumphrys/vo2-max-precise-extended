const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const daily = require('./fixtures/daily.json');
const { getToken, fetchLatest, fetchRange, fetchRangeTable, fetchProfile, rowsFromRaw, GarminError, ALL_TIME_START } = require('../src/api.js');

const docWith = (html) => new JSDOM(html).window.document;
const withToken = () => docWith('<meta name="csrf-token" content="tok-123">');

function stubFetch(status, body) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    return { status, ok: status >= 200 && status < 300, json: async () => body };
  };
  return { fetchFn, calls };
}

test('getToken reads the csrf meta tag, null when absent', () => {
  assert.equal(getToken(withToken()), 'tok-123');
  assert.equal(getToken(docWith('<p>no meta</p>')), null);
});

test('fetchRange calls the daily endpoint with the token and cookies', async () => {
  const { fetchFn, calls } = stubFetch(200, daily);
  const out = await fetchRange('2026-09-30', '2026-10-02', { doc: withToken(), fetchFn });
  assert.equal(out, daily);
  assert.equal(calls[0].url, '/gc-api/metrics-service/metrics/maxmet/daily/2026-09-30/2026-10-02');
  assert.equal(calls[0].init.credentials, 'include');
  assert.equal(calls[0].init.headers['connect-csrf-token'], 'tok-123');
});

test('fetchLatest calls the latest endpoint', async () => {
  const { fetchFn, calls } = stubFetch(200, { generic: null });
  await fetchLatest('2026-10-03', { doc: withToken(), fetchFn });
  assert.equal(calls[0].url, '/gc-api/metrics-service/metrics/maxmet/latest/2026-10-03');
});

test('missing token throws GarminError(no-token) without calling fetch', async () => {
  const { fetchFn, calls } = stubFetch(200, []);
  await assert.rejects(fetchRange('a', 'b', { doc: docWith('<p/>'), fetchFn }), (e) => e instanceof GarminError && e.code === 'no-token');
  assert.equal(calls.length, 0);
});

test('401/403 -> auth, other non-2xx -> http', async () => {
  for (const status of [401, 403]) {
    await assert.rejects(fetchRange('a', 'b', { doc: withToken(), fetchFn: stubFetch(status).fetchFn }), (e) => e.code === 'auth');
  }
  await assert.rejects(fetchRange('a', 'b', { doc: withToken(), fetchFn: stubFetch(500).fetchFn }), (e) => e.code === 'http');
});

test('rowsFromRaw flattens, skips empty days, sorts by date then sport', () => {
  assert.deepEqual(rowsFromRaw(daily), [
    { date: '2026-09-30', sport: 'running', vo2MaxPrecise: 52.1, vo2MaxRounded: 52, fitnessAge: null },
    { date: '2026-10-01', sport: 'cycling', vo2MaxPrecise: 48.4, vo2MaxRounded: 48, fitnessAge: null },
    { date: '2026-10-01', sport: 'running', vo2MaxPrecise: 52.2, vo2MaxRounded: 52, fitnessAge: null },
    { date: '2026-10-02', sport: 'running', vo2MaxPrecise: 52.2, vo2MaxRounded: 52, fitnessAge: 35 },
  ]);
});

test('rowsFromRaw tolerates non-arrays and odd entries', () => {
  assert.deepEqual(rowsFromRaw(null), []);
  assert.deepEqual(rowsFromRaw([null, {}, { generic: {} }]), []);
});

test('ALL_TIME_START predates Garmin Connect', () => {
  assert.equal(ALL_TIME_START, '2000-01-01');
});

test('fetchRangeTable calls the static vo2Max table with the token and cookies', async () => {
  const table = { MALE: {} };
  const { fetchFn, calls } = stubFetch(200, table);
  const out = await fetchRangeTable({ doc: withToken(), fetchFn });
  assert.equal(out, table);
  assert.equal(calls[0].url, '/web-api/web-data/vo2Max/VO2Max.json');
  assert.equal(calls[0].init.credentials, 'include');
  assert.equal(calls[0].init.headers['connect-csrf-token'], 'tok-123');
});

test('fetchProfile keeps only gender and birthDate', async () => {
  const body = { id: 5, userData: { gender: 'MALE', birthDate: '1990-06-15', weight: 70000, height: 180 }, connectDate: 'x' };
  const { fetchFn, calls } = stubFetch(200, body);
  const out = await fetchProfile({ doc: withToken(), fetchFn });
  assert.deepEqual(out, { gender: 'MALE', birthDate: '1990-06-15' });
  assert.equal(calls[0].url, '/gc-api/userprofile-service/userprofile/user-settings/');
});

test('fetchProfile tolerates a response without userData', async () => {
  const { fetchFn } = stubFetch(200, {});
  assert.deepEqual(await fetchProfile({ doc: withToken(), fetchFn }), { gender: null, birthDate: null });
});

test('new endpoints surface auth errors and a missing token like the others', async () => {
  await assert.rejects(fetchRangeTable({ doc: withToken(), fetchFn: stubFetch(403).fetchFn }), (e) => e.code === 'auth');
  await assert.rejects(fetchProfile({ doc: docWith('<p/>'), fetchFn: stubFetch(200, {}).fetchFn }), (e) => e.code === 'no-token');
});
