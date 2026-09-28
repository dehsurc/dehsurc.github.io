/* The road strip, run headless.
 *
 * There is no browser in the environment this page is built in, so the way a
 * behavioural change gets checked is here: stub.js fakes enough DOM and
 * Canvas2D to load drive.js, and these tests drive the model and assert on
 * what it draws. Every canvas call is screened for NaN and every gradient for
 * stops out of order, because both draw nothing and fail silently.
 *
 *     node tools/check-drive.js
 */

'use strict';
var S = require('./stub-dom.js');
var fs = require('fs');
var src = fs.readFileSync(require('path').join(__dirname, '..', 'drive.js'), 'utf8');

/* Expose the internals we want to drive, by appending to the IIFE body. */
src = src.replace(/\}\)\(\);\s*$/, '  global.__drive = { draw: draw, step: step, hud: hud, measure: measure, resize: resize, syncFromScroll: syncFromScroll, offerHint: offerHint, loop: loop, ambient: ambient, burst: burst, sparks: function(){ return sparks; }, pressGas: pressGas, release: release, state: function(){ return { pos: pos, speed: speed, g: g, rpm: rpm, camsDown: camsDown, outro: outro }; }, set: function(k,v){ if(k==="pos")pos=v; if(k==="speed")speed=v; if(k==="outro")outro=v; if(k==="holdGas")holdGas=v; } };\n})();\n');

