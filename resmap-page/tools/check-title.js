/* The name in the title: the generated SVG in index.html and the effect in
 * main.js section 7, run headless with a fake clock.
 *
 *     node tools/check-title.js
 */
'use strict';
var fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..');
var src = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

var fail = 0;
function t(n, c) { console.log((c ? '  ok   ' : '  FAIL ') + n); if (!c) fail++; }

console.log('the SVG');
var h1 = /<h1>([\s\S]*?)<\/h1>/.exec(html)[1];
t('a screen reader, a search engine and a copy get the word',
  /<span class="sr-only">ReSMap<\/span>/.test(h1));
t('the drawing is hidden from assistive tech', /<svg class="name-svg"[^>]*aria-hidden="true"/.test(h1));
var groups = h1.match(/<g class="ch (\w+)">/g) || [];
t('six letters', groups.length === 6);
t('classes run boundary, divider, crossing, twice',
  groups.map(function (g) { return /ch (\w+)/.exec(g)[1]; }).join(' ') ===
  'boundary divider crossing boundary divider crossing');
var ks = (h1.match(/--k:([\d.]+)/g) || []).map(function (k) { return parseFloat(k.slice(4)); });
t('every vertex has a drawing-order delay in [0, 1] (' + ks.length + ' vertices)',
  ks.length > 100 && ks.every(function (k) { return k >= 0 && k <= 1; }));
t('every polyline draws in over pathLength 1',
  (h1.match(/<polyline /g) || []).length === (h1.match(/<polyline pathLength="1"/g) || []).length);
var css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
t('each class colour is a token in both themes',
  ['boundary', 'divider', 'crossing'].every(function (c) {
    return (css.match(new RegExp('--map-' + c + ':', 'g')) || []).length === 2;
  }));

var body = src.slice(src.indexOf("  var nameSvg = document.querySelector('.name-svg');"),
                     src.lastIndexOf('})();'));

function run(opt) {
  var now = 0, timers = [];
  function setTimeout(fn, ms) { timers.push({ at: now + ms, fn: fn }); }
  function advance(ms) {
    var end = now + ms;
    for (;;) {
      timers.sort(function (a, b) { return a.at - b.at; });
      if (!timers.length || timers[0].at > end) break;
      var x = timers.shift(); now = x.at; x.fn();
    }
    now = end;
  }
  function letter() {
    var e = { cls: {} };
    e.classList = { add: function (c) { e.cls[c] = 1; }, remove: function (c) { delete e.cls[c]; } };
    return e;
  }
  var letters = [0, 1, 2, 3, 4, 5].map(letter);
  var box = { _l: {}, addEventListener: function (ev, f) { box._l[ev] = f; },
              getBoundingClientRect: function () { var y = opt.top || 100; return { top: y, bottom: y + 60 }; } };
  var svg = { parentNode: box, querySelectorAll: function () { return letters; } };
  var doc = { querySelector: function () { return svg; }, hidden: false };
  new Function('document', 'window', 'reduceMotion', 'setTimeout', 'Math', body)(
    doc, { innerHeight: 900 }, { matches: !!opt.reduce }, setTimeout, opt.math || Math);
  return { box: box, advance: advance,
           out: function () { return letters.map(function (l) { return l.cls.out ? 1 : 0; }).join(''); } };
}

console.log('the effect');
var r = run({});
t('nothing mapped at rest', r.out() === '000000');
r.box._l.mouseenter();
r.advance(1);      t('hover: the sweep starts at R', r.out() === '100000');
r.advance(90);     t('...moves on to e', r.out() === '110000');
r.advance(90 * 4); t('...through the whole word', r.out() === '111111');
r.advance(1300);   t('...and every letter fills back in', r.out() === '000000');

var q = run({ math: Object.create(Math, { random: { value: function () { return 0.5; } } }) });
q.advance(8001);   // random() at 0.5: the idle fires at 6000 + 0.5 * 4000
t('idle: one letter, within ten seconds', q.out().split('1').length - 1 === 1);
q.advance(1200);   t('...and it fills back in', q.out() === '000000');

var off = run({ top: -500 });
off.advance(10001); t('idle stays still while the title is off screen', off.out() === '000000');

var still = run({ reduce: true });
still.box._l.mouseenter && still.box._l.mouseenter();
still.advance(10001); t('reduced motion: nothing runs', still.out() === '000000' && !still.box._l.mouseenter);

if (fail) { console.log(fail + ' failure(s)'); process.exit(1); }
console.log('all good');
