(function () {
  const G = globalThis.GVP;
  if (!G || !G.applyPrecise || window.__gvpLoaded) return;
  window.__gvpLoaded = true;

  const log = (...a) => console.warn('[vo2max-precise]', ...a);
  const ctx = { doc: document, fetchFn: (...a) => fetch(...a) };
  const PAGES = /^\/app\/(home|report\/21\/)/;

  // Latest value: fetched once per calendar day, never retried on failure
  // (the observer fires constantly, so a retry loop would hammer Garmin).
  let latestDay = null;
  let latest = null;
  function ensureLatest() {
    const day = G.todayIso();
    if (latestDay === day) return;
    latestDay = day;
    latest = null;
    G.fetchLatest(day, ctx)
      .then((raw) => {
        latest = G.rowsFromRaw([raw]).find((r) => r.sport === 'running') || null;
        tick();
      })
      .catch((e) => log('could not load latest VO2 max', e));
  }

  function currentRange() {
    const now = new Date();
    for (const text of G.findRangeCandidates(document.body)) {
      const r = G.parseRangeLabel(text, now);
      if (r) return r;
    }
    // "Most Recent" tab has no date label: default to the last 12 months.
    const end = G.todayIso(now);
    return { start: G.shiftIso(end, -365), end };
  }

  async function runExport({ allTime, format }) {
    try {
      let range = allTime ? { start: G.ALL_TIME_START, end: G.todayIso(), allTime: true } : currentRange();
      const raw = await G.fetchRange(range.start, range.end, ctx);
      const rows = G.rowsFromRaw(raw);
      if (!rows.length) {
        G.showMessage(document, 'No VO2 max data in that range.');
        return;
      }
      if (allTime) range = { ...range, start: rows[0].date, end: rows[rows.length - 1].date };
      const name = G.filename(range, format);
      if (format === 'csv') G.downloadText(document, G.toCsv(rows), name, 'text/csv');
      else G.downloadText(document, G.toJson(raw, range), name, 'application/json');
    } catch (e) {
      log('export failed', e);
      G.showMessage(
        document,
        e && e.code === 'auth' ? 'Garmin rejected the request. Reload the page or sign in again.' : `Export failed: ${e.message}`
      );
    }
  }

  const actions = [
    { label: 'Export JSON', onClick: () => runExport({ allTime: false, format: 'json' }) },
    { label: 'All time CSV', onClick: () => runExport({ allTime: true, format: 'csv' }) },
    { label: 'All time JSON', onClick: () => runExport({ allTime: true, format: 'json' }) },
  ];

  function tick() {
    try {
      if (!PAGES.test(location.pathname)) return;
      ensureLatest();
      if (latest) G.applyPrecise(document.body, latest);
      if (location.pathname.startsWith('/app/report/21/')) G.mountControls(document, actions);
    } catch (e) {
      log('tick failed', e);
    }
  }

  G.interceptExport(document, () => runExport({ allTime: false, format: 'csv' }));

  let timer = null;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(tick, 150);
  }).observe(document.body, { childList: true, subtree: true });
  tick();
})();
