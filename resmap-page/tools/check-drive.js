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
src = src.replace(/\}\)\(\);\s*$/, '  global.__drive = { draw: draw, step: step, hud: hud, measure: measure, resize: resize, atTop: atTop, syncFromScroll: syncFromScroll, offerHint: offerHint, pressGas: pressGas, release: release, state: function(){ return { pos: pos, speed: speed, g: g, rpm: rpm, camsDown: camsDown, outro: outro }; }, set: function(k,v){ if(k==="pos")pos=v; if(k==="speed")speed=v; if(k==="outro")outro=v; if(k==="holdGas")holdGas=v; } };\n})();\n');

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

console.log('\nreverse is gone');
t('no gear/lever/knob identifiers remain', function () {
  ok(!/\bgear\s*[=!]==?\s*['"]R['"]/.test(src), "gear === 'R' still present");
  ok(!/setGear|showLever|knobTop|REV_RATIO|REV_LIMIT/.test(src), 'selector code still present');
});
t('ratio() is the forward gearbox only', function () {
  ok(/function ratio\(\) \{ return GEARS\[g\]; \}/.test(src), 'ratio() not simplified');
});

console.log('\nthe model still drives');
t('resize turns the road on at 1440px', function () {
  D.resize();
  ok(!S.get('road').hidden, 'road hidden at 1440px');
  ok(S.root.classList.contains('at-top'), 'should start at the top');
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
    return S.calls.filter(function (c) { return c[0] === 'fillRect'; }).length;
  }
  var atStart = bandsAt(0), middle = bandsAt(9000), atEnd = bandsAt(23000);
  ok(atStart >= 12, 'start chequer missing (' + atStart + ' fillRects)');
  ok(atEnd >= 12, 'finish chequer missing (' + atEnd + ' fillRects)');
  ok(middle < atStart, 'chequer drawn mid-route too (' + middle + ')');
});
t('coverage wedge shrinks as the walkthrough drops cameras', function () {
  global.window.scrollY = 5000; D.syncFromScroll();
  function fillsWith(down) {
    S.root.dataset.camsDown = String(down);
    for (var i = 0; i < 200; i++) D.step(1 / 60);   // let the easing settle
    S.calls.length = 0; D.draw();
    return { cams: D.state().camsDown,
             dash: S.calls.filter(function (c) { return c[0] === 'rect'; }).length };
  }
  var on = fillsWith(0), half = fillsWith(0.5), off = fillsWith(1);
  ok(on.cams < 0.02, 'camsDown did not settle to 0: ' + on.cams);
  ok(off.cams > 0.98, 'camsDown did not settle to 1: ' + off.cams);
  ok(on.dash < off.dash, 'satellite footprint not drawn when the cameras are down');
});

console.log('\nthe hint');
t('offered once, then never again', function () {
  global.localStorage._d = {};
  var hint = S.get('drive-hint');
  hint.hidden = true;
  D.offerHint();
  ok(!hint.hidden, 'not offered on a first visit');
  D.pressGas();
  ok(hint.hidden, 'not taken away by a pedal');
  ok(global.localStorage._d['resmap-drove'], 'not remembered');
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
t('the finish panel lights with the outro and not before', function () {
  var f = S.get('finish');
  D.set('outro', 0); D.draw();
  ok(f.hidden, 'shown before the finish');
  D.set('outro', 1); D.draw();
  ok(!f.hidden, 'not shown at the finish');
});

console.log('');
if (fail) { console.error(fail + ' failure(s)'); process.exit(1); }
console.log('all good');
