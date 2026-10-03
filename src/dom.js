(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GVP = Object.assign(root.GVP || {}, api);
})(typeof self !== 'undefined' ? self : globalThis, function () {
  // Everything that depends on Garmin Connect's markup lives in this file.
  const ATTR = 'data-gvp';
  const VO2_CONTEXT = /VO\s?[2₂]\s?Max/i;
  const MAX_CONTEXT_CHARS = 200; // a container this small is the VO2 card itself, not the page
  const MAX_CONTEXT_DEPTH = 8; // the home gauge value is ~6 levels below its label
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

  function interceptExport(doc, handler) {
    doc.addEventListener(
      'click',
      (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('button') : null;
        if (!isGarminExportButton(btn)) return;
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

  return {
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
