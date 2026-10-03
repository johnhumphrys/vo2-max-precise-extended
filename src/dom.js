(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GVP = Object.assign(root.GVP || {}, api);
})(typeof self !== 'undefined' ? self : globalThis, function () {
  // Everything that depends on Garmin Connect's markup lives in this file.
  const ATTR = 'data-gvp';
  const VO2_CONTEXT = /VO\s?[2₂]\s?Max/i;
  const MAX_CONTEXT_CHARS = 200; // a container this small is the VO2 card itself, not the page
  const MAX_CONTEXT_DEPTH = 12; // the home gauge value's label container is 10 levels up
  const MAX_CLASS_DEPTH = 4; // the element itself plus 3 ancestors
  const VO2_CLASS = /VO2Max/i; // CSS-module class names keep a readable prefix, e.g. VO2MaxGaugeChart_value__pd9wO
  const DATE_LIKE = /\d/;
  const SHOW_TEXT = 4;

  function ownText(el) {
    return Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.nodeValue)
      .join('')
      .trim();
  }

  // Chart axis ticks are <text> inside <svg> and must not be rewritten; the home
  // gauge value is HTML inside <foreignObject> inside <svg> and must be.
  function inPlainSvg(el) {
    for (let p = el; p; p = p.parentElement) {
      const name = p.localName.toLowerCase();
      if (name === 'foreignobject') return false;
      if (name === 'svg') return true;
    }
    return false;
  }

  function hasVo2Context(el) {
    let p = el;
    for (let i = 0; i < MAX_CONTEXT_DEPTH && p; i++, p = p.parentElement) {
      const t = p.textContent;
      if (t.length < MAX_CONTEXT_CHARS && VO2_CONTEXT.test(t)) return true;
      const cls = i < MAX_CLASS_DEPTH ? p.getAttribute('class') : null;
      if (cls && VO2_CLASS.test(cls)) return true;
    }
    return false;
  }

  function findVo2TextNodes(root, rounded) {
    const doc = root.ownerDocument || root;
    const walker = doc.createTreeWalker(root, SHOW_TEXT);
    const out = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.trim() !== rounded) continue;
      const el = node.parentElement;
      if (!el || inPlainSvg(el) || !hasVo2Context(el)) continue;
      out.push(node);
    }
    return out;
  }

  function applyPrecise(root, latest) {
    if (!latest || latest.vo2MaxPrecise == null || latest.vo2MaxRounded == null) return 0;
    const rounded = String(Math.round(latest.vo2MaxRounded));
    const precise = Number(latest.vo2MaxPrecise).toFixed(1);
    const nodes = findVo2TextNodes(root, rounded);
    for (const n of nodes) {
      n.nodeValue = n.nodeValue.replace(rounded, precise);
      n.parentElement.title = `Garmin rounds this to ${rounded}`;
    }
    return nodes.length;
  }

  function findRangeCandidates(root) {
    const out = [];
    for (const el of root.querySelectorAll('*')) {
      const t = ownText(el);
      if (t.includes(' - ') && DATE_LIKE.test(t) && t.length < 40) out.push(t);
    }
    return out;
  }

  function isGarminExportButton(el) {
    return !!el && el.tagName === 'BUTTON' && !el.hasAttribute(ATTR) && /^\s*export\s*$/i.test(el.textContent);
  }

  function findExportButton(doc) {
    return Array.from(doc.querySelectorAll('button')).find(isGarminExportButton) || null;
  }

  function mountControls(doc, actions) {
    const anchor = findExportButton(doc);
    const existing = doc.querySelector(`[${ATTR}="controls"]`);
    if (existing) {
      // Garmin renders asynchronously: re-anchor a fallback box once the real button shows up.
      if (existing.getAttribute(`${ATTR}-mode`) !== 'fallback' || !anchor) return;
      existing.remove();
    }
    const box = doc.createElement('div');
    box.setAttribute(ATTR, 'controls');
    box.setAttribute(`${ATTR}-mode`, anchor ? 'anchored' : 'fallback');
    box.style.cssText = anchor
      ? 'display:inline-flex;gap:6px;margin-left:8px'
      : 'position:fixed;top:70px;right:16px;z-index:9999;display:flex;gap:6px';
    for (const a of actions) {
      const b = doc.createElement('button');
      b.type = 'button';
      b.setAttribute(ATTR, 'btn');
      if (anchor) b.className = anchor.className;
      b.textContent = a.label;
      b.addEventListener('click', a.onClick);
      box.appendChild(b);
    }
    if (anchor) anchor.insertAdjacentElement('afterend', box);
    else doc.body.appendChild(box);
  }

  function interceptExport(doc, handler, shouldIntercept = () => true) {
    doc.addEventListener(
      'click',
      (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('button') : null;
        if (!isGarminExportButton(btn)) return;
        if (!shouldIntercept()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        handler();
      },
      true
    );
  }

  function showMessage(doc, text) {
    const t = doc.createElement('div');
    t.setAttribute(ATTR, 'toast');
    t.textContent = text;
    t.style.cssText =
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:10000;background:#333;color:#fff;padding:10px 16px;border-radius:6px;font:14px sans-serif';
    doc.body.appendChild(t);
    setTimeout(() => t.remove(), 6000);
  }

  function downloadText(doc, text, filename, mime) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = doc.createElement('a');
    a.href = url;
    a.download = filename;
    doc.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const CHART_AREA = '[class*="ReportsPageContent_reportChart"]';

  function findGarminChart(doc) {
    return doc.querySelector(`${CHART_AREA} .recharts-responsive-container`);
  }

  function ensureHideStyle(doc) {
    if (doc.querySelector(`style[${ATTR}="style"]`)) return;
    const s = doc.createElement('style');
    s.setAttribute(ATTR, 'style');
    s.textContent = `[${ATTR}-hide]{display:none!important}[${ATTR}-rel]{position:relative}`;
    (doc.head || doc.documentElement).appendChild(s);
  }

  function setGarminChartHidden(doc, hidden) {
    const g = findGarminChart(doc);
    if (!g) return false;
    ensureHideStyle(doc);
    if (hidden) {
      if (!g.hasAttribute(`${ATTR}-hide`)) g.setAttribute(`${ATTR}-hide`, '');
    } else {
      g.removeAttribute(`${ATTR}-hide`);
    }
    return true;
  }

  function currentChartKey(doc) {
    const el = doc.querySelector(`[${ATTR}="chart"]`);
    return el ? el.getAttribute(`${ATTR}-key`) : null;
  }

  function mountChart(doc, el) {
    const g = findGarminChart(doc);
    if (!g) return false;
    const old = doc.querySelector(`[${ATTR}="chart"]`);
    if (old) {
      if (old.getAttribute(`${ATTR}-key`) === el.getAttribute(`${ATTR}-key`) && old.nextElementSibling === g) return true;
      old.remove();
    }
    g.insertAdjacentElement('beforebegin', el);
    return true;
  }

  function removeChart(doc) {
    const old = doc.querySelector(`[${ATTR}="chart"]`);
    if (old) old.remove();
    setGarminChartHidden(doc, false);
  }

  const GAUGE_CARD = `${CHART_AREA} [class*="Report_vo2MaxCurrent"]`;

  function findGaugeCard(doc) {
    return doc.querySelector(GAUGE_CARD);
  }

  function currentGaugeLegendKey(doc) {
    const el = doc.querySelector(`[${ATTR}="gauge-legend"]`);
    return el ? el.getAttribute(`${ATTR}-key`) : null;
  }

  function mountGaugeLegend(doc, el) {
    const card = findGaugeCard(doc);
    if (!card) return false;
    ensureHideStyle(doc);
    const old = doc.querySelector(`[${ATTR}="gauge-legend"]`);
    if (old) {
      if (old.getAttribute(`${ATTR}-key`) === el.getAttribute(`${ATTR}-key`) && old.parentElement === card) return true;
      old.remove();
    }
    card.setAttribute(`${ATTR}-rel`, '');
    card.appendChild(el);
    return true;
  }

  function removeGaugeLegend(doc) {
    const old = doc.querySelector(`[${ATTR}="gauge-legend"]`);
    if (old) old.remove();
    for (const e of doc.querySelectorAll(`[${ATTR}-rel]`)) e.removeAttribute(`${ATTR}-rel`);
  }

  return {
    findGaugeCard,
    currentGaugeLegendKey,
    mountGaugeLegend,
    removeGaugeLegend,
    findGarminChart,
    setGarminChartHidden,
    mountChart,
    removeChart,
    currentChartKey,
    findVo2TextNodes,
    applyPrecise,
    findRangeCandidates,
    isGarminExportButton,
    findExportButton,
    mountControls,
    interceptExport,
    showMessage,
    downloadText,
  };
});
