/* ReSMap project page — the map behind the page, and the ego view on top of it.
 *
 * One procedural world, drawn twice. As a full-viewport background it is a
 * faint vectorised map that the pointer reveals in its element colours, which
 * is the model's ROI sweeping over a map it is building. In the corner it is
 * a top-down ego view: scrolling the page drives the car forward, and the
 * page's own sections are the landmarks along the route.
 *
 * There are no assets. Every polyline here comes out of World.centre() and
 * the hash below, so the same block always generates the same buildings.
 */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------------- *
   * The world, in world px
   * ---------------------------------------------------------------- */

  var ROAD_HALF = 132;    // main corridor, centreline to boundary
  var LANE = 44;          // spacing between lane dividers
  var BLOCK = 520;        // distance between cross streets
  var CROSS_HALF = 84;    // cross street half width
  var GRID_X = 116;       // parcel grid
  var GRID_Y = 96;
  var PARALLAX = 0.5;     // document px -> world px

  var World = {
    centre: function (y) {
      return Math.sin(y / 560) * 58 + Math.sin(y / 1750 + 1.7) * 96;
    },
    heading: function (y) {
      return Math.atan2(this.centre(y + 12) - this.centre(y - 12), 24);
    }
  };

  // Stable pseudo-random: the same cell always yields the same building.
  function hash(a, b) {
    var x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // The usual online-mapping palette, so anyone who has looked at a MapTR
  // figure reads the reveal without a legend.
  var CLASS = {
    boundary: { light: '#2f7d4f', dark: '#5cc084' },
    divider:  { light: '#c2831f', dark: '#e0a94a' },
    crossing: { light: '#2f6fb5', dark: '#6aa6e8' },
    parcel:   { light: '#7a7469', dark: '#8e887c' },
    vehicle:  { light: '#b4453c', dark: '#e08b80' }
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

  /* Draws the world into ctx.
   *
   * opts.axis / opts.originScreenY place world (0, opts.originY) on screen,
   * opts.scale converts world px to screen px, opts.x0/x1 and opts.y0/y1 bound
   * the region to generate, and opts.paint(kind) returns a stroke or fill for
   * each element class. opts.detail adds the parked vehicles, which only the
   * reveal draws. */
  function drawWorld(ctx, opts) {
    var s = opts.scale, w = opts.weight;
    var paint = opts.paint;

    function sx(wx) { return opts.axis + wx * s; }
    function sy(wy) { return (wy - opts.originY) * s + opts.originScreenY; }

    /* ---- parcels: the city blocks the roads run between ---- */
    ctx.lineWidth = w * 0.9;
    var cx0 = Math.floor(opts.x0 / GRID_X), cx1 = Math.ceil(opts.x1 / GRID_X);
    var cy0 = Math.floor(opts.y0 / GRID_Y), cy1 = Math.ceil(opts.y1 / GRID_Y);

    for (var gy = cy0; gy <= cy1; gy++) {
      for (var gx = cx0; gx <= cx1; gx++) {
        if (hash(gx, gy) > 0.62) continue;                       // vacant lot
        var bx = gx * GRID_X, by = gy * GRID_Y;
        var midY = by + GRID_Y / 2;
        // Keep clear of the corridor and of every cross street.
        if (Math.abs(bx + GRID_X / 2 - World.centre(midY)) < ROAD_HALF + 46) continue;
        if (Math.abs(((midY % BLOCK) + BLOCK) % BLOCK - BLOCK / 2) > BLOCK / 2 - CROSS_HALF - 40) continue;

        var padX = 10 + hash(gx, gy + 91) * 22;
        var padY = 10 + hash(gx + 53, gy) * 20;
        ctx.strokeStyle = paint('parcel');
        box(ctx, sx(bx + padX), sy(by + padY),
            (GRID_X - padX * 2) * s, (GRID_Y - padY * 2) * s, 1.5 * s);
        ctx.stroke();
      }
    }

    /* ---- cross streets ---- */
    ctx.lineWidth = w * 1.25;
    var b0 = Math.floor(opts.y0 / BLOCK), b1 = Math.ceil(opts.y1 / BLOCK);
    for (var b = b0; b <= b1; b++) {
      var cy = b * BLOCK;
      ctx.strokeStyle = paint('boundary');
      [-CROSS_HALF, CROSS_HALF].forEach(function (off) {
        ctx.beginPath();
        ctx.moveTo(sx(opts.x0), sy(cy + off));
        ctx.lineTo(sx(opts.x1), sy(cy + off));
        ctx.stroke();
      });

      // Stop lines and a crossing on each approach to the intersection.
      var c = World.centre(cy);
      ctx.strokeStyle = paint('crossing');
      ctx.lineWidth = w * 1.5;
      [-1, 1].forEach(function (dir) {
        var yy = cy + dir * (CROSS_HALF + 26);
        for (var t = -0.82; t <= 0.83; t += 0.235) {
          var x = sx(c + t * ROAD_HALF);
          ctx.beginPath();
          ctx.moveTo(x, sy(yy - 17));
          ctx.lineTo(x, sy(yy + 17));
          ctx.stroke();
        }
      });
      ctx.lineWidth = w * 1.25;
    }

    /* ---- the main corridor ---- */
    var step = 16 / s;

    function ribbon(offset, style, width) {
      ctx.beginPath();
      var started = false;
      for (var wy = opts.y0; wy <= opts.y1; wy += step) {
        var x = sx(World.centre(wy) + offset), y = sy(wy);
        if (started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; }
      }
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.stroke();
    }

    ribbon(-ROAD_HALF, paint('boundary'), w * 1.4);
    ribbon(ROAD_HALF, paint('boundary'), w * 1.4);
    for (var i = -2; i <= 2; i++) {
      if (i === 0) continue;
      ribbon(i * LANE, paint('divider'), w * 0.9);
    }
    ribbon(0, paint('divider'), w * 1.15);

    /* ---- detected vehicles: reveal pass only ---- */
    if (!opts.detail) return;

    ctx.lineWidth = w * 1.2;
    for (var v = Math.floor(opts.y0 / 210); v <= Math.ceil(opts.y1 / 210); v++) {
      if (hash(v, 7.3) > 0.5) continue;
      var vy = v * 210 + hash(v, 11.1) * 90;
      var lane = Math.round((hash(v, 3.7) - 0.5) * 4) * (LANE * 0.75);
      var vx = World.centre(vy) + lane;
      ctx.strokeStyle = paint('vehicle');
      box(ctx, sx(vx - 17), sy(vy - 34), 34 * s, 68 * s, 3 * s);
      ctx.stroke();
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

    var R = 235;                 // reveal radius, css px
    var PEAK = 0.92;             // how strongly the reveal tints
    var dpr = 1, vw = 0, vh = 0;
    var px = -1e5, py = -1e5;
    var glow = 0, target = 0;
    var queued = false;
    var docY = 0;

    function frame(axis, screenY, x0, x1, y0, y1, weight) {
      return {
        axis: axis, scale: 1, originY: docY * PARALLAX, originScreenY: screenY,
        x0: x0, x1: x1, y0: y0, y1: y1, weight: weight
      };
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      vw = window.innerWidth;
      vh = window.innerHeight;
      bg.width = slab.width = Math.ceil(vw * dpr);
      bg.height = slab.height = Math.ceil(vh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lens.width = lens.height = Math.ceil(R * 2 * dpr);
      slabDirty = true;
      request();
    }

    function render() {
      queued = false;
      docY = window.scrollY;
      glow += (target - glow) * 0.16;
      if (Math.abs(target - glow) < 0.005) glow = target;

      var wy0 = docY * PARALLAX, ink = neutral();

      if (slabDirty || slabY !== docY) {
        var g = frame(vw / 2, 0, -vw / 2 - 60, vw / 2 + 60, wy0 - 60, wy0 + vh + 60, 1);
        g.paint = function () {
          return 'rgba(' + ink + ', ' + (dark() ? 0.13 : 0.10) + ')';
        };
        slabCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        slabCtx.clearRect(0, 0, vw, vh);
        slabCtx.lineCap = 'round';
        drawWorld(slabCtx, g);
        slabY = docY;
        slabDirty = false;
      }

      ctx.clearRect(0, 0, vw, vh);
      ctx.drawImage(slab, 0, 0, slab.width, slab.height, 0, 0, vw, vh);

      if (glow > 0.02) {
        var axis = vw / 2 - (px - R);
        var l = frame(axis, -(py - R),
                      -axis - 40, 2 * R - axis + 40,
                      wy0 + py - R - 40, wy0 + py + R + 40, 1.5);
        l.paint = function (kind) { return colour(kind); };
        l.detail = true;

        lensCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        lensCtx.clearRect(0, 0, R * 2, R * 2);
        lensCtx.lineCap = 'round';
        drawWorld(lensCtx, l);

        var fade = lensCtx.createRadialGradient(R, R, R * 0.30, R, R, R);
        fade.addColorStop(0, 'rgba(0,0,0,' + glow * PEAK + ')');
        fade.addColorStop(0.70, 'rgba(0,0,0,' + glow * PEAK * 0.66 + ')');
        fade.addColorStop(1, 'rgba(0,0,0,0)');
        lensCtx.globalCompositeOperation = 'destination-in';
        lensCtx.fillStyle = fade;
        lensCtx.fillRect(0, 0, R * 2, R * 2);
        lensCtx.globalCompositeOperation = 'source-over';

        ctx.drawImage(lens, 0, 0, lens.width, lens.height, px - R, py - R, R * 2, R * 2);

        // The ROI itself, so the interaction is legible rather than ambient.
        ctx.beginPath();
        ctx.arc(px, py, R * 0.93, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(' + ink + ', ' + glow * 0.16 + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
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
    window.addEventListener('resmap:theme', function () { slabDirty = true; request(); });

    if (!reduceMotion.matches) {
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        px = e.clientX; py = e.clientY;
        target = 1;
        request();
      }, { passive: true });
      document.addEventListener('pointerleave', function () { target = 0; request(); });
    }
  }

  /* ---------------------------------------------------------------- *
   * Ego view: scrolling drives the car
   *
   * The car points down the panel, because down the page is forward. The
   * road ahead is therefore below it and what has been read is above, and
   * scrolling brings the world up to meet the car rather than away from it.
   * ---------------------------------------------------------------- */

  var panel = document.getElementById('drive');
  var map = document.getElementById('drive-map');

  if (panel && map && map.getContext) {
    var mctx = map.getContext('2d');
    var nameEl = document.getElementById('drive-section');
    var distEl = document.getElementById('drive-dist');
    var jump = document.getElementById('drive-label');

    var W = 150, H = 200;
    var SCALE = 0.17;            // world px -> panel px
    var EGO_Y = 0.30;            // the car sits this far down; ahead is below
    var mdpr = 1;
    var landmarks = [];
    var ahead = null;
    var pending = false;
    var lastY = window.scrollY, speed = 0;
    var accent = null;   // reading a custom property forces style, so cache it

    function readAccent() {
      accent = (getComputedStyle(root).getPropertyValue('--accent') || '').trim() || '#0e4a84';
    }

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

    // Top-down vehicle, nose toward +y: body, cabin, headlights and a beam.
    function drawCar(x, y, angle, accent) {
      var len = 30, wide = 14;
      mctx.save();
      mctx.translate(x, y);
      mctx.rotate(-angle);

      var beam = mctx.createLinearGradient(0, len * 0.5, 0, len * 2.8);
      beam.addColorStop(0, 'rgba(255, 214, 130, .34)');
      beam.addColorStop(1, 'rgba(255, 214, 130, 0)');
      mctx.fillStyle = beam;
      mctx.beginPath();
      mctx.moveTo(-wide * 0.34, len * 0.5);
      mctx.lineTo(-wide * 1.7, len * 2.8);
      mctx.lineTo(wide * 1.7, len * 2.8);
      mctx.lineTo(wide * 0.34, len * 0.5);
      mctx.closePath();
      mctx.fill();

      mctx.fillStyle = accent;
      box(mctx, -wide / 2, -len / 2, wide, len, 3.5);
      mctx.fill();

      mctx.fillStyle = 'rgba(255, 255, 255, .6)';
      box(mctx, -wide / 2 + 2.5, -len * 0.02, wide - 5, len * 0.26, 1.8);
      mctx.fill();

      mctx.fillStyle = 'rgba(255, 236, 186, .95)';
      mctx.fillRect(-wide / 2 + 1.8, len / 2 - 3.4, 3.2, 2.2);
      mctx.fillRect(wide / 2 - 5, len / 2 - 3.4, 3.2, 2.2);
      mctx.restore();
    }

    function draw() {
      pending = false;
      if (panel.hidden) return;

      var doc = window.scrollY;
      speed = speed * 0.82 + (doc - lastY) * 0.18;
      lastY = doc;

      var ego = doc * PARALLAX;
      var top = ego - (H * EGO_Y) / SCALE;
      var bottom = ego + (H * (1 - EGO_Y)) / SCALE;
      var halfW = (W / 2) / SCALE;
      if (accent === null) readAccent();

      mctx.clearRect(0, 0, W, H);
      mctx.lineCap = 'round';

      drawWorld(mctx, {
        axis: W / 2, scale: SCALE, originY: ego, originScreenY: H * EGO_Y,
        x0: -halfW - 60, x1: halfW + 60, y0: top - 120, y1: bottom + 120,
        weight: 1, detail: true,
        paint: function (kind) { return colour(kind); }
      });

      // Landmarks: one tick per section, dimmer once passed.
      var ink = neutral();
      ahead = null;
      landmarks.forEach(function (m) {
        var my = m.y * PARALLAX;
        var y = (my - ego) * SCALE + H * EGO_Y;
        var passed = m.y <= doc + 2;
        if (!passed && !ahead) ahead = m;
        if (y < -6 || y > H + 6) return;
        var x = W / 2 + World.centre(my) * SCALE;
        mctx.strokeStyle = 'rgba(' + ink + ', ' + (passed ? 0.22 : 0.46) + ')';
        mctx.lineWidth = 1;
        mctx.beginPath();
        mctx.moveTo(x - W * 0.30, y);
        mctx.lineTo(x + W * 0.30, y);
        mctx.stroke();
        mctx.fillStyle = 'rgba(' + ink + ', ' + (passed ? 0.3 : 0.6) + ')';
        mctx.beginPath();
        mctx.arc(x + W * 0.30, y, 1.6, 0, Math.PI * 2);
        mctx.fill();
      });

      // Motion streaks trailing behind the car, so the direction reads.
      var trail = Math.min(30, Math.abs(speed) * 0.75);
      if (trail > 1.5) {
        var back = speed > 0 ? -1 : 1;
        for (var t = 0; t < 4; t++) {
          var off = 10 + t * 9;
          var yy = H * EGO_Y + back * off;
          var xx = W / 2 + World.centre(ego + back * off / SCALE) * SCALE;
          mctx.strokeStyle = 'rgba(' + ink + ', ' + (0.22 * (1 - t / 4)) + ')';
          mctx.lineWidth = 1.4;
          mctx.beginPath();
          mctx.moveTo(xx - 4 + t * 2, yy);
          mctx.lineTo(xx - 4 + t * 2, yy + back * trail * 0.4);
          mctx.stroke();
        }
      }

      drawCar(W / 2 + World.centre(ego) * SCALE, H * EGO_Y, World.heading(ego), accent);

      if (ahead) {
        nameEl.textContent = ahead.name;
        distEl.textContent = Math.round((ahead.y - doc) / 10) + ' m';
        jump.disabled = false;
      } else {
        nameEl.textContent = 'End of route';
        distEl.textContent = '';
        jump.disabled = true;
      }

      if (Math.abs(speed) > 0.4) request();
    }

    function request() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(draw);
    }

    jump.addEventListener('click', function () {
      if (ahead) document.getElementById(ahead.id).scrollIntoView({ behavior: 'smooth' });
    });

    /* Dragging the car scrubs the page. Panel px convert back through the
       same projection the map is drawn with, so the car tracks the pointer
       exactly rather than at some invented sensitivity. */
    var dragging = false, grabY = 0, grabScroll = 0, travelled = 0;

    map.addEventListener('pointerdown', function (e) {
      dragging = true;
      travelled = 0;
      grabY = e.clientY;
      grabScroll = window.scrollY;
      panel.classList.add('dragging');
      if (map.setPointerCapture) map.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    map.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dy = e.clientY - grabY;
      travelled = Math.max(travelled, Math.abs(dy));
      window.scrollTo(0, Math.max(0, grabScroll + (dy / SCALE) / PARALLAX));
    });

    function release(e) {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove('dragging');
      if (map.releasePointerCapture && e && e.pointerId !== undefined) {
        try { map.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
      }
    }
    map.addEventListener('pointerup', release);
    map.addEventListener('pointercancel', release);

    // A tap, rather than a drag, jumps to the nearest landmark.
    map.addEventListener('click', function (e) {
      if (travelled > 4) return;
      var rect = map.getBoundingClientRect();
      var wanted = window.scrollY + (((e.clientY - rect.top) - H * EGO_Y) / SCALE) / PARALLAX;
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
    window.addEventListener('resmap:theme', function () { readAccent(); draw(); });
  }
})();
