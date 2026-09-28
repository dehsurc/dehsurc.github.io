/* Every number this page prints twice, checked against the one copy that is
 * the measurement. Run it before pushing:
 *
 *     node tools/check-numbers.js
 *
 * It caught, on the day it was written: a nav readout numbering the sections
 * one ahead of their own headings, a speedometer whose scale ended 50 km/h
 * below what the car can do, a walkthrough claiming a 7.6 lead where the
 * table says 6.7, and a paragraph describing an 84.5% collapse as losing
 * "a quarter to a half".
 *
 * Exits non-zero on the first disagreement, so it can gate a commit.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var dir = path.join(__dirname, '..');
var read = function (f) { return fs.readFileSync(path.join(dir, f), 'utf8'); };

var html = read('index.html');
var drive = read('drive.js');
var failure = read('failure.js');

var bad = [];
function check(ok, what) {
  if (!ok) bad.push(what);
  console.log((ok ? '  ok   ' : '  FAIL ') + what);
}

var ENT = { '&dagger;': '†', '&Dagger;': '‡', '&minus;': '-', '&#10003;': 'Y',
            '&rsquo;': "'", '&thinsp;': ' ', '&nbsp;': ' ', '&times;': 'x',
            '&amp;': '&' };
function text(s) {
  return s.replace(/<[^>]+>/g, '')
          .replace(/&[#a-zA-Z0-9]+;/g, function (e) { return ENT[e] || e; })
          .trim();
}

/* ---- the tables ------------------------------------------------------- */

var tables = (html.match(/<table[\s\S]*?<\/table>/g) || []).map(function (t) {
  return (t.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []).map(function (r) {
    return (r.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/g) || []).map(text);
  });
});
check(tables.length === 2, 'index.html has the two results tables (found ' + tables.length + ')');

/* Table 2 states a mAP and the drop from its own clean column. */
console.log('\nTable 2, drop percentages against each row\'s own clean value');
var t2 = tables[1] || [];
var head = t2[0] || [];
var cleanAt = head.indexOf('Clean');
t2.slice(1).forEach(function (r) {
  var clean = parseFloat(r[cleanAt]);
  for (var i = cleanAt + 1; i < r.length; i++) {
    var m = /^([\d.]+)\s*-([\d.]+)%$/.exec(r[i]);
    if (!m) { check(false, r[0] + ' ' + head[i] + ': cannot read "' + r[i] + '"'); continue; }
    var want = (clean - parseFloat(m[1])) / clean * 100;
    check(Math.abs(want - parseFloat(m[2])) < 0.06,
          r[0] + ' ' + head[i] + ' ' + m[1] + ': -' + m[2] + '% (computed ' +
          want.toFixed(1) + '%)');
  }
});

/* ---- the walkthrough chart against Table 2 ---------------------------- */

console.log('\nfailure.js METHODS against Table 2');
var block = /var METHODS = \[([\s\S]*?)\n  \];/.exec(failure)[1];
var methods = [];
block.replace(/name: '([^']+)'[\s\S]*?v: \[([^\]]+)\]/g, function (_, n, v) {
  methods.push({ name: n, v: v.split(',').map(Number) });
  return '';
});
check(methods.length > 0, 'METHODS parsed (' + methods.length + ' rows)');
var tempAt = head.indexOf('Temp.');
methods.forEach(function (m) {
  /* The chart holds the non-temporal ReSMap row; the table holds both. Match
     on the name, and for ReSMap on the row without the temporal tick. */
  var rows = t2.slice(1).filter(function (r) { return r[0].indexOf(m.name) === 0; });
  if (m.name === 'ReSMap' && rows.length > 1) {
    rows = rows.filter(function (r) { return r[tempAt] !== 'Y'; });
  }
  if (rows.length !== 1) { check(false, m.name + ': ' + rows.length + ' matching table rows'); return; }
  var got = rows[0].slice(cleanAt).map(function (c) { return parseFloat(c); });
  check(JSON.stringify(got) === JSON.stringify(m.v),
        m.name + ': chart [' + m.v + '] vs table [' + got + ']');
});

