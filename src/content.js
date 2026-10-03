(function () {
  const G = globalThis.GVP;
  if (!G || !G.applyPrecise || window.__gvpLoaded) return;
  window.__gvpLoaded = true;

  const log = (...a) => console.warn('[vo2max-precise]', ...a);
  const ctx = { doc: document, fetchFn: (...a) => fetch(...a) };
  const PAGES = /^\/app\/(home|report\/21\/)/;
  const isVo2Report = () => location.pathname.startsWith('/app/report/21/');

  // Latest value: fetched once per calendar day. The observer fires constantly,
  // so after a failure retry no sooner than RETRY_MS later, and never while one is in flight.
  const RETRY_MS = 60000;
  let latestDay = null;
  let latest = null;
  let inFlight = false;
  let failed = false;
  let latestRetryAt = 0;
  function ensureLatest() {
    const day = G.todayIso();
    if (inFlight) return;
    if (latestDay === day) {
      if (latest || !failed || Date.now() < latestRetryAt) return;
    } else {
      latestDay = day;
      latest = null;
    }
    inFlight = true;
    failed = false;
    G.fetchLatest(day, ctx)
      .then((raw) => {
        latest = G.rowsFromRaw([raw]).find((r) => r.sport === 'running') || null;
        inFlight = false;
        tick();
      })
      .catch((e) => {
        inFlight = false;
        failed = true;
        latestRetryAt = Date.now() + RETRY_MS;
        log('could not load latest VO2 max', e);
      });
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

  let exporting = false;
  async function runExport({ allTime, format }) {
    if (exporting) return;
    exporting = true;
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
        e && e.code === 'auth' ? 'Garmin rejected the request. Reload the page or sign in again.' : `Export failed: ${(e && e.message) || 'unknown error'}`
      );
    } finally {
      exporting = false;
    }
  }

  const actions = [
    { label: 'Export JSON', onClick: () => runExport({ allTime: false, format: 'json' }) },
    { label: 'All time CSV', onClick: () => runExport({ allTime: true, format: 'csv' }) },
    { label: 'All time JSON', onClick: () => runExport({ allTime: true, format: 'json' }) },
  ];

  function tick() {
    try {
      if (!isVo2Report()) document.querySelector('[data-gvp="controls"]')?.remove();
      if (!PAGES.test(location.pathname)) return;
      ensureLatest();
      if (latest) G.applyPrecise(document.body, latest);
      if (isVo2Report()) G.mountControls(document, actions);
    } catch (e) {
      log('tick failed', e);
    }
  }

  G.interceptExport(document, () => runExport({ allTime: false, format: 'csv' }), isVo2Report);

  let timer = null;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(tick, 150);
  }).observe(document.body, { childList: true, subtree: true });
  tick();
})();
