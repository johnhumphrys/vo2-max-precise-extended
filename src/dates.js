(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GVP = Object.assign(root.GVP || {}, api);
})(typeof self !== 'undefined' ? self : globalThis, function () {
  const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  const M = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
  const LABEL = new RegExp(`^\\s*(${M}) (\\d{1,2})(?:, (\\d{4}))? - (${M}) (\\d{1,2})(?:, (\\d{4}))?\\s*$`);

  const pad = (n) => String(n).padStart(2, '0');
  const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

  function todayIso(now = new Date()) {
    return iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  function shiftIso(isoDate, days) {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  }

  function parseRangeLabel(text, now = new Date()) {
    const m = LABEL.exec(text || '');
    if (!m) return null;
    const sm = MONTHS[m[1]];
    const em = MONTHS[m[4]];
    const endYear = m[6] ? Number(m[6]) : now.getFullYear();
    const startYear = m[3] ? Number(m[3]) : sm > em ? endYear - 1 : endYear;
    return { start: iso(startYear, sm, Number(m[2])), end: iso(endYear, em, Number(m[5])) };
  }

  return { todayIso, shiftIso, parseRangeLabel };
});
