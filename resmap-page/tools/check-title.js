/* The name in the title: the generated three-layer SVG in index.html and the
 * pointer-following ROI in main.js section 7, run headless.
 *
 *     node tools/check-title.js
 */
'use strict';
var fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..');
var src = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

var fail = 0;
function t(n, c) { console.log((c ? '  ok   ' : '  FAIL ') + n); if (!c) fail++; }

console.log('the SVG');
var h1 = /<h1>([\s\S]*?)<\/h1>/.exec(html)[1];
t('a screen reader, a search engine and a copy get the word', /<span class="sr-only">ReSMap<\/span>/.test(h1));
t('the drawing is hidden from assistive tech', /<svg class="name-svg"[^>]*aria-hidden="true"/.test(h1));
t('six glyph outlines, defined once', (h1.match(/<path id="nm-p\d"/g) || []).length === 6);
t('two layers: the solid name and the map', h1.indexOf('class="nm-solid"') >= 0 && h1.indexOf('class="nm-map"') >= 0);
t('no road: no asphalt, no painted lanes', !/class="(asphalt|lane|edge)"|nm-road/.test(h1));
t('the solid letters are never cut (no seam at rest)', !/class="nm-solid"[^>]*clip-path/.test(h1));
t('the lens is a circle, and the map shows only inside it',
  /<clipPath id="nm-in"><circle id="nm-lens"/.test(h1) && /class="nm-map" clip-path="url\(#nm-in\)"/.test(h1));
t('inside the lens, page-coloured copies of the letters hide the solid ones',
  (h1.match(/<use class="paper" href="#nm-p\d"\/>/g) || []).length === 6);
t('nothing outside the letters is covered: no disc, no rect in the map layer',
  !/<g class="nm-map"[^>]*>[\s\S]*?<rect/.test(h1.replace(/<\/g>[\s\S]*$/, '')));
var map = /<g class="nm-map"[\s\S]*?<\/g>/.exec(h1)[0];
t('a boundary for every contour (' + (map.match(/class="boundary"/g) || []).length + ')',
  (map.match(/class="boundary"/g) || []).length === 10);
t('a divider down every stroke (' + (map.match(/class="divider"/g) || []).length + ')',
  (map.match(/class="divider"/g) || []).length > 6);
t('no vertex dots', !/<circle(?! id="nm-lens")/.test(h1));
t('the road tokens are gone from the stylesheet', !/--name-asphalt|--name-paint/.test(css));
['--map-boundary', '--map-divider'].forEach(function (k) {
  t(k + ' set in both themes', (css.match(new RegExp(k + ':', 'g')) || []).length === 2);
});

var body = src.slice(src.indexOf("  var nameSvg = document.querySelector('.name-svg');"), src.lastIndexOf('})();'));

function run(opt) {
  var now = 0, timers = [], frames = [];
  function setTimeout(fn, ms) { timers.push({ at: now + ms, fn: fn }); }
  function requestAnimationFrame(fn) { frames.push(fn); return frames.length; }
  function tick(ms) {
    var end = now + ms;
    while (now < end) {
      now = Math.min(end, now + 16);
      timers.sort(function (a, b) { return a.at - b.at; });
      while (timers.length && timers[0].at <= now) timers.shift().fn();
      var run = frames; frames = [];
      run.forEach(function (f) { f(now); });
    }
  }
  function node() {
    var e = { attrs: {}, cls: {}, _l: {} };
    e.setAttribute = function (k, v) { e.attrs[k] = String(v); };
    e.getAttribute = function (k) { return e.attrs[k] === undefined ? null : e.attrs[k]; };
    e.classList = { toggle: function (c, on) { if (on) e.cls[c] = 1; else delete e.cls[c]; } };
    e.addEventListener = function (ev, f) { e._l[ev] = f; };
    return e;
  }
  var lens = node(), box = node();
  // The name is 749 x 100 px on screen; the viewBox is 7490 x 2048 from y = -1769.
  box.getBoundingClientRect = function () { var y = opt.top || 100; return { left: 100, width: 749, top: y, height: 100, bottom: y + 100 }; };
  var svg = node();
  svg.attrs['data-lens'] = '880 -546';
  svg.viewBox = { baseVal: { x: 0, y: -1769, width: 7490, height: 2048 } };
  svg.parentNode = box;
  svg.getBoundingClientRect = box.getBoundingClientRect;
  var doc = { querySelector: function () { return svg; }, getElementById: function () { return lens; }, hidden: false };
  new Function('document', 'window', 'reduceMotion', 'setTimeout', 'requestAnimationFrame', 'performance', body)(
    doc, { innerHeight: 900 }, { matches: !!opt.reduce }, setTimeout, requestAnimationFrame, { now: function () { return now; } });
  function ev(px, py) { return { clientX: px, clientY: py === undefined ? 150 : py }; }
  return {
    tick: tick,
    x: function () { return parseFloat(lens.attrs.cx); },
    y: function () { return parseFloat(lens.attrs.cy); },
    on: function () { return !!svg.cls['has-roi']; },
    enter: function (px, py) { box._l.pointerenter(ev(px, py)); },
    move: function (px, py) { box._l.pointermove(ev(px, py)); },
    leave: function () { box._l.pointerleave(); }
  };
}

console.log('the pointer');
var r = run({});
r.enter(100 + 374.5, 100 + 60);   // middle of the name, 60% of the way down
r.tick(16);
t('entering switches the lens on', r.on());
t('the lens arrives at the pointer, in x and in y',
  Math.abs(r.x() - 3745) < 1 && Math.abs(r.y() - (-1769 + 0.6 * 2048)) < 1);
r.move(100 + 700, 100 + 20);
r.tick(16);
t('moving: the lens trails the pointer', r.x() > 3745 && r.x() < 7000 && r.y() < -1769 + 0.6 * 2048);
r.tick(800);
t('...and settles on it', Math.abs(r.x() - 7000) < 1 && Math.abs(r.y() - (-1769 + 0.2 * 2048)) < 1);
r.leave(); r.tick(16);
t('leaving switches it off', !r.on());

console.log('the first visit');
var d = run({});
d.tick(1000); t('nothing before 1.1 s', !d.on());
d.tick(300);  t('then the lens passes along the name once', d.on() && d.x() < 7490 && Math.abs(d.y() - (-546)) < 1);
d.tick(2600); t('...right the way across, then goes', !d.on() && d.x() > 7490);
d.tick(20000); t('only once', !d.on());

var h = run({});
h.enter(300); h.tick(16); h.leave(); h.tick(3000);
t('a pointer first means no demo', !h.on());

var off = run({ top: -500 });
off.tick(4000); t('no demo while the title is off screen', !off.on());

var still = run({ reduce: true });
still.tick(4000); t('reduced motion: no demo', !still.on());
still.enter(100 + 374.5); still.move(100 + 700); still.tick(16);
t('reduced motion: the lens goes where the pointer is, without gliding', Math.abs(still.x() - 7000) < 1);

if (fail) { console.log(fail + ' failure(s)'); process.exit(1); }
console.log('all good');
