/* The name in the title (main.js section 7), run headless with a fake clock.
 *
 *     node tools/check-title.js
 */
'use strict';
var fs = require('fs'), path = require('path');
var src = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
var body = src.slice(src.indexOf("  var nameEl = document.querySelector('.h1-name');"),
                     src.lastIndexOf('})();'));

function run(opt) {
  var now = 0, timers = [];
  function setTimeout(fn, ms) { timers.push({ at: now + ms, fn: fn }); }
  function advance(ms) {
    var end = now + ms;
    for (;;) {
      timers.sort(function (a, b) { return a.at - b.at; });
      if (!timers.length || timers[0].at > end) break;
      var t = timers.shift(); now = t.at; t.fn();
    }
    now = end;
  }
  function el(tag) {
    var e = { tagName: tag, children: [], _l: {}, cls: {}, attrs: {}, className: '', _text: '',
      appendChild: function (c) { e.children.push(c); return c; },
      setAttribute: function (k, v) { e.attrs[k] = v; },
      addEventListener: function (t, f) { e._l[t] = f; },
      classList: { add: function (c) { e.cls[c] = 1; }, remove: function (c) { delete e.cls[c]; } },
      getBoundingClientRect: function () { return { top: opt.top || 100, bottom: (opt.top || 100) + 60 }; } };
    Object.defineProperty(e, 'textContent', {
      get: function () { return e._text; },
      set: function (v) { e._text = v; e.children = []; } });
    return e;
  }
  var name = el('span'); name._text = 'ReSMap';
  var doc = { querySelector: function () { return name; }, createElement: el, hidden: false };
  var win = { innerHeight: 900 };
  new Function('document', 'window', 'reduceMotion', 'setTimeout', 'Math', body)(
    doc, win, { matches: !!opt.reduce }, setTimeout, opt.math || Math);
  var drawn = name.children[1], said = name.children[0];
  return { name: name, said: said, letters: drawn ? drawn.children : [], advance: advance,
           out: function () { return (drawn ? drawn.children : []).map(function (c) { return c.cls.out ? 1 : 0; }).join(''); } };
}

var fail = 0;
function t(n, c) { console.log((c ? '  ok   ' : '  FAIL ') + n); if (!c) fail++; }

var r = run({});
t('the name is split into six letters', r.letters.length === 6 &&
  r.letters.map(function (c) { return c._text; }).join('') === 'ReSMap');
t('a screen reader gets the word whole', r.said.className === 'sr-only' && r.said._text === 'ReSMap' &&
  r.name.children[1].attrs['aria-hidden'] === 'true');
t('nothing is out at rest', r.out() === '000000');

r.name._l.mouseenter();
r.advance(1);   t('hover: the sweep starts at the first letter', r.out() === '100000');
r.advance(65);  t('...and walks on to the second', r.out() === '110000');
r.advance(65 * 4); t('...through the whole word', r.out() === '111111');
r.advance(2000); t('...and every letter fills back in', r.out() === '000000');

var q = run({ math: Object.create(Math, { random: { value: function () { return 0.5; } } }) });
// random() fixed at 0.5: the idle fires at 6000 + 0.5 * 4000 = 8000 ms.
q.advance(8001);
t('idle: one letter at a time, within ten seconds', q.out().split('').filter(function (x) { return x === '1'; }).length === 1);
q.advance(700);
t('...and it comes back', q.out() === '000000');

var off = run({ top: -500 });
off.advance(10001);
t('idle does nothing while the title is off screen', off.out() === '000000');

var still = run({ reduce: true });
t('reduced motion: the name is left alone', still.letters.length === 0 && still.name._text === 'ReSMap');

if (fail) { console.log(fail + ' failure(s)'); process.exit(1); }
console.log('all good');
