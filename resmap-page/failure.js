/* ReSMap project page — the camera-failure walkthrough.
 *
 * A pinned stage that the scroll drives through four measured conditions:
 * clean, front camera dropped, three front cameras dropped, all six dropped.
 * The rig on the left is a schematic — surround coverage around the ego, with
 * the satellite tile behind it — and the bars on the right are the numbers
 * from Table 2, interpolated between the levels so the motion is continuous
 * while every stop on it is a real measurement.
 */

(function () {
  'use strict';

  var track = document.getElementById('fail-track');
  var rig = document.getElementById('fail-rig');
  if (!track || !rig) return;

  var SVG = 'http://www.w3.org/2000/svg';
  var C = 170;                 // rig centre in viewBox units

  /* Table 2, geographically non-overlapping split, 60 x 30 m. */
  var METHODS = [
    { name: 'MapTracker',  mod: 'C',    v: [40.3, 23.0, 10.8, 0.1] },
    { name: 'MapTRv2',     mod: 'C+L',  v: [36.6, 32.2, 29.5, 23.8] },
    { name: 'DAMap',       mod: 'C+L',  v: [39.4, 35.8, 34.2, 29.2] },
    { name: 'SDTagNet',    mod: 'C+SD', v: [25.8, 19.8, 14.5, 4.0] },
    { name: 'SatforHDMap', mod: 'C+SA', v: [27.0, 21.5, 21.3, 14.3] },
    { name: 'ReSMap',      mod: 'C+SA', v: [47.0, 45.1, 43.4, 40.9], ours: true }
  ];
  var SCALE = 50;              // mAP at full bar width

  /* Camera order: front, front-left, front-right, back-left, back-right, back.
     Bearings are degrees clockwise from straight ahead. */
  var CAMS = [
    { at: 0,    half: 34, label: 'FRONT' },
    { at: -60,  half: 32, label: 'FRONT_LEFT' },
    { at: 60,   half: 32, label: 'FRONT_RIGHT' },
    { at: -125, half: 30, label: 'BACK_LEFT' },
    { at: 125,  half: 30, label: 'BACK_RIGHT' },
    { at: 180,  half: 42, label: 'BACK' }
  ];

  var STAGES = [
    { step: 'Clean', sub: 'all six cameras reporting', off: [],
      note: 'Every camera is reporting and the satellite tile is one more source of evidence rather than a fallback. ReSMap reads 47.0 mAP, ahead of the next best method by 7.6.' },
    { step: 'Front-1', sub: 'front camera zeroed', off: [0],
      note: 'The forward camera goes dark. MapTracker loses 42.9% of its accuracy on that one fault alone, because nothing else in the model can see ahead. ReSMap loses 4.0%.' },
    { step: 'Front-3', sub: 'three forward cameras zeroed', off: [0, 1, 2],
      note: 'The whole forward arc is gone. MapTracker is down to 10.8 mAP and SDTagNet to 14.5. The satellite branch is now carrying the forward geometry, and ReSMap is still at 43.4.' },
    { step: 'All six', sub: 'no camera evidence at all', off: [0, 1, 2, 3, 4, 5],
      note: 'No onboard vision whatsoever. ReSMap returns 40.9 mAP — higher than any of these baselines manages with all six cameras working. That is the redundancy claim, and it is the whole reason to cache the imagery.' }
  ];

  function el(name, attrs) {
    var node = document.createElementNS(SVG, name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) node.setAttribute(k, attrs[k]);
    return node;
  }
  function pt(bearing, r) {
    var a = bearing * Math.PI / 180;
    return [C + Math.sin(a) * r, C - Math.cos(a) * r];
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* ---- the rig ---- */

  var satG = document.getElementById('fail-sat');
  var camG = document.getElementById('fail-cams');
  var egoG = document.getElementById('fail-ego');

  // Satellite tile: a plain geo-aligned crop, drawn as a framed grid.
  satG.appendChild(el('rect', {
    x: 26, y: 26, width: 288, height: 288, rx: 4,
    fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2, class: 'sat-frame'
  }));
  for (var i = 1; i < 6; i++) {
    var p = 26 + (288 / 6) * i;
    satG.appendChild(el('line', { x1: p, y1: 26, x2: p, y2: 314, class: 'sat-grid' }));
    satG.appendChild(el('line', { x1: 26, y1: p, x2: 314, y2: p, class: 'sat-grid' }));
  }
  var satLabel = el('text', { x: 32, y: 20, class: 'sat-label' });
  satLabel.textContent = 'satellite prior · cached offline';
  satG.appendChild(satLabel);

  var wedges = CAMS.map(function (cam) {
    var r0 = 30, r1 = 138;
    var a0 = cam.at - cam.half, a1 = cam.at + cam.half;
    var i0 = pt(a0, r0), i1 = pt(a1, r0), o0 = pt(a0, r1), o1 = pt(a1, r1);
    var node = el('path', {
      d: 'M' + i0[0] + ',' + i0[1] +
         'L' + o0[0] + ',' + o0[1] +
         'A' + r1 + ',' + r1 + ' 0 0 1 ' + o1[0] + ',' + o1[1] +
         'L' + i1[0] + ',' + i1[1] +
         'A' + r0 + ',' + r0 + ' 0 0 0 ' + i0[0] + ',' + i0[1] + 'Z',
      class: 'cam'
    });
    node.appendChild(el('title')).textContent = cam.label;
    camG.appendChild(node);
    return node;
  });

  egoG.appendChild(el('rect', {
    x: C - 11, y: C - 19, width: 22, height: 38, rx: 4, class: 'ego'
  }));
  egoG.appendChild(el('rect', {
    x: C - 7, y: C - 12, width: 14, height: 11, rx: 2, class: 'ego-cabin'
  }));

  /* ---- the bars ---- */

  var list = document.getElementById('fail-bars');
  var rows = METHODS.map(function (m) {
    var li = document.createElement('li');
    li.className = 'bar' + (m.ours ? ' ours' : '');

    var name = document.createElement('span');
    name.className = 'bar-name';
    name.innerHTML = m.name + ' <small>' + m.mod + '</small>';

    var lane = document.createElement('span');
    lane.className = 'bar-lane';
    var fill = document.createElement('i');
    lane.appendChild(fill);

    var val = document.createElement('span');
    val.className = 'bar-val';

    li.appendChild(name);
    li.appendChild(lane);
    li.appendChild(val);
    list.appendChild(li);
    return { fill: fill, val: val, m: m };
  });

  /* ---- scroll ---- */

  var stepEl = document.getElementById('fail-step');
  var subEl = document.getElementById('fail-sub');
  var noteEl = document.getElementById('fail-note');
  var pending = false;
  var lastNote = -1;

  function update() {
    pending = false;

    var stage = track.firstElementChild;
    var box = track.getBoundingClientRect();
    var travel = track.offsetHeight - stage.offsetHeight;
    var t = travel > 0 ? clamp(-box.top / travel, 0, 1) : 0;

    var f = t * (STAGES.length - 1);
    var lo = Math.floor(f), hi = Math.min(STAGES.length - 1, lo + 1);
    var k = f - lo;

    // Cameras fade out as the stage that drops them is approached.
    var offNow = 0;
    for (var i = 0; i < CAMS.length; i++) {
      var a = STAGES[lo].off.indexOf(i) === -1 ? 1 : 0;
      var b = STAGES[hi].off.indexOf(i) === -1 ? 1 : 0;
      var on = lerp(a, b, k);
      wedges[i].style.opacity = (0.10 + on * 0.62).toFixed(3);
      wedges[i].classList.toggle('down', on < 0.5);
      offNow += 1 - on;
    }

    // The satellite prior comes forward by exactly as much as the cameras lose.
    rig.style.setProperty('--sat', (0.22 + (offNow / CAMS.length) * 0.78).toFixed(3));

    rows.forEach(function (r) {
      var v = lerp(r.m.v[lo], r.m.v[hi], k);
      r.fill.style.width = clamp(v / SCALE, 0, 1) * 100 + '%';
      r.val.textContent = v.toFixed(1);
    });

    var shown = Math.round(f);
    if (shown !== lastNote) {
      lastNote = shown;
      stepEl.textContent = STAGES[shown].step;
      subEl.textContent = STAGES[shown].sub;
      noteEl.textContent = STAGES[shown].note;
    }
  }

  function request() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(update);
  }

  update();
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  window.addEventListener('load', update);
})();
