const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const dom = require('../src/dom.js');

const make = (html) => new JSDOM(`<body>${html}</body>`).window.document;
const latest = { date: '2026-10-03', sport: 'running', vo2MaxPrecise: 52.3, vo2MaxRounded: 52, fitnessAge: null };

test('applyPrecise rewrites the home card value', () => {
  const doc = make('<div class="card"><i></i><div class="title">Running VO₂ Max</div><div id="v">52</div></div>');
  assert.equal(dom.applyPrecise(doc.body, latest), 1);
  assert.equal(doc.getElementById('v').textContent, '52.3');
  assert.match(doc.getElementById('v').title, /52/);
});

test('applyPrecise rewrites the report gauge and the sentence, but not svg axis ticks', () => {
  const doc = make(`
    <div class="area">
      <div class="gauge"><div id="g">52</div><div>VO₂ Max</div></div>
      <p id="p">Your VO₂ Max is <strong id="s">52</strong> which is excellent.</p>
      <svg><text id="tick">52</text></svg>
    </div>`);
  assert.equal(dom.applyPrecise(doc.body, latest), 2);
  assert.equal(doc.getElementById('g').textContent, '52.3');
  assert.equal(doc.getElementById('s').textContent, '52.3');
  assert.equal(doc.getElementById('tick').textContent, '52');
});

test('applyPrecise does rewrite a value inside an svg foreignObject (home gauge)', () => {
  const doc = make('<div><div>VO₂ Max</div><svg><g><foreignObject><div id="f"><span id="v">52</span></div></foreignObject></g></svg></div>');
  assert.equal(dom.applyPrecise(doc.body, latest), 1);
  assert.equal(doc.getElementById('v').textContent, '52.3');
});

test('applyPrecise leaves the same number alone when no VO2 context is nearby', () => {
  const doc = make('<div><div>Sleep score</div><div id="v">52</div></div>');
  assert.equal(dom.applyPrecise(doc.body, latest), 0);
  assert.equal(doc.getElementById('v').textContent, '52');
});

test('applyPrecise ignores a huge ancestor that merely contains VO2 somewhere', () => {
  const filler = 'x'.repeat(300);
  const doc = make(`<div><div>VO₂ Max</div><p>${filler}</p><div><div id="v">52</div></div></div>`);
  assert.equal(dom.applyPrecise(doc.body, latest), 0);
});

test('applyPrecise is idempotent and null-safe', () => {
  const doc = make('<div><div>VO₂ Max</div><div id="v">52</div></div>');
  assert.equal(dom.applyPrecise(doc.body, latest), 1);
  assert.equal(dom.applyPrecise(doc.body, latest), 0);
  assert.equal(dom.applyPrecise(doc.body, null), 0);
  assert.equal(dom.applyPrecise(doc.body, { ...latest, vo2MaxPrecise: null }), 0);
});

test('findRangeCandidates returns date-label-like own text only', () => {
  const doc = make('<div><span>Sep 7 - Oct 3</span><span>Most Recent</span><li>4 Weeks</li></div>');
  assert.deepEqual(dom.findRangeCandidates(doc.body), ['Sep 7 - Oct 3']);
});

test('export button detection ignores our own buttons', () => {
  const doc = make('<button id="g">Export<i></i></button><button data-gvp="btn">Export</button><button>Export JSON</button>');
  assert.equal(dom.findExportButton(doc).id, 'g');
  assert.equal(dom.isGarminExportButton(doc.querySelector('[data-gvp]')), false);
});

test('mountControls inserts after Garmin\'s button, copies its class, and is idempotent', () => {
  const doc = make('<div id="box"><button id="g" class="hashed">Export</button></div>');
  const clicks = [];
  const actions = [{ label: 'Export JSON', onClick: () => clicks.push('json') }, { label: 'All time CSV', onClick: () => clicks.push('all') }];
  dom.mountControls(doc, actions);
  dom.mountControls(doc, actions);
  const btns = doc.querySelectorAll('[data-gvp="btn"]');
  assert.equal(btns.length, 2);
  assert.equal(btns[0].className, 'hashed');
  assert.equal(doc.getElementById('g').nextElementSibling.getAttribute('data-gvp'), 'controls');
  btns[1].click();
  assert.deepEqual(clicks, ['all']);
});

