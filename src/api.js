(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GVP = Object.assign(root.GVP || {}, api);
})(typeof self !== 'undefined' ? self : globalThis, function () {
  const BASE = '/gc-api/metrics-service/metrics/maxmet';
  const ALL_TIME_START = '2000-01-01';
  const SPORTS = [['generic', 'running'], ['cycling', 'cycling']];

  class GarminError extends Error {
    constructor(code, message) {
      super(message);
      this.name = 'GarminError';
      this.code = code;
    }
  }

  function getToken(doc) {
    const meta = doc.querySelector('meta[name="csrf-token"]');
    return meta && meta.content ? meta.content : null;
  }

  async function requestUrl(url, ctx) {
    const token = getToken(ctx.doc);
    if (!token) throw new GarminError('no-token', 'Garmin CSRF token not found on the page');
    const fetchFn = ctx.fetchFn || globalThis.fetch;
    const res = await fetchFn(url, {
      credentials: 'include',
      headers: { accept: 'application/json', 'connect-csrf-token': token },
    });
    if (res.status === 401 || res.status === 403) throw new GarminError('auth', `Garmin refused the request (${res.status})`);
    if (!res.ok) throw new GarminError('http', `Garmin returned HTTP ${res.status}`);
    return res.json();
  }

  const request = (path, ctx) => requestUrl(BASE + path, ctx);

  const fetchLatest = (date, ctx) => request(`/latest/${date}`, ctx);
  const fetchRange = (start, end, ctx) => request(`/daily/${start}/${end}`, ctx);

  const RANGE_TABLE_URL = '/web-api/web-data/vo2Max/VO2Max.json';
  const SETTINGS_URL = '/gc-api/userprofile-service/userprofile/user-settings/';

  const fetchRangeTable = (ctx) => requestUrl(RANGE_TABLE_URL, ctx);

  // Deliberately keeps only what the ranges panel needs; the rest of the profile is dropped.
  async function fetchProfile(ctx) {
    const json = await requestUrl(SETTINGS_URL, ctx);
    const u = (json && json.userData) || {};
    return { gender: u.gender ?? null, birthDate: u.birthDate ?? null };
  }

  function rowsFromRaw(raw) {
    if (!Array.isArray(raw)) return [];
    const rows = [];
    for (const entry of raw) {
      if (!entry) continue;
      for (const [key, sport] of SPORTS) {
        const b = entry[key];
        if (!b || (b.vo2MaxPreciseValue == null && b.vo2MaxValue == null)) continue;
        rows.push({
          date: b.calendarDate,
          sport,
          vo2MaxPrecise: b.vo2MaxPreciseValue ?? null,
          vo2MaxRounded: b.vo2MaxValue ?? null,
          fitnessAge: b.fitnessAge ?? null,
        });
      }
    }
    return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.sport < b.sport ? -1 : a.sport > b.sport ? 1 : 0));
  }

  return { GarminError, ALL_TIME_START, getToken, fetchLatest, fetchRange, fetchRangeTable, fetchProfile, rowsFromRaw };
});
