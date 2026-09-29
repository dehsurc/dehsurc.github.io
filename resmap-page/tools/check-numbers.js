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
            '&amp;': '&', '&ndash;': '–', '&middot;': '·' };
function text(s) {
  return s.replace(/<[^>]+>/g, '')
          .replace(/&[#a-zA-Z0-9]+;/g, function (e) { return ENT[e] || e; })
          .trim();
}

/* ---- the tables -------------------------------------------------------
 *
 * Every results table is one panel of a tabbed figure and says what it is:
 * data-kind (clean: per-class AP; failure: camera dropout) and data-set
 * (nusc-geo, nusc-orig, av2-geo). Rows marked pending have no numbers yet.
 *
 * Disagreements that are in the paper itself -- the same quantity printed
 * differently in two of its tables -- are reported as warnings: the page
 * prints each table as the paper does, and the fix belongs in the paper. */

var warned = [];
function warn(what) { warned.push(what); console.log('  WARN ' + what); }

/* Disagreements verified against the paper PDF (2026-09-29): the page copies
   the paper faithfully and the paper disagrees with itself. Listed here they
   warn on every run instead of blocking; anything not on the list still
   fails until someone has looked at the PDF. Fix them in the camera-ready,
   then here and in the tables. */
var IN_THE_PAPER = [
  // Tab. 1, 100 x 50 m: APs 11.9 / 25.5 / 30.8 average to 22.7, printed 22.5.
  /^SDTagNet \[100 x 50 m\] mAP 22\.5 /,
  // Tabs. 1 and 6 train MapTracker for 72 epochs at 60 x 30 m; Tabs. 2 and 7 say 70.
  /^MapTracker \(T\): .*Ep\. 72 \/ 70/,
  // Non-temporal ReSMap, original split: 82.8 in Tab. 6, 82.9 in Tab. 7.
  /^ReSMap \(ours\): mAP 82\.8 \/ Clean 82\.9/
];
function judge(ok, line, reported) {
  if (ok) return check(true, line);
  if (reported) return warn(line + ' (as reported by its own paper)');
  if (IN_THE_PAPER.some(function (re) { return re.test(line); })) return warn(line + ' (in the paper)');
  check(false, line);
}

var tables = [];
html.replace(/<table([^>]*)>([\s\S]*?)<\/table>/g, function (_, attrs, body) {
  var kind = /data-kind="([^"]+)"/.exec(attrs), set = /data-set="([^"]+)"/.exec(attrs);
  var rows = [], group = '';
  (body.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []).forEach(function (r) {
    var cells = (r.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/g) || []).map(text);
    if (/class="group"/.test(r)) { group = cells[0]; return; }
    rows.push({ cells: cells, group: group, pending: /class="pending"/.test(r) });
  });
  tables.push({ kind: kind && kind[1], set: set && set[1], head: rows[0].cells, rows: rows.slice(1) });
  return '';
});
function find(kind, set) {
  return tables.filter(function (t) { return t.kind === kind && t.set === set; })[0];
}
check(tables.every(function (t) { return t.kind && t.set; }),
      'every results table declares data-kind and data-set (' + tables.length + ' tables)');
['clean nusc-geo', 'clean nusc-orig', 'clean av2-geo', 'failure nusc-geo', 'failure nusc-orig', 'failure av2-geo']
  .forEach(function (k) { check(!!find.apply(null, k.split(' ')), 'table present: ' + k); });

function col(t, name) { return t.head.indexOf(name); }
function key(r, t) {   // method + temporal tick, the identity of a row within a table
  return r.cells[0].replace(/[†‡]/g, '').trim() + (r.cells[col(t, 'Temp.')] === 'Y' ? ' (T)' : '');
}

/* Failure tables state a mAP and the drop from their own clean column. */
tables.filter(function (t) { return t.kind === 'failure'; }).forEach(function (t) {
  console.log('\nDrop percentages, ' + t.set);
  var c = col(t, 'Clean');
  t.rows.forEach(function (r) {
    if (r.pending) { console.log('  ...  ' + key(r, t) + ': pending'); return; }
    var clean = parseFloat(r.cells[c]);
    for (var i = c + 1; i < r.cells.length; i++) {
      if (r.cells[i] === '–') continue;   // not reported (SafeMap: single view only)
      var m = /^([\d.]+)\s*-([\d.]+)%$/.exec(r.cells[i]);
      if (!m) { check(false, key(r, t) + ' ' + t.head[i] + ': cannot read "' + r.cells[i] + '"'); continue; }
      var v = parseFloat(m[1]);
      var want = (clean - v) / clean * 100;
      /* Both mAPs are printed to 0.1, so the drop recomputed from them can
         differ from one computed on the unrounded values -- which is how the
         rebuttal's Argoverse 2 table was made -- by up to this much, plus 0.05
         for printing the percentage itself. The paper's own tables were
         computed from the rounded values and agree to 0.05. */
      var slack = 100 * (0.05 + 0.05 * v / clean) / clean + 0.05;
      check(Math.abs(want - parseFloat(m[2])) <= slack,
            key(r, t) + ' ' + t.head[i] + ' ' + m[1] + ': -' + m[2] + '% (computed ' + want.toFixed(2) +
            '%, within ' + slack.toFixed(2) + ')');
    }
  });
});

/* A clean table's mAP is the mean of its three class APs. */
tables.filter(function (t) { return t.kind === 'clean'; }).forEach(function (t) {
  console.log('\nmAP = mean(AP), ' + t.set);
  var ap = ['APp', 'APd', 'APb'].map(function (n) { return col(t, n); }), m = col(t, 'mAP');
  t.rows.forEach(function (r) {
    if (r.pending) { console.log('  ...  ' + key(r, t) + ': pending'); return; }
    var mean = ap.reduce(function (s, i) { return s + parseFloat(r.cells[i]); }, 0) / 3;
    var said = parseFloat(r.cells[m]);
    var line = key(r, t) + ' [' + r.group + '] mAP ' + said + ' vs mean ' + mean.toFixed(2);
    /* The three APs are each rounded to 0.1, which moves their mean by up to
       0.05, and the mAP is rounded on its own, another 0.05: the two can
       honestly differ by 0.10. */
    judge(Math.abs(mean - said) <= 0.1001, line, /‡/.test(r.cells[0]));
  });
});

/* The same method's clean mAP, in the clean table and the failure table of
   the same split at 60 x 30 m. */
['nusc-geo', 'nusc-orig', 'av2-geo'].forEach(function (set) {
  var ct = find('clean', set), ft = find('failure', set);
  if (!ct || !ft) return;
  console.log('\nClean mAP, clean table vs failure table, ' + set);
  ft.rows.forEach(function (r) {
    if (r.pending) return;
    var k = key(r, ft);
    var twin = ct.rows.filter(function (x) { return key(x, ct) === k && /60/.test(x.group); })[0];
    if (!twin) { console.log('  ...  ' + k + ': not in the clean table'); return; }
    if (twin.pending) return;
    var a = parseFloat(twin.cells[col(ct, 'mAP')]), b = parseFloat(r.cells[col(ft, 'Clean')]);
    var ea = twin.cells[col(ct, 'Ep.')], eb = r.cells[col(ft, 'Ep.')];
    var line = k + ': mAP ' + a + ' / Clean ' + b + ', Ep. ' + ea + ' / ' + eb;
    judge(a === b && ea === eb, line, false);
  });
});

/* ---- the walkthrough chart against Table 2 ---------------------------- */

console.log('\nfailure.js METHODS against Table 2 (nusc-geo)');
var t2 = find('failure', 'nusc-geo');
var head = t2.head, cleanAt = col(t2, 'Clean'), tempAt = col(t2, 'Temp.');
var block = /var METHODS = \[([\s\S]*?)\n  \];/.exec(failure)[1];
var methods = [];
block.replace(/name: '([^']+)'[\s\S]*?v: \[([^\]]+)\]/g, function (_, n, v) {
  methods.push({ name: n, v: v.split(',').map(Number) });
  return '';
});
check(methods.length > 0, 'METHODS parsed (' + methods.length + ' rows)');
methods.forEach(function (m) {
  /* The chart holds the non-temporal ReSMap row; the table holds both. */
  var rows = t2.rows.map(function (r) { return r.cells; })
    .filter(function (r) { return r[0].indexOf(m.name) === 0; });
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
if (warned.length) {
  console.log(warned.length + ' warning(s), in the paper rather than the page:');
  warned.forEach(function (w) { console.log('  - ' + w); });
  console.log('');
}
if (bad.length) {
  console.error(bad.length + ' problem(s):');
  bad.forEach(function (b) { console.error('  - ' + b); });
  process.exit(1);
}
console.log('All numbers agree.');
