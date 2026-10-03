(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GVP = Object.assign(root.GVP || {}, api);
})(typeof self !== 'undefined' ? self : globalThis, function () {
  const GENDER_LABEL = { MALE: 'Men', FEMALE: 'Women' };

  function ageOn(birthIso, now) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthIso || '');
    if (!m) return null;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    let age = now.getFullYear() - y;
    const month = now.getMonth() + 1;
    if (month < mo || (month === mo && now.getDate() < d)) age -= 1;
    return age >= 0 ? age : null;
  }

  function bracketFor(table, gender, age) {
    const group = table && table[String(gender || '').toUpperCase()];
    if (!group || age == null) return null;
    for (const key of Object.keys(group)) {
      const [lo, hi] = key.split('-').map(Number);
      if (age >= lo && age <= hi) return { key, entries: group[key] };
    }
    return null;
  }

  const num = (s) => (s === '' || s == null || Number.isNaN(Number(s)) ? null : Number(s));

  function parseEntries(entries) {
    return (entries || []).map((e) => ({ category: e.category, min: num(e.min), max: num(e.max) }));
  }

  function formatRange(e) {
    if (e.min == null && e.max == null) return '';
    if (e.min == null) return `<${e.max}`;
    if (e.max == null) return `${e.min}+`;
    return `${e.min}–${e.max}`;
  }

  function categoryOf(entries, value) {
    if (value == null) return null;
    for (const e of entries) {
      if ((e.min == null || value >= e.min) && (e.max == null || value < e.max)) return e.category;
    }
    return null;
  }

  function describe(table, profile, now, value) {
    if (!profile) return null;
    const bracket = bracketFor(table, profile.gender, ageOn(profile.birthDate, now));
    if (!bracket) return null;
    const entries = parseEntries(bracket.entries);
    if (!entries.length) return null;
    const current = categoryOf(entries, value);
    const who = GENDER_LABEL[String(profile.gender).toUpperCase()] || '';
    return {
      label: `${who} ${bracket.key}`.trim(),
      current,
      rows: entries.map((e) => ({ category: e.category, text: formatRange(e), current: e.category === current })),
    };
  }

  return { ageOn, bracketFor, parseEntries, formatRange, categoryOf, describe };
});