var fail = 0;
function t(name, fn) {
  try { fn(); console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function eq(a, b, what) { if (a !== b) throw new Error((what || '') + ' expected ' + b + ', got ' + a); }
function ok(c, what) { if (!c) throw new Error(what); }

console.log('load');
t('drive.js runs with no reference error', function () {
  new Function('global', src)(global);
  ok(global.__drive, 'internals not exposed');
});
var D = global.__drive;

console.log('\nthe rail');
t('the canvas is turned on its side, once, in resize', function () {
  D.resize();
  var x = S.get('road-map')._ctx._xform;
  ok(x, 'no transform set');
  /* screen x = railW - strip y, screen y = strip x, at device pixels. */
  eq(x[0], 0, 'a'); eq(x[1], 1, 'b'); eq(x[2], -1, 'c'); eq(x[3], 0, 'd');
  eq(x[4], 68, 'e'); eq(x[5], 0, 'f');
});
t('the strip is as long as the rail is tall', function () {
  ok(/W = railH;/.test(src) && /H = railW;/.test(src), 'W/H not swapped for the rail');
});
t('nothing hides at the top of the page any more', function () {
  ok(!/at-top/.test(src), 'at-top still in drive.js');
  ok(!/function atTop/.test(src), 'atTop() still in drive.js');
  global.window.scrollY = 0;
  D.resize();
  ok(!S.get('road').hidden, 'rail hidden at the top of the page');
  ok(!S.get('cockpit').hidden, 'cockpit hidden at the top of the page');
});
t('the rail stands down below its viewport floor', function () {
  global.window.innerWidth = 900;
  D.resize();
  ok(S.get('road').hidden, 'rail still on at 900px');
  ok(!S.root.classList.contains('has-road'), 'gutter still reserved at 900px');
  global.window.innerWidth = 1440;
  D.resize();
  ok(!S.get('road').hidden, 'rail off at 1440px');
  ok(S.root.classList.contains('has-road'), 'gutter not reserved at 1440px');
});
t('the ReSMap gantry is gone', function () {
  ok(!/start-plate|startPlate/.test(src), 'start plate still in drive.js');
});

console.log('\nreverse is gone');
t('no gear/lever/knob identifiers remain', function () {
  ok(!/\bgear\s*[=!]==?\s*['"]R['"]/.test(src), "gear === 'R' still present");
  ok(!/setGear|showLever|knobTop|REV_RATIO|REV_LIMIT/.test(src), 'selector code still present');
});
t('ratio() is the forward gearbox only', function () {
  ok(/function ratio\(\) \{ return GEARS\[g\]; \}/.test(src), 'ratio() not simplified');
});

console.log('\nthe model still drives');
t('resize turns the rail on at 1440px', function () {
  D.resize();
  ok(!S.get('road').hidden, 'rail hidden at 1440px');
});
t('measure finds six stops and numbers them from the headings', function () {
  D.measure();
  D.draw();
  var signs = S.get('road-signs').children.filter(function (c) { return c.tagName === 'BUTTON'; });
  eq(signs.length, 6, 'sign count');
  function badge(sign) {
    var b = sign.children.filter(function (c) { return c.tagName === 'B'; });
    return b.length ? b[0]._text : null;
  }
  /* Only the stretch of road on the rail is drawn, so the far sections are
     hidden and carry no position at all. The ones on it run down it. */
  var placed = signs.filter(function (b) { return !b.hidden; });
  ok(placed.length > 0, 'no signs on the rail at the top of the route');
  ok(placed.every(function (b) { return /^-?\d+px$/.test(b.style.top || ''); }),
     'a sign is not placed down the rail by top');
  ok(signs.every(function (b) { return b.style.left === undefined; }),
     'a sign is still placed across by left');
  eq(badge(signs[0]), null, 'walkthrough sign carries a number');
  eq(badge(signs[1]), '1', 'abstract sign number');
  eq(badge(signs[5]), '5', 'cite sign number');
});
t('flooring it accelerates forward and shifts up', function () {
  D.set('pos', 0); D.set('speed', 0); D.set('holdGas', true);
  var seen = [];
  for (var i = 0; i < 600; i++) { D.step(1 / 60); seen.push(D.state().speed); }
  var st = D.state();
  ok(st.speed > 20, 'speed after 10 s floored: ' + st.speed.toFixed(1) + ' m/s');
  ok(st.g >= 3, 'gear reached: D' + (st.g + 1));
  ok(st.pos > 100, 'distance covered ' + st.pos.toFixed(0) + ' m');
  ok(seen.every(function (v) { return v >= -0.001; }), 'went backwards while in gear');
});
t('lifting off coasts down without reversing through zero', function () {
  D.set('holdGas', false);
  var min = Infinity;
  for (var i = 0; i < 3000; i++) { D.step(1 / 60); min = Math.min(min, D.state().speed); }
  ok(min >= -0.001, 'rolled backwards: ' + min);
  ok(D.state().speed < 1, 'never came to rest: ' + D.state().speed);
});
t('held at the end of the route it stays there off the throttle', function () {
  var end = (24000 - 900) / 32;   // maxScroll() / PX_PER_M
  D.set('pos', end); D.set('speed', 0); D.set('holdGas', false);
  for (var i = 0; i < 600; i++) D.step(1 / 60);
  var p = D.state().pos;
  ok(Math.abs(p - end) < 0.5, 'drifted off the end: ' + p.toFixed(1) + ' vs ' + end.toFixed(1));
});

console.log('\nthe strip draws');
t('draw is clean at the top, mid-route and at the end', function () {
  [0, 9000, 23000].forEach(function (y) {
    S.root.scrollHeight = 24000;
    global.window.scrollY = y;
    D.syncFromScroll();
    D.draw();
  });
  ok(!S.calls.some(function (c) { return c[0] === 'grad-out-of-order'; }), 'gradient stops out of order');
});
t('the chequer is drawn at both ends of the route', function () {
  function bandsAt(y) {
    global.window.scrollY = y; D.syncFromScroll();
    S.calls.length = 0; D.draw();
    // Chequer cells are square; the kerb blocks are 12 x 4.
    return S.calls.filter(function (c) {
      return c[0] === 'fillRect' && Math.abs(c[3] - c[4]) < 0.01;
    }).length;
  }
  var atStart = bandsAt(0), middle = bandsAt(9000), atEnd = bandsAt(23000);
  ok(atStart >= 12, 'start chequer missing (' + atStart + ' fillRects)');
  ok(atEnd >= 12, 'finish chequer missing (' + atEnd + ' fillRects)');
  ok(middle < atStart, 'chequer drawn mid-route too (' + middle + ')');
});
t('the coverage easing does not live in step(), which only runs while driving', function () {
  var body = /function step\(dt\) \{([\s\S]*?)\n  \}\n/.exec(src)[1];
  ok(!/camsDown/.test(body), 'camsDown is still advanced in step()');
  ok(!/tick \+=/.test(body), 'the clock is still advanced in step()');
});
t('coverage wedge shrinks as the walkthrough drops cameras', function () {
  global.window.scrollY = 5000; D.syncFromScroll();
  function fillsWith(down) {
    S.root.dataset.camsDown = String(down);
    // ambient(), not step(): this has to work for a reader using the wheel.
    for (var i = 0; i < 200; i++) D.ambient(1 / 60);
    S.calls.length = 0; D.draw();
    return { cams: D.state().camsDown,
             dash: S.calls.filter(function (c) { return c[0] === 'rect'; }).length };
  }
  var on = fillsWith(0), half = fillsWith(0.5), off = fillsWith(1);
  ok(on.cams < 0.02, 'camsDown did not settle to 0: ' + on.cams);
  ok(off.cams > 0.98, 'camsDown did not settle to 1: ' + off.cams);
  ok(on.dash < off.dash, 'satellite footprint not drawn when the cameras are down');
});

t('the chequered flag flies only at the finish, and keeps waving there', function () {
  global.window.scrollY = 23000; D.syncFromScroll();
  function cells(o) {
    D.set('outro', o);
    S.calls.length = 0; D.draw();
    return S.calls.filter(function (c) { return c[0] === 'fillRect'; });
  }
  var before = cells(0).length;
  var flying = cells(1).length;
  eq(flying - before, 28, 'the flag is not 4 x 7 cells');
  /* The ripple runs on the model's own clock, so two frames a moment apart
     must not draw the flag in the same place. */
  var a = cells(1).map(function (c) { return c[1]; }).join(',');
  for (var i = 0; i < 12; i++) D.ambient(1 / 60);
  var b = cells(1).map(function (c) { return c[1]; }).join(',');
  ok(a !== b, 'the flag is frozen');
});

t('fireworks go off over the finish and burn out', function () {
  global.window.scrollY = 23000; D.syncFromScroll();
  D.sparks().length = 0;
  D.burst();
  eq(D.sparks().length, 78, 'three shells of 26');
  for (var i = 0; i < 12; i++) D.ambient(1 / 60);
  S.calls.length = 0; D.draw();
  var streaks = S.calls.filter(function (c) { return c[0] === 'stroke'; }).length;
  ok(streaks >= 26, 'the first shell is not drawn (' + streaks + ' strokes)');
  for (var j = 0; j < 60 * 4; j++) D.ambient(1 / 60);
  eq(D.sparks().length, 0, 'sparks still alive after four seconds');
});
t('kerbs run down both edges', function () {
  global.window.scrollY = 9000; D.syncFromScroll();
  S.calls.length = 0; D.draw();
  var kerbs = S.calls.filter(function (c) { return c[0] === 'fillRect' && c[3] === 12 && c[4] === 4; });
  ok(kerbs.length > 100, 'too few kerb blocks: ' + kerbs.length);
});

t('through the loop with nobody on the pedals, the strip still reacts', function () {
  /* The bug this guards: the coverage and the flag were advanced in step(),
     which only runs while driving, and every test above called the pieces
     directly, so none of them noticed. This one goes through loop() the way a
     reader scrolling with the wheel does. */
  D.release();
  D.sparks().length = 0;
  var now = 5000;
  global.window.scrollY = 5000;
  S.root.dataset.camsDown = '1';
  for (var i = 0; i < 90; i++) { now += 16; D.loop(now); }
  ok(D.state().camsDown > 0.9,
     'coverage did not follow the walkthrough under the wheel: ' + D.state().camsDown.toFixed(2));

  S.root.dataset.camsDown = '0';
  global.window.scrollY = 23100;               // the bottom of the page
  var fired = false;
  for (var j = 0; j < 40; j++) {
    now += 16; D.loop(now);
    if (D.sparks().length) fired = true;
  }
  ok(fired, 'arriving under the wheel set nothing off');
  ok(D.state().outro > 0.3, 'the flourish did not start under the wheel');
});

console.log('\nthe hint');
t('running out of time hides the hint but does not retire it', function () {
  global.localStorage._d = {};
  ok(/setTimeout\(function \(\) \{ dropHint\(false\); \}/.test(src),
     'the timer still retires the hint');
  ok(!/resmap-drove-rail/.test(src), 'the burned key is still in use');
});
t('offered once, then never again', function () {
  global.localStorage._d = {};
  ok(/resmap-drove-2/.test(src), 'the hint key was not moved on');
  var hint = S.get('drive-hint');
  hint.hidden = true;
  D.offerHint();
  ok(!hint.hidden, 'not offered on a first visit');
  D.pressGas();
  ok(hint.hidden, 'not taken away by a pedal');
  ok(global.localStorage._d['resmap-drove-2'], 'a pedal did not retire it');
  hint.hidden = true;
  D.offerHint();
  ok(hint.hidden, 'offered a second time');
});

console.log('\nthe readouts');
t('trip reads a percentage of the route', function () {
  global.window.scrollY = 0; D.syncFromScroll(); D.set('pos', 0); D.hud(0.016);
  eq(S.get('trip')._text, '0%', 'at the top');
  D.set('pos', (24000 - 900) / 32); D.hud(0.016);
  eq(S.get('trip')._text, '100%', 'at the end');
});
t('the gauge prints a forward gear and no R', function () {
  S.calls.length = 0; D.hud(0.016);
  var texts = S.calls.filter(function (c) { return c[0] === 'fillText'; }).map(function (c) { return c[1]; });
  ok(texts.indexOf('R') === -1, 'R still printed: ' + texts.join(','));
  ok(texts.some(function (x) { return /^D[1-5]$/.test(x); }), 'no D gear printed: ' + texts.join(','));
  ok(texts.indexOf('280') !== -1, 'dial does not run to 280: ' + texts.join(','));
});
t('the thank-you is painted on the road at the finish and nowhere else', function () {
  function words(o) {
    D.set('outro', o);
    S.calls.length = 0; D.draw();
    return S.calls.filter(function (c) { return c[0] === 'fillText'; }).map(function (c) { return c[1]; });
  }
  eq(words(0).length, 0, 'painted before the finish');
  ok(words(1).indexOf('THANK YOU FOR VISITING ReSMap') !== -1, 'not painted at the finish');
});
t('nothing is left of the finish panel', function () {
  ok(!/finishEl|getElementById\('finish'\)/.test(src), 'drive.js still reaches for #finish');
});

console.log('');
if (fail) { console.error(fail + ' failure(s)'); process.exit(1); }
console.log('all good');
