/* ReSMap project page — the map behind the page, and the ego view on top of it.
 *
 * One procedural world, drawn twice. As a full-viewport background it is a
 * faint vectorised road that the pointer reveals in its element colours,
 * which is the model's ROI sweeping over a map it is building. In the corner
 * it is a top-down ego view: scrolling the page drives the car forward, and
 * the page's own sections are the landmarks along the road.
 *
 * There are no assets — every polyline here is generated from the two sines
 * in World.centre().
 */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------------- *
   * The world
   * ---------------------------------------------------------------- */

  var LANE = 190;         // world px between lane dividers
  var CROSSING = 2400;    // world px between pedestrian crossings
  var PARALLAX = 0.75;    // document px -> world px for the background

  var World = {
    // Lateral offset of the road centreline at a given distance along it.
    centre: function (y) {
      return Math.sin(y / 880) * 92 + Math.sin(y / 2450 + 1.7) * 165;
    },
    heading: function (y) {
      return Math.atan2(this.centre(y + 10) - this.centre(y - 10), 20);
    }
  };

  // Element classes carry the usual online-mapping colours, so anyone who has
  // looked at a MapTR figure reads them without a legend.
  var CLASS = {
    boundary: { light: '#2f7d4f', dark: '#5cc084' },
    divider:  { light: '#c2831f', dark: '#e0a94a' },
    crossing: { light: '#2f6fb5', dark: '#6aa6e8' }
  };

  function colour(kind) {
    return CLASS[kind][root.dataset.theme === 'dark' ? 'dark' : 'light'];
  }

  function neutral() {
    return root.dataset.theme === 'dark' ? '233, 231, 226' : '27, 27, 25';
  }

  /* Draws one screenful of road into ctx.
   *
   * project(worldY) -> screen y, axis is the screen x of the centreline,
   * half is the corridor half-width in screen px, and scale converts world
   * lateral offsets to screen px. `paint` returns the stroke style for an
   * element class, so the same geometry serves the faint background pass and
   * the coloured reveal pass. */
  function drawRoad(ctx, opts) {
    var y0 = opts.top, y1 = opts.bottom, scale = opts.scale;
    var axis = opts.axis, half = opts.half;
    var step = 14 / scale;

    function sx(wy, offset) {
      return axis + (World.centre(wy) + (offset || 0)) * scale;
    }
    function sy(wy) { return (wy - opts.originY) * scale + opts.originScreenY; }

    function ribbon(offset, style, width, dash) {
      ctx.beginPath();
      var started = false;
      for (var wy = y0; wy <= y1; wy += step) {
        var x = sx(wy, offset), y = sy(wy);
        if (started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; }
      }
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.setLineDash(dash || []);
      ctx.lineDashOffset = dash ? -opts.originY * scale : 0;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Road boundaries.
    ribbon(-half / scale, opts.paint('boundary'), opts.weight * 1.35);
    ribbon(half / scale, opts.paint('boundary'), opts.weight * 1.35);

    // Lane dividers.
    var lanes = Math.max(1, Math.round(half / scale / LANE));
    for (var i = -lanes + 1; i < lanes; i++) {
      if (i === 0 && lanes > 1) continue;
      ribbon(i * LANE, opts.paint('divider'), opts.weight,
             [26 * scale, 30 * scale]);
    }

    // Pedestrian crossings: bars laid along the travel direction, spaced out
    // across the corridor.
    var first = Math.floor(y0 / CROSSING) * CROSSING;
    var bar = 52 * scale;
    for (var wy = first; wy <= y1 + CROSSING; wy += CROSSING) {
      ctx.strokeStyle = opts.paint('crossing');
      ctx.lineWidth = opts.weight * 1.7;
      for (var t = -0.8; t <= 0.81; t += 0.229) {
        var cx = sx(wy, t * (half / scale)), cy = sy(wy);
        ctx.beginPath();
        ctx.moveTo(cx, cy - bar);
        ctx.lineTo(cx, cy + bar);
        ctx.stroke();
      }
    }
  }

  /* ---------------------------------------------------------------- *
   * Background: faint map, revealed in colour around the pointer
   * ---------------------------------------------------------------- */

  var bg = document.getElementById('map-bg');

  if (bg && bg.getContext) {
    var ctx = bg.getContext('2d');
    var lens = document.createElement('canvas');
    var lensCtx = lens.getContext('2d');
    // The faint pass only changes when the page scrolls, so it is cached and
    // blitted while the pointer moves over it.
    var slab = document.createElement('canvas');
    var slabCtx = slab.getContext('2d');
    var slabY = null, slabDirty = true;

    var R = 190;                 // reveal radius, css px
    var dpr = 1, vw = 0, vh = 0;
    var px = -1e5, py = -1e5;
    var glow = 0, target = 0;
    var queued = false;
    var docY = 0;

    function geometry() {
      return {
        axis: vw / 2,
        half: Math.min(vw * 0.44, 660),
        scale: 1,
        originY: docY * PARALLAX,
        originScreenY: 0,
        top: docY * PARALLAX - 40,
        bottom: docY * PARALLAX + vh + 40,
        weight: 1
      };
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      vw = window.innerWidth;
      vh = window.innerHeight;
      bg.width = Math.ceil(vw * dpr);
      bg.height = Math.ceil(vh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lens.width = Math.ceil(R * 2 * dpr);
      lens.height = Math.ceil(R * 2 * dpr);
      slab.width = bg.width;
      slab.height = bg.height;
      slabDirty = true;
      request();
    }

    function render() {
      queued = false;
      docY = window.scrollY;
      glow += (target - glow) * 0.16;
      if (Math.abs(target - glow) < 0.005) glow = target;

      var g = geometry();
      var ink = neutral();

      if (slabDirty || slabY !== docY) {
        slabCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        slabCtx.clearRect(0, 0, vw, vh);
        slabCtx.lineCap = 'round';
        g.paint = function () {
          return 'rgba(' + ink + ', ' + (root.dataset.theme === 'dark' ? 0.10 : 0.085) + ')';
        };
        drawRoad(slabCtx, g);
        slabY = docY;
        slabDirty = false;
      }

      ctx.clearRect(0, 0, vw, vh);
      ctx.lineCap = 'round';
      ctx.drawImage(slab, 0, 0, slab.width, slab.height, 0, 0, vw, vh);

      // Coloured pass, clipped to a soft disc under the pointer. Rendered at
      // lens size rather than viewport size, so the cost does not grow with
      // the display.
      if (glow > 0.02) {
        lensCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        lensCtx.clearRect(0, 0, R * 2, R * 2);
        lensCtx.lineCap = 'round';

        var lensGeom = geometry();
        lensGeom.axis = g.axis - (px - R);
        lensGeom.originScreenY = -(py - R);
        lensGeom.weight = 1.5;
        lensGeom.paint = function (kind) { return colour(kind); };
        drawRoad(lensCtx, lensGeom);

        // PEAK keeps the reveal a tint rather than a poster: text sits over
        // this, so full-saturation strokes would fight it.
        var PEAK = 0.58;
        var fade = lensCtx.createRadialGradient(R, R, R * 0.12, R, R, R);
        fade.addColorStop(0, 'rgba(0,0,0,' + glow * PEAK + ')');
        fade.addColorStop(0.62, 'rgba(0,0,0,' + glow * PEAK * 0.7 + ')');
        fade.addColorStop(1, 'rgba(0,0,0,0)');
        lensCtx.globalCompositeOperation = 'destination-in';
        lensCtx.fillStyle = fade;
        lensCtx.fillRect(0, 0, R * 2, R * 2);
        lensCtx.globalCompositeOperation = 'source-over';

        ctx.drawImage(lens, 0, 0, lens.width, lens.height,
                      px - R, py - R, R * 2, R * 2);
      }

      if (glow !== target) request();
    }

    function request() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(render);
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resmap:theme', function () {
      slabDirty = true;
      request();
    });

    if (!reduceMotion.matches) {
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        px = e.clientX; py = e.clientY;
        target = 1;
        request();
      }, { passive: true });
      document.addEventListener('pointerleave', function () {
        target = 0;
        request();
      });
    }
  }

  /* ---------------------------------------------------------------- *
   * Ego view: scrolling drives the car
   * ---------------------------------------------------------------- */

  var panel = document.getElementById('drive');
  var map = document.getElementById('drive-map');

  if (panel && map && map.getContext) {
    var mctx = map.getContext('2d');
    var nameEl = document.getElementById('drive-section');
    var distEl = document.getElementById('drive-dist');
    var jump = document.getElementById('drive-label');

    var W = 150, H = 200;        // css px
    var SCALE = 0.082;           // world px -> panel px
    var EGO_Y = 0.64;            // ego sits this far down the panel
    var mdpr = 1;
    var landmarks = [];
    var ahead = null;
    var pending = false;

    function measure() {
      landmarks = Array.prototype.slice
        .call(document.querySelectorAll('main section[id]'))
        .map(function (s) {
          var link = document.querySelector('.topbar a[href="#' + s.id + '"]');
          var h2 = s.querySelector('h2');
          return {
            id: s.id,
            y: s.getBoundingClientRect().top + window.scrollY,
            name: link ? link.textContent
                       : (h2 ? h2.textContent.replace(/^\s*\d+\s*/, '') : s.id)
          };
        });
    }

    function resize() {
      mdpr = Math.min(window.devicePixelRatio || 1, 2);
      map.width = Math.ceil(W * mdpr);
      map.height = Math.ceil(H * mdpr);
      map.style.width = W + 'px';
      map.style.height = H + 'px';
      mctx.setTransform(mdpr, 0, 0, mdpr, 0, 0);
      panel.hidden = window.innerWidth < 900;
      measure();
      draw();
    }

    // A top-down vehicle: body, cabin, and a pair of headlight cones.
    function drawCar(x, y, angle) {
      var len = 46, wide = 21;
      mctx.save();
      mctx.translate(x, y);
      mctx.rotate(angle);

      var beam = mctx.createLinearGradient(0, -len * 0.5, 0, -len * 2.4);
      beam.addColorStop(0, 'rgba(255, 214, 130, .30)');
      beam.addColorStop(1, 'rgba(255, 214, 130, 0)');
      mctx.fillStyle = beam;
      mctx.beginPath();
      mctx.moveTo(-wide * 0.36, -len * 0.5);
      mctx.lineTo(-wide * 1.5, -len * 2.4);
      mctx.lineTo(wide * 1.5, -len * 2.4);
      mctx.lineTo(wide * 0.36, -len * 0.5);
      mctx.closePath();
      mctx.fill();

      mctx.fillStyle = getComputedStyle(root).getPropertyValue('--accent').trim() || '#0e4a84';
      roundRect(-wide / 2, -len / 2, wide, len, 5);
      mctx.fill();

      mctx.fillStyle = 'rgba(255, 255, 255, .58)';
      roundRect(-wide / 2 + 3.5, -len * 0.20, wide - 7, len * 0.30, 2.5);
      mctx.fill();

      mctx.fillStyle = 'rgba(255, 232, 175, .95)';
      mctx.fillRect(-wide / 2 + 2.5, -len / 2 + 1.5, 4, 2.5);
      mctx.fillRect(wide / 2 - 6.5, -len / 2 + 1.5, 4, 2.5);
      mctx.restore();
    }

    function roundRect(x, y, w, h, r) {
      mctx.beginPath();
      mctx.moveTo(x + r, y);
      mctx.arcTo(x + w, y, x + w, y + h, r);
      mctx.arcTo(x + w, y + h, x, y + h, r);
      mctx.arcTo(x, y + h, x, y, r);
      mctx.arcTo(x, y, x + w, y, r);
      mctx.closePath();
    }

    function draw() {
      pending = false;
      if (panel.hidden) return;

      var ego = window.scrollY;
      var top = ego - (H * EGO_Y) / SCALE;
      var bottom = ego + (H * (1 - EGO_Y)) / SCALE;

      mctx.clearRect(0, 0, W, H);
      mctx.lineCap = 'round';

      drawRoad(mctx, {
        axis: W / 2,
        half: W * 0.40,
        scale: SCALE,
        originY: ego,
        originScreenY: H * EGO_Y,
        top: top - 200,
        bottom: bottom + 200,
        weight: 1.1,
        paint: function (kind) { return colour(kind); }
      });

      // Landmarks: one tick per section, brighter once passed.
      var ink = neutral();
      ahead = null;
      landmarks.forEach(function (m) {
        var y = (m.y - ego) * SCALE + H * EGO_Y;
        if (y < -8 || y > H + 8) {
          if (m.y > ego && !ahead) ahead = m;
          return;
        }
        var x = W / 2 + World.centre(m.y) * SCALE;
        var passed = m.y <= ego + 1;
        mctx.strokeStyle = 'rgba(' + ink + ', ' + (passed ? 0.28 : 0.5) + ')';
        mctx.lineWidth = 1;
        mctx.beginPath();
        mctx.moveTo(x - W * 0.34, y);
        mctx.lineTo(x + W * 0.34, y);
        mctx.stroke();
        if (!passed && !ahead) ahead = m;
      });

      if (!ahead) {
        for (var i = 0; i < landmarks.length; i++) {
          if (landmarks[i].y > ego + 1) { ahead = landmarks[i]; break; }
        }
      }

      drawCar(W / 2 + World.centre(ego) * SCALE, H * EGO_Y, World.heading(ego));

      if (ahead) {
        nameEl.textContent = ahead.name;
        distEl.textContent = Math.round((ahead.y - window.scrollY) / 10) + ' m';
        jump.disabled = false;
      } else {
        nameEl.textContent = 'End of route';
        distEl.textContent = '';
        jump.disabled = true;
      }
    }

    function request() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(draw);
    }

    jump.addEventListener('click', function () {
      if (ahead) document.getElementById(ahead.id).scrollIntoView({ behavior: 'smooth' });
    });

    // Clicking the road jumps to whichever landmark is nearest that point.
    map.addEventListener('click', function (e) {
      var box = map.getBoundingClientRect();
      var wanted = window.scrollY + ((e.clientY - box.top) - H * EGO_Y) / SCALE;
      var best = null, bestD = Infinity;
      landmarks.forEach(function (m) {
        var d = Math.abs(m.y - wanted);
        if (d < bestD) { bestD = d; best = m; }
      });
      if (best) document.getElementById(best.id).scrollIntoView({ behavior: 'smooth' });
    });

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('load', function () { measure(); draw(); });
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resmap:theme', function () { draw(); });
  }
})();