/* ---- scales wide enough for their own data ---------------------------- */

console.log('\nScales');
var scaleMax = Math.max.apply(null, methods.map(function (m) { return Math.max.apply(null, m.v); }));
var SCALE = Math.ceil(scaleMax / 10) * 10;
check(SCALE >= scaleMax, 'chart bars: scale ' + SCALE + ' mAP covers the largest value ' + scaleMax);

function num(name, src) {
  var m = new RegExp('var ' + name + ' = ([-\\d.]+)').exec(src);
  return m ? parseFloat(m[1]) : NaN;
}
var REDLINE = num('IDLE, REDLINE', drive);
if (isNaN(REDLINE)) REDLINE = parseFloat(/REDLINE = ([\d.]+)/.exec(drive)[1]);
var FINAL = num('FINAL', drive), WHEEL_R = num('WHEEL_R', drive);
var top = parseFloat(/GEARS = \[([^\]]+)\]/.exec(drive)[1].split(',').pop());
var vmaxKmh = REDLINE / 60 / (top * FINAL) * (2 * Math.PI * WHEEL_R) * 3.6;
var TICK = num('TICK', drive);
var V_MAX = Math.ceil(vmaxKmh / TICK) * TICK;
check(V_MAX >= vmaxKmh,
      'speedometer: dial to ' + V_MAX + ' km/h covers top gear at the redline (' +
      vmaxKmh.toFixed(0) + ' km/h)');
check(/var V_MAX = Math\.ceil/.test(drive),
      'speedometer: V_MAX is computed from the drivetrain, not typed');

/* ---- the car the header paragraph describes --------------------------- */

console.log('\nThe car');
function konst(name) {
  var m = new RegExp('var ' + name + ' = ([-\\d.]+)').exec(drive);
  if (!m) throw new Error('constant ' + name + ' not found in drive.js');
  return parseFloat(m[1]);
}
var CAR = {
  MASS: konst('MASS'), PEAK_NM: konst('PEAK_NM'), WHEEL_R: konst('WHEEL_R'),
  FINAL: konst('FINAL'), EFF: konst('EFF'), IDLE: konst('IDLE'),
  REDLINE: parseFloat(/REDLINE = ([\d.]+)/.exec(drive)[1]),
  DRAG_K: konst('DRAG_K'), C_RR: konst('C_RR'), GRAV: konst('GRAV'),
  SHIFT_T: konst('SHIFT_T'),
  GEARS: /GEARS = \[([^\]]+)\]/.exec(drive)[1].split(',').map(Number),
  EB: /engineBrake\(r\) \{ return ([\d.]+) \+ r \* ([\d.]+); \}/.exec(drive).slice(1).map(Number)
};
function clampN(v, a, b) { return Math.min(b, Math.max(a, v)); }
function torque(r) {
  var t = clampN((r - 700) / (CAR.REDLINE - 700), 0, 1);
  return CAR.PEAK_NM * (0.58 + 1.55 * t - 1.30 * t * t);
}
function brakeNm(r) { return CAR.EB[0] + r * CAR.EB[1]; }
function revs(v, g) {
  return clampN(Math.abs(v) / (2 * Math.PI * CAR.WHEEL_R) * CAR.GEARS[g] * CAR.FINAL * 60,
                CAR.IDLE, CAR.REDLINE);
}
/* The same integration step()/the gearbox does, run open loop. */
function simulate(gas) {
  var g = 0, v = 0.001, shifting = 0, th = 0, dt = 1 / 120, t = 0, to100 = null, top = 0;
  for (var i = 0; i < 120 * 150; i++) {
    th += ((gas ? 1 : 0) - th) * Math.min(1, dt * (gas ? 8 : 15));
    var rpm = revs(v, g);
    if (shifting > 0) shifting -= dt;
    else {
      var up = 2900 + th * 3200, dn = 1950 + th * 700;
      if (g < CAR.GEARS.length - 1 && rpm > up) { g++; shifting = CAR.SHIFT_T; }
      else if (g > 0 && rpm < dn) { g--; shifting = CAR.SHIFT_T; }
    }
    var drive_ = 0;
    if (shifting <= 0) {
      var gearing = CAR.GEARS[g] * CAR.FINAL * CAR.EFF / CAR.WHEEL_R;
      drive_ = th * torque(rpm) * gearing;
      if (Math.abs(v) > 0.05) drive_ -= Math.sign(v) * (1 - th) * brakeNm(rpm) * gearing;
    }
    var resist = -Math.sign(v) * (CAR.DRAG_K * v * v + CAR.C_RR * CAR.MASS * CAR.GRAV);
    v += ((drive_ + resist) / CAR.MASS) * dt;
    t += dt;
    if (!to100 && v * 3.6 >= 100) to100 = t;
    top = Math.max(top, v);
  }
  return { to100: to100, top: top * 3.6 };
}
var floored = simulate(true);
var peakNm = Math.max.apply(null, Array.from({ length: CAR.REDLINE + 1 }, function (_, r) { return torque(r); }));

