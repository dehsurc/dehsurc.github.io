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
['nm-solid', 'nm-road', 'nm-map', 'nm-roi'].forEach(function (g) {
  t('layer present: ' + g, h1.indexOf('class="' + g + '"') >= 0);
});
var roi = /data-roi="(-?\d+) (\d+) (\d+)"/.exec(h1);
t('the ROI is 30 x 60, forward up (height twice the width)', roi && +roi[2] === 2 * +roi[3]);
var road = /<g class="nm-road"[\s\S]*?<\/g>/.exec(h1)[0], map = /<g class="nm-map"[\s\S]*?<\/g>/.exec(h1)[0];
var lanes = (road.match(/class="lane"/g) || []).length, dividers = (map.match(/class="divider"/g) || []).length;
t('every centre line is both a painted lane and a map divider (' + lanes + ')', lanes > 6 && lanes === dividers);
t('the map has a boundary for every contour (' + (map.match(/class="boundary"/g) || []).length + ')',
  (map.match(/class="boundary"/g) || []).length === 10);
t('the road only outside the ROI, the map only inside',
  /class="nm-road" clip-path="url\(#nm-out\)"/.test(h1) && /class="nm-map" clip-path="url\(#nm-in\)"/.test(h1));
t('no vertex dots', !/<circle/.test(h1));
['--map-boundary', '--map-divider', '--name-asphalt', '--name-paint'].forEach(function (k) {
  t(k + ' set in both themes', (css.match(new RegExp(k + ':', 'g')) || []).length === 2);
});

var body = src.slice(src.indexOf("  var nameSvg = document.querySelector('.name-svg');"), src.lastIndexOf('})();'));

function run(opt) {
  var now = 0, timers = [], frames = [];
  function setTimeout(fn, ms) { timers.push({ at: now + ms, fn: fn }); }
  function requestAnimationFrame(fn) { frames.push(fn); return frames.length; }
  function tick(ms) {               // advance the clock one 16 ms frame at a time
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
  var roiIn = node(), roiOut = node(), mark = node(), box = node();
  box.getBoundingClientRect = function () { return { left: 100, width: 749, top: opt.top || 100, bottom: (opt.top || 100) + 60 }; };
  var svg = node();
  svg.attrs['data-roi'] = '-1650 2210 1105';
  svg.viewBox = { baseVal: { width: 7490 } };
  svg.parentNode = box;
  svg.querySelector = function () { return mark; };
  svg.getBoundingClientRect = box.getBoundingClientRect;
  var ids = { 'nm-roi-in': roiIn, 'nm-roi-out': roiOut };
  var doc = { querySelector: function () { return svg; }, getElementById: function (i) { return ids[i]; }, hidden: false };
  new Function('document', 'window', 'reduceMotion', 'setTimeout', 'requestAnimationFrame', 'performance', body)(
    doc, { innerHeight: 900 }, { matches: !!opt.reduce }, setTimeout, requestAnimationFrame, { now: function () { return now; } });
  return {
    tick: tick, box: box, svg: svg,
    x: function () { return parseFloat(roiIn.attrs.x) + 1105 / 2; },
    on: function () { return !!svg.cls['is-road'] && !!svg.cls['has-roi']; },
    enter: function (px) { box._l.pointerenter({ clientX: px }); },
    move: function (px) { box._l.pointermove({ clientX: px }); },
    leave: function () { box._l.pointerleave(); }
  };
}

console.log('the pointer');
var r = run({});
r.enter(100 + 374.5);             // the middle of a 749 px wide name
r.tick(16);
t('entering turns the name into a road with the ROI on it', r.on());
t('the box arrives at the pointer, not somewhere else', Math.abs(r.x() - 3745) < 1);
r.move(100 + 700);
r.tick(16);
var mid = r.x();
t('moving: the box trails the pointer', mid > 3745 && mid < 7000);
r.tick(800);
t('...and settles on it', Math.abs(r.x() - 7000) < 1);
r.leave(); r.tick(16);
t('leaving puts the name back', !r.on());

console.log('the first visit');
var d = run({});
d.tick(1000); t('nothing before 1.1 s', !d.on());
d.tick(300);  t('then the ego drives the name once', d.on() && d.x() < 7490);
d.tick(2600); t('...right the way across, and the name comes back', !d.on() && d.x() > 7490);
d.tick(20000); t('only once', !d.on());

var h = run({});
h.enter(300); h.tick(16); h.leave(); h.tick(3000);
t('a pointer first means no demo', !h.on());

var off = run({ top: -500 });
off.tick(4000); t('no demo while the title is off screen', !off.on());

var still = run({ reduce: true });
still.tick(4000); t('reduced motion: no demo', !still.on());
still.enter(100 + 374.5); still.move(100 + 700); still.tick(16);
t('reduced motion: the box goes where the pointer is, without gliding', Math.abs(still.x() - 7000) < 1);

if (fail) { console.log(fail + ' failure(s)'); process.exit(1); }
console.log('all good');
