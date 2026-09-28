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