/* Lift at 30 m/s: what the driver actually feels when the pedal comes up. */
var vLift = 30, gLift = CAR.GEARS.length - 1;
var rpmLift = revs(vLift, gLift);
var gearingLift = CAR.GEARS[gLift] * CAR.FINAL * CAR.EFF / CAR.WHEEL_R;
var lift = (brakeNm(rpmLift) * gearingLift +
            CAR.DRAG_K * vLift * vLift + CAR.C_RR * CAR.MASS * CAR.GRAV) / CAR.MASS;

/* The header paragraph quotes three of these. It has been wrong before: it
   said "a 210 Nm engine" while PEAK_NM was 420 and the curve peaked at 438. */
var prose = drive.replace(/\n\s*\*\s?/g, ' ');   // unwrap the block comment
function quoted(re, what) {
  var m = re.exec(prose);
  if (!m) throw new Error('the header no longer states ' + what);
  return parseFloat(m[1]);
}
var said = {
  nm: quoted(/([\d.]+) Nm at the peak of the curve/, 'peak torque'),
  to100: quoted(/0-100 km\/h in ([\d.]+) s/, '0-100'),
  top: quoted(/([\d.]+) km\/h flat out/, 'top speed'),
  lift: quoted(/about ([\d.]+) m\/s\^2 of/, 'the lift')
};
check(Math.abs(said.nm - peakNm) < 1,
      'peak torque: header says ' + said.nm + ' Nm, curve peaks at ' + peakNm.toFixed(0));
check(Math.abs(said.to100 - floored.to100) < 0.15,
      '0-100 km/h: header says ' + said.to100 + ' s, model does ' + floored.to100.toFixed(2));
check(Math.abs(said.top - floored.top) < 6,
      'top speed: header says ' + said.top + ' km/h, model reaches ' + floored.top.toFixed(0));
check(Math.abs(said.lift - lift) < 0.25,
      'lift at 30 m/s: header says ' + said.lift + ' m/s\u00b2, model gives ' + lift.toFixed(2));
check(floored.top <= V_MAX,
      'the dial still covers what the car can do (' + floored.top.toFixed(0) + ' of ' + V_MAX + ')');

/* ---- section numbers ------------------------------------------------- */

console.log('\nSection numbers');
check(!/stops\.indexOf\(next\)/.test(drive),
      'nav readout numbers sections from their headings, not their array index');
check(/numbered \? numbered\.textContent/.test(drive),
      'overhead signs number sections from their headings');

/* ---- prose that quotes the chart ------------------------------------- */

console.log('\nProse');
check(/\{v:ReSMap\}/.test(failure) && /\{lead\}/.test(failure),
      'walkthrough notes quote the chart through placeholders, not typed figures');
var notes = /var STAGES = \[([\s\S]*?)\n  \];/.exec(failure)[1];
check(!/\b\d+\.\d\b(?![^{]*\})/.test(notes.replace(/\{[^}]*\}/g, '')),
      'walkthrough notes contain no hand-written decimals');

console.log('');
if (bad.length) {
  console.error(bad.length + ' problem(s):');
  bad.forEach(function (b) { console.error('  - ' + b); });
  process.exit(1);
}
console.log('All numbers agree.');