test('mountControls falls back to a fixed box when Garmin\'s button is missing', () => {
  const doc = make('<p>nothing</p>');
  dom.mountControls(doc, [{ label: 'Export JSON', onClick() {} }]);
  const box = doc.querySelector('[data-gvp="controls"]');
  assert.ok(box);
  assert.equal(box.parentElement, doc.body);
});

test('interceptExport swallows Garmin\'s click and runs our handler, not ours', () => {
  const doc = make('<button id="g">Export<i id="icon"></i></button><button data-gvp="btn" id="mine">Export JSON</button>');
  let garminSaw = 0;
  let handled = 0;
  doc.getElementById('g').addEventListener('click', () => garminSaw++);
  doc.getElementById('mine').addEventListener('click', () => {});
  dom.interceptExport(doc, () => handled++);
  doc.getElementById('icon').dispatchEvent(new doc.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.equal(handled, 1);
  assert.equal(garminSaw, 0);
  doc.getElementById('mine').click();
  assert.equal(handled, 1);
});

test('interceptExport leaves Garmin alone when shouldIntercept is false', () => {
  const doc = make('<button id="g">Export</button>');
  let garminSaw = 0;
  let handled = 0;
  doc.getElementById('g').addEventListener('click', () => garminSaw++);
  dom.interceptExport(doc, () => handled++, () => false);
  doc.getElementById('g').click();
  assert.equal(handled, 0);
  assert.equal(garminSaw, 1);
});

test('interceptExport intercepts when shouldIntercept is true', () => {
  const doc = make('<button id="g">Export</button>');
  let garminSaw = 0;
  let handled = 0;
  doc.getElementById('g').addEventListener('click', () => garminSaw++);
  dom.interceptExport(doc, () => handled++, () => true);
  doc.getElementById('g').click();
  assert.equal(handled, 1);
  assert.equal(garminSaw, 0);
});

test('applyPrecise ignores a VO2Max class on an ancestor 6 levels up', () => {
  const doc = make('<div class="VO2MaxReport_page"><div><div><div><div><div><span id="v">52</span></div></div></div></div></div></div>');
  assert.equal(dom.applyPrecise(doc.body, latest), 0);
  assert.equal(doc.getElementById('v').textContent, '52');
});

test('showMessage adds a removable toast', () => {
  const doc = make('');
  dom.showMessage(doc, 'hello');
  assert.equal(doc.querySelector('[data-gvp="toast"]').textContent, 'hello');
});

test('mountControls re-anchors a fallback box once Garmin\'s button renders late', () => {
  const doc = make('<div id="box"></div>');
  const actions = [{ label: 'Export JSON', onClick() {} }, { label: 'All time CSV', onClick() {} }];
  dom.mountControls(doc, actions);
  assert.equal(doc.querySelector('[data-gvp="controls"]').getAttribute('data-gvp-mode'), 'fallback');
  dom.mountControls(doc, actions);
  assert.equal(doc.querySelectorAll('[data-gvp="controls"]').length, 1);

  doc.getElementById('box').insertAdjacentHTML('beforeend', '<button id="g" class="hashed">Export</button>');
  dom.mountControls(doc, actions);
  const boxes = doc.querySelectorAll('[data-gvp="controls"]');
  assert.equal(boxes.length, 1);
  assert.equal(doc.getElementById('g').nextElementSibling, boxes[0]);
  assert.equal(boxes[0].getAttribute('data-gvp-mode'), 'anchored');
  assert.equal(boxes[0].parentElement.id, 'box');
  const btns = doc.querySelectorAll('[data-gvp="btn"]');
  assert.equal(btns.length, 2);
  assert.equal(btns[0].className, 'hashed');

  dom.mountControls(doc, actions);
  assert.equal(doc.querySelectorAll('[data-gvp="controls"]').length, 1);
  assert.equal(doc.querySelectorAll('[data-gvp="btn"]').length, 2);
});

test('applyPrecise finds the home label when its container is 10 levels above the value', () => {
  // value span is index 0; container div holding the label is index 10:
  // span(0) < div(1) < foreignObject(2) < g(3) < svg(4) < div(5..9) < container(10)
  const doc = make(
    '<div id="c"><div>Running VO₂ Max</div><div><div><div><div><div><svg><g><foreignObject><div><span id="v">52</span></div></foreignObject></g></svg></div></div></div></div></div></div>'
  );
  assert.equal(dom.applyPrecise(doc.body, latest), 1);
  assert.equal(doc.getElementById('v').textContent, '52.3');
});

test('applyPrecise uses a VO2Max class on the value as a context signal', () => {
  const filler = 'x'.repeat(300);
  const doc = make(`<div><div class="VO2MaxGaugeChart_value__x" id="g">52</div><div>Excellent</div><p>${filler}</p></div>`);
  assert.equal(dom.applyPrecise(doc.body, latest), 1);
  assert.equal(doc.getElementById('g').textContent, '52.3');
});

test('applyPrecise does not use the class signal inside a plain svg', () => {
  const doc = make('<div><svg><text class="VO2MaxTick" id="t">52</text></svg></div>');
  assert.equal(dom.applyPrecise(doc.body, latest), 0);
  assert.equal(doc.getElementById('t').textContent, '52');
});

test('applyPrecise ignores a 52 with an unrelated class and no VO2 label', () => {
  const doc = make('<div class="SleepScore_value"><div class="SleepScore_value" id="v">52</div></div>');
  assert.equal(dom.applyPrecise(doc.body, latest), 0);
});

const chartPage = () =>
  make(
    '<div class="ReportsPageContent_reportChart__x"><div id="holder"><div id="g" class="recharts-responsive-container"><div class="recharts-wrapper"></div></div></div></div>'
  );
const fakeChart = (doc, key) => {
  const el = doc.createElement('div');
  el.setAttribute('data-gvp', 'chart');
  el.setAttribute('data-gvp-key', key);
  return el;
};

test('findGarminChart only matches inside the report chart area', () => {
  const doc = chartPage();
  assert.equal(dom.findGarminChart(doc).id, 'g');
  assert.equal(dom.findGarminChart(make('<div class="recharts-responsive-container"></div>')), null);
});

test('setGarminChartHidden hides and restores, injects its style once, reports a missing chart', () => {
  const doc = chartPage();
  assert.equal(dom.setGarminChartHidden(doc, true), true);
  assert.equal(doc.getElementById('g').hasAttribute('data-gvp-hide'), true);
  dom.setGarminChartHidden(doc, true);
  assert.equal(doc.querySelectorAll('style[data-gvp="style"]').length, 1);
  assert.match(doc.querySelector('style[data-gvp="style"]').textContent, /display:none/);
  dom.setGarminChartHidden(doc, false);
  assert.equal(doc.getElementById('g').hasAttribute('data-gvp-hide'), false);
  assert.equal(dom.setGarminChartHidden(make('<p/>'), true), false);
});

test('mountChart inserts before Garmin\'s chart, is idempotent per key, replaces on a new key', () => {
  const doc = chartPage();
  assert.equal(dom.mountChart(doc, fakeChart(doc, 'a')), true);
  assert.equal(doc.getElementById('g').previousElementSibling.getAttribute('data-gvp-key'), 'a');
  assert.equal(dom.currentChartKey(doc), 'a');
  dom.mountChart(doc, fakeChart(doc, 'a'));
  assert.equal(doc.querySelectorAll('[data-gvp="chart"]').length, 1);
  dom.mountChart(doc, fakeChart(doc, 'b'));
  assert.equal(doc.querySelectorAll('[data-gvp="chart"]').length, 1);
  assert.equal(dom.currentChartKey(doc), 'b');
  assert.equal(dom.mountChart(make('<p/>'), fakeChart(doc, 'z')), false);
});

test('removeChart removes ours and un-hides Garmin\'s; safe when nothing is mounted', () => {
  const doc = chartPage();
  dom.mountChart(doc, fakeChart(doc, 'a'));
  dom.setGarminChartHidden(doc, true);
  dom.removeChart(doc);
  assert.equal(dom.currentChartKey(doc), null);
  assert.equal(doc.getElementById('g').hasAttribute('data-gvp-hide'), false);
  dom.removeChart(doc);
  dom.removeChart(make('<p/>'));
});
