/* ReSMap project page — the map behind the page, and the route beside it.
 *
 * Two views of one procedural world, and no assets anywhere.
 *
 *   The background is a vectorised HD map: lane dividers, road boundaries and
 *   pedestrian crossings, and nothing else, because that is what the nuScenes
 *   map ground truth actually contains. It sits nearly invisible until the
 *   pointer passes over it, where a 1:2 region of interest — the shape of the
 *   60 x 30 m crop the model predicts into — redraws the same geometry in the
 *   usual class colours, with the per-polyline vertices that any MapTR-style
 *   figure shows.
 *
 *   The rail down the right edge is the document as a single route. The car is
 *   the scroll thumb: it travels down the road as the page scrolls, each
 *   section is a junction along the way, and dragging the car scrolls.
 */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------------- *
   * World
   * ---------------------------------------------------------------- */

  var ROAD_HALF = 138;    // centreline to road boundary, world px
  var LANE = 46;          // spacing between lane dividers
  var SIDE = 940;         // lateral offset of the parallel corridor
  var JUNCTION = 640;     // spacing between cross roads
  var CROSS_HALF = 96;    // cross road half width
  var VERT = 30;          // polyline vertex spacing
  var PARALLAX = 0.5;     // document px -> world px

  function centre(y) {
    return Math.sin(y / 610) * 54 + Math.sin(y / 1840 + 1.7) * 88;
  }

  var CLASS = {
    boundary: { light: '#2f7d4f', dark: '#5cc084' },
    divider:  { light: '#c2831f', dark: '#e0a94a' },
    crossing: { light: '#2f6fb5', dark: '#6aa6e8' }
  };

  function dark() { return root.dataset.theme === 'dark'; }
  function colour(kind) { return CLASS[kind][dark() ? 'dark' : 'light']; }
  function neutral() { return dark() ? '233, 231, 226' : '27, 27, 25'; }

  function box(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* Draws the map into ctx.
   *
   * o.axis / o.originScreenY place world (0, o.originY) on screen and o.scale
   * converts world px to screen px; o.x0..o.x1 and o.y0..o.y1 bound what is
   * generated; o.paint(kind) returns the colour for an element class; o.verts
   * adds the polyline vertices, which only the region of interest draws. */
  function drawMap(ctx, o) {
    var s = o.scale, w = o.weight;

    function sx(x) { return o.axis + x * s; }
    function sy(y) { return (y - o.originY) * s + o.originScreenY; }

    // One vectorised element: a polyline sampled every VERT world px, with its
    // vertices marked the way a predicted map element is drawn.
    function element(kind, at, from, to) {
      var pts = [], y;
      for (y = from; y <= to; y += VERT) pts.push([sx(at(y)), sy(y)]);
      if (pts.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.strokeStyle = o.paint(kind);
      ctx.lineWidth = kind === 'boundary' ? w * 1.5 : w;
      ctx.stroke();

      if (!o.verts) return;
      ctx.fillStyle = o.paint(kind);
      for (i = 0; i < pts.length; i++) {
        ctx.beginPath();
        ctx.arc(pts[i][0], pts[i][1], w * 0.95, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function corridor(shift) {
      var at = function (off) {
        return function (y) { return centre(y) + shift + off; };
      };
      element('boundary', at(-ROAD_HALF), o.y0, o.y1);
      element('boundary', at(ROAD_HALF), o.y0, o.y1);
      for (var i = -2; i <= 2; i++) element('divider', at(i * LANE), o.y0, o.y1);
    }

    corridor(0);
    if (o.x0 < -SIDE + ROAD_HALF) corridor(-SIDE);
    if (o.x1 > SIDE - ROAD_HALF) corridor(SIDE);

    /* Cross roads. Their boundaries are horizontal, so they are drawn
       directly rather than through element(). */
    var j0 = Math.floor(o.y0 / JUNCTION), j1 = Math.ceil(o.y1 / JUNCTION);
    for (var j = j0; j <= j1; j++) {
      var jy = j * JUNCTION;
      ctx.strokeStyle = o.paint('boundary');
      ctx.lineWidth = w * 1.5;
      [-CROSS_HALF, CROSS_HALF].forEach(function (off) {
        ctx.beginPath();
        ctx.moveTo(sx(o.x0), sy(jy + off));
        ctx.lineTo(sx(o.x1), sy(jy + off));
        ctx.stroke();
        if (!o.verts) return;
        ctx.fillStyle = o.paint('boundary');
        for (var x = Math.ceil(o.x0 / VERT) * VERT; x <= o.x1; x += VERT) {
          ctx.beginPath();
          ctx.arc(sx(x), sy(jy + off), w * 0.95, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ctx.strokeStyle = o.paint('divider');
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(sx(o.x0), sy(jy));
      ctx.lineTo(sx(o.x1), sy(jy));
      ctx.stroke();

      /* Pedestrian crossings. In the map ground truth these are polygons, not
         painted stripes, so they are drawn as closed quads across each arm. */
      ctx.strokeStyle = o.paint('crossing');
      ctx.lineWidth = w * 1.1;
      [-SIDE, 0, SIDE].forEach(function (shift) {
        if (shift < o.x0 - ROAD_HALF || shift > o.x1 + ROAD_HALF) return;
        [-1, 1].forEach(function (dir) {
          var yy = jy + dir * (CROSS_HALF + 30);
          var c = centre(yy) + shift;
          ctx.beginPath();
          ctx.moveTo(sx(c - ROAD_HALF), sy(yy - 22));
          ctx.lineTo(sx(c + ROAD_HALF), sy(yy - 22));
          ctx.lineTo(sx(c + ROAD_HALF), sy(yy + 22));
          ctx.lineTo(sx(c - ROAD_HALF), sy(yy + 22));
          ctx.closePath();
          ctx.stroke();
        });
      });
    }
  }

  /* ---------------------------------------------------------------- *
   * Background, with the region of interest under the pointer
   * ---------------------------------------------------------------- */

  var bg = document.getElementById('map-bg');

  if (bg && bg.getContext) {
    var ctx = bg.getContext('2d');
    var lens = document.createElement('canvas');
    var lensCtx = lens.getContext('2d');
    var slab = document.createElement('canvas');
    var slabCtx = slab.getContext('2d');
    var slabY = null, slabDirty = true;

    // 30 x 60 m, at the aspect the model predicts into: narrow across the
    // road, long along it.
    var ROI_W = 210, ROI_H = 400, PAD = 26;
    var LW = ROI_W + PAD * 2, LH = ROI_H + PAD * 2;
    var PEAK = 0.95;

    var dpr = 1, vw = 0, vh = 0;
    var px = -1e5, py = -1e5;
    var glow = 0, tgt = 0;
    var queued = false, docY = 0;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      vw = window.innerWidth;
      vh = window.innerHeight;
      bg.width = slab.width = Math.ceil(vw * dpr);
      bg.height = slab.height = Math.ceil(vh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lens.width = Math.ceil(LW * dpr);
      lens.height = Math.ceil(LH * dpr);
      slabDirty = true;
      request();
    }

    function render() {
      queued = false;
      docY = window.scrollY;
      glow += (tgt - glow) * 0.17;
      if (Math.abs(tgt - glow) < 0.005) glow = tgt;

      var wy0 = docY * PARALLAX, ink = neutral();

      if (slabDirty || slabY !== docY) {
        slabCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        slabCtx.clearRect(0, 0, vw, vh);
        slabCtx.lineCap = 'round';
        drawMap(slabCtx, {
          axis: vw / 2, scale: 1, originY: wy0, originScreenY: 0,
          x0: -vw / 2 - 80, x1: vw / 2 + 80, y0: wy0 - 80, y1: wy0 + vh + 80,
          weight: 1,
          paint: function () { return 'rgba(' + ink + ', ' + (dark() ? 0.14 : 0.11) + ')'; }
        });
        slabY = docY;
        slabDirty = false;
      }

      ctx.clearRect(0, 0, vw, vh);
      ctx.drawImage(slab, 0, 0, slab.width, slab.height, 0, 0, vw, vh);

      if (glow > 0.02) {
        var left = px - LW / 2, top = py - LH / 2;
        var axis = vw / 2 - left;

        lensCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        lensCtx.clearRect(0, 0, LW, LH);
        lensCtx.lineCap = 'round';
        drawMap(lensCtx, {
          axis: axis, scale: 1, originY: wy0, originScreenY: -top,
          x0: -axis - 40, x1: LW - axis + 40,
          y0: wy0 + top - 40, y1: wy0 + top + LH + 40,
          weight: 1.5, verts: true,
          paint: function (kind) { return colour(kind); }
        });

        // Soft-edged rectangular mask: the crop, not a spotlight.
        lensCtx.globalCompositeOperation = 'destination-in';
        if ('filter' in lensCtx) lensCtx.filter = 'blur(15px)';
        lensCtx.fillStyle = 'rgba(0,0,0,' + glow * PEAK + ')';
        box(lensCtx, PAD, PAD, ROI_W, ROI_H, 10);
        lensCtx.fill();
        if ('filter' in lensCtx) lensCtx.filter = 'none';
        lensCtx.globalCompositeOperation = 'source-over';

        ctx.drawImage(lens, 0, 0, lens.width, lens.height, left, top, LW, LH);

        // Crop marks, so the region of interest reads as a range and not a glow.
        var x0 = px - ROI_W / 2, y0 = py - ROI_H / 2, t = 16;
        ctx.strokeStyle = 'rgba(' + ink + ', ' + glow * 0.34 + ')';
        ctx.lineWidth = 1;
        [[x0, y0, 1, 1], [x0 + ROI_W, y0, -1, 1],
         [x0, y0 + ROI_H, 1, -1], [x0 + ROI_W, y0 + ROI_H, -1, -1]]
          .forEach(function (c) {
            ctx.beginPath();
            ctx.moveTo(c[0] + c[2] * t, c[1]);
            ctx.lineTo(c[0], c[1]);
            ctx.lineTo(c[0], c[1] + c[3] * t);
            ctx.stroke();
          });
        ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(' + ink + ', ' + glow * 0.42 + ')';
        ctx.fillText('60 × 30 m', x0, y0 - 7);
      }

      if (glow !== tgt) request();
    }

    function request() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(render);
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resmap:theme', function () { slabDirty = true; request(); });

    if (!reduceMotion.matches) {
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        px = e.clientX; py = e.clientY; tgt = 1;
        request();
      }, { passive: true });
      document.addEventListener('pointerleave', function () { tgt = 0; request(); });
    }
  }

  /* ---------------------------------------------------------------- *
   * The route: the document as one road, the car as the scroll thumb
   * ---------------------------------------------------------------- */

  var rail = document.getElementById('rail');
  var canvas = document.getElementById('rail-map');

  if (rail && canvas && canvas.getContext) {
    var rctx = canvas.getContext('2d');
    var tip = document.getElementById('rail-tip');
    var tipName = document.getElementById('rail-name');
    var tipPct = document.getElementById('rail-pct');

    var RW = 46;            // rail width, css px
    var CAP = 30;           // clear space at each end so the car never clips
    var MIN_VIEWPORT = 900;

    var rdpr = 1, RH = 0;
    var stops = [];
    var dragging = false, hovering = false;
    var pending = false;
    var accent = '#0e4a84';

    function maxScroll() {
      return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    }
    function progress() {
      return Math.min(1, Math.max(0, window.scrollY / maxScroll()));
    }
    function carY(p) { return CAP + p * (RH - CAP * 2); }

    function measure() {
      var max = maxScroll();
      stops = Array.prototype.slice
        .call(document.querySelectorAll('main section[id]'))
        .map(function (s) {
          var link = document.querySelector('.topbar a[href="#' + s.id + '"]');
          var h2 = s.querySelector('h2');
          var top = s.getBoundingClientRect().top + window.scrollY;
          return {
            id: s.id,
            p: Math.min(1, Math.max(0, top / max)),
            name: link ? link.textContent
                       : (h2 ? h2.textContent.replace(/^\s*\d+\s*/, '') : s.id)
          };
        });
    }

    function readAccent() {
      accent = (getComputedStyle(root).getPropertyValue('--accent') || '').trim() || '#0e4a84';
    }

    function resize() {
      var on = window.innerWidth >= MIN_VIEWPORT;
      rail.hidden = !on;
      root.classList.toggle('has-rail', on);
      if (!on) return;

      rdpr = Math.min(window.devicePixelRatio || 1, 2);
      RH = window.innerHeight;
      canvas.width = Math.ceil(RW * rdpr);
      canvas.height = Math.ceil(RH * rdpr);
      canvas.style.width = RW + 'px';
      canvas.style.height = RH + 'px';
      rctx.setTransform(rdpr, 0, 0, rdpr, 0, 0);
      readAccent();
      measure();
      draw();
    }

    // Top-down vehicle, nose down the rail, because down the page is forward.
    function drawCar(y) {
      var len = 26, wide = 13, x = RW / 2;
      rctx.save();
      rctx.translate(x, y);

      var beam = rctx.createLinearGradient(0, len * 0.5, 0, len * 3.2);
      beam.addColorStop(0, 'rgba(255, 214, 130, .32)');
      beam.addColorStop(1, 'rgba(255, 214, 130, 0)');
      rctx.fillStyle = beam;
      rctx.beginPath();
      rctx.moveTo(-wide * 0.34, len * 0.5);
      rctx.lineTo(-wide * 1.25, len * 3.2);
      rctx.lineTo(wide * 1.25, len * 3.2);
      rctx.lineTo(wide * 0.34, len * 0.5);
      rctx.closePath();
      rctx.fill();

      rctx.fillStyle = accent;
      box(rctx, -wide / 2, -len / 2, wide, len, 3);
      rctx.fill();

      rctx.fillStyle = 'rgba(255,255,255,.62)';
      box(rctx, -wide / 2 + 2.2, -len * 0.04, wide - 4.4, len * 0.28, 1.5);
      rctx.fill();

      rctx.fillStyle = 'rgba(255,236,186,.95)';
      rctx.fillRect(-wide / 2 + 1.6, len / 2 - 3, 3, 2);
      rctx.fillRect(wide / 2 - 4.6, len / 2 - 3, 3, 2);
      rctx.restore();
    }

    function draw() {
      pending = false;
      if (rail.hidden) return;

      var p = progress(), ink = neutral();
      var cy = carY(p);
      var mid = RW / 2, half = RW * 0.30, lane = RW * 0.11;

      rctx.clearRect(0, 0, RW, RH);
      rctx.lineCap = 'round';

      // Road boundaries and lane dividers, running the height of the viewport.
      rctx.lineWidth = 1.3;
      rctx.strokeStyle = colour('boundary');
      rctx.globalAlpha = 0.55;
      [-half, half].forEach(function (off) {
        rctx.beginPath();
        rctx.moveTo(mid + off, CAP * 0.4);
        rctx.lineTo(mid + off, RH - CAP * 0.4);
        rctx.stroke();
      });
      rctx.lineWidth = 1;
      rctx.strokeStyle = colour('divider');
      rctx.globalAlpha = 0.4;
      [-lane, lane].forEach(function (off) {
        rctx.beginPath();
        rctx.moveTo(mid + off, CAP * 0.4);
        rctx.lineTo(mid + off, RH - CAP * 0.4);
        rctx.stroke();
      });
      rctx.globalAlpha = 1;

      // Every section is a junction along the route.
      stops.forEach(function (s) {
        var y = carY(s.p);
        var passed = s.p <= p + 0.002;
        rctx.strokeStyle = colour('crossing');
        rctx.globalAlpha = passed ? 0.32 : 0.7;
        rctx.lineWidth = 1;
        rctx.beginPath();
        rctx.moveTo(mid - half, y);
        rctx.lineTo(mid + half, y);
        rctx.stroke();
        rctx.globalAlpha = 1;

        rctx.fillStyle = 'rgba(' + ink + ', ' + (passed ? 0.22 : 0.42) + ')';
        rctx.beginPath();
        rctx.arc(mid + half + 4, y, 1.7, 0, Math.PI * 2);
        rctx.fill();
      });

      // The stretch already driven.
      rctx.strokeStyle = accent;
      rctx.globalAlpha = 0.22;
      rctx.lineWidth = 2;
      rctx.beginPath();
      rctx.moveTo(mid, CAP * 0.4);
      rctx.lineTo(mid, cy);
      rctx.stroke();
      rctx.globalAlpha = 1;

      drawCar(cy);

      if (tip && (hovering || dragging)) {
        var here = stops[0];
        stops.forEach(function (s) { if (s.p <= p + 0.002) here = s; });
        tipName.textContent = here ? here.name : '';
        tipPct.textContent = Math.round(p * 100) + '%';
        tip.hidden = false;
        tip.style.top = Math.round(cy) + 'px';
      } else if (tip) {
        tip.hidden = true;
      }
    }

    function request() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(draw);
    }

    /* Dragging the car is dragging the thumb: the pointer's position on the
       rail is the position in the document, one to one. */
    function seek(clientY) {
      var rect = canvas.getBoundingClientRect();
      var p = (clientY - rect.top - CAP) / (RH - CAP * 2);
      window.scrollTo(0, Math.min(1, Math.max(0, p)) * maxScroll());
    }

    canvas.addEventListener('pointerdown', function (e) {
      dragging = true;
      rail.classList.add('dragging');
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      seek(e.clientY);
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (dragging) seek(e.clientY);
    });
    function release(e) {
      if (!dragging) return;
      dragging = false;
      rail.classList.remove('dragging');
      if (canvas.releasePointerCapture && e && e.pointerId !== undefined) {
        try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* gone */ }
      }
      request();
    }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    rail.addEventListener('pointerenter', function () { hovering = true; request(); });
    rail.addEventListener('pointerleave', function () { hovering = false; request(); });

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('load', function () { measure(); draw(); });
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resmap:theme', function () { readAccent(); draw(); });
  }
})();
