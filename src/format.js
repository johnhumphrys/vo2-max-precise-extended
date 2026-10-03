(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GVP = Object.assign(root.GVP || {}, api);
})(typeof self !== 'undefined' ? self : globalThis, function () {
  const HEADER = ['date', 'sport', 'vo2max_precise', 'vo2max_rounded', 'fitness_age'];

  function cell(v) {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function toCsv(rows) {
    const lines = [HEADER.join(',')];
    for (const r of rows) {
      lines.push([r.date, r.sport, r.vo2MaxPrecise, r.vo2MaxRounded, r.fitnessAge].map(cell).join(','));
    }
    return lines.join('\r\n') + '\r\n';
  }

  function toJson(raw, range) {
    return JSON.stringify(
      { source: 'connect.garmin.com maxmet/daily', range: { start: range.start, end: range.end }, days: raw },
      null,
      2
    ) + '\n';
  }

  function filename(range, ext) {
    return range.allTime ? `vo2max-all-time.${ext}` : `vo2max-${range.start}_${range.end}.${ext}`;
  }

  return { toCsv, toJson, filename };
});
