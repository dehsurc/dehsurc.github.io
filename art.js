// Art-direction candidates. Each is opt-in through ?art= and paints nothing
// otherwise; whichever survives gets folded into main.js and this file goes.

(function () {
  'use strict';

  var root = document.documentElement;
  var art = root.dataset.art;
  if (!art) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = document.querySelector('canvas.deco');

  function ink() {
    return root.dataset.theme === 'dark' ? '255, 255, 255' : '17, 17, 18';
  }

  /* ------------------------------------------------------------------ *
   * bev — the page sits on the kind of map the research outputs: lane
   * boundaries solid, dividers dashed, the whole field drifting forward
   * the way it would under a moving car, and leaning toward the pointer.
   * ------------------------------------------------------------------ */

  if (art === 'bev' && canvas && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var t = 0, lean = 0, leanTarget = 0;

    // Lanes are described in a space that scrolls; each is a column of
    // control points that bend independently, so the road is never straight.
    var LANES = 6, PITCH = 240, WAVE = 78;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // x of lane i at depth y, given the scroll offset
    function lx(i, y, off) {
      var mid = (LANES - 1) / 2;
      var base = W / 2 + (i - mid) * PITCH;
      var d = (y + off) / 520;
      return base
           + Math.sin(d + i * 0.55) * WAVE
           + Math.sin(d * 0.41 + i * 1.3) * WAVE * 0.62
           + lean * (i - mid) * 0.22;
    }

    function lane(i, off, dashed) {
      ctx.beginPath();
      for (var y = -80; y <= H + 80; y += 14) {
        var x = lx(i, y, off);
        if (y === -80) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.setLineDash(dashed ? [16, 22] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    function frame() {
      if (!reduce) t += 0.55;
      ctx.clearRect(0, 0, W, H);

      var c = ink();
      ctx.lineWidth = 1.2;
      lean += (leanTarget - lean) * 0.05;

      for (var i = 0; i < LANES; i++) {
        var edge = i === 0 || i === LANES - 1;
        ctx.strokeStyle = 'rgba(' + c + ',' + (edge ? 0.26 : 0.15) + ')';
        lane(i, t, !edge);
      }

      // Instance nodes: where a decoder would have placed a query.
      ctx.fillStyle = 'rgba(' + c + ',0.3)';
      for (var k = 0; k < 9; k++) {
        var i2 = (k * 3) % LANES;
        var y2 = ((k * 137 + t * 0.6) % (H + 160)) - 80;
        var x2 = lx(i2, y2, t);
        ctx.beginPath(); ctx.arc(x2, y2, 2.1, 0, 6.2832); ctx.fill();
      }

      requestAnimationFrame(frame);
    }

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', function (e) {
      leanTarget = (e.clientX / window.innerWidth - 0.5) * 240;
    }, { passive: true });

    resize();
    frame();
  }

  /* ------------------------------------------------------------------ *
   * halftone — the portrait stops being a photo and becomes a printed
   * object: one dot per cell, sized by how dark that cell is.
   * ------------------------------------------------------------------ */

  if (art === 'halftone') {
    var img = document.querySelector('.portrait img');
    if (img) {
      var out = document.createElement('canvas');
      out.className = 'halftone';
      img.parentNode.insertBefore(out, img);
      img.style.display = 'none';

      var draw = function () {
        var CELL = 5, w = img.naturalWidth, h = img.naturalHeight;
        var cols = Math.floor(w / CELL), rows = Math.floor(h / CELL);

        var src = document.createElement('canvas');
        src.width = cols; src.height = rows;
        var sctx = src.getContext('2d', { willReadFrequently: true });
        sctx.drawImage(img, 0, 0, cols, rows);
        var data = sctx.getImageData(0, 0, cols, rows).data;

        var S = 2;
        out.width = cols * CELL * S; out.height = rows * CELL * S;
        out.style.width = '100%'; out.style.height = 'auto';
        var o = out.getContext('2d');
        o.scale(S, S);
        o.fillStyle = root.dataset.theme === 'dark' ? '#ededee' : '#111112';

        for (var y = 0; y < rows; y++) {
          for (var x = 0; x < cols; x++) {
            var p = (y * cols + x) * 4;
            var lum = (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114) / 255;
            var r = (1 - lum) * CELL * 0.78;
            if (r < 0.25) continue;
            o.beginPath();
            o.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, r, 0, 6.2832);
            o.fill();
          }
        }
      };

      if (img.complete) draw(); else img.addEventListener('load', draw);
      document.getElementById('theme-toggle').addEventListener('click', function () {
        setTimeout(draw, 50);
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * kinetic — the name is the artwork. Each letter carries its own weight
   * on the variable axis, and the pointer pushes a wave of weight through
   * the word as it passes.
   * ------------------------------------------------------------------ */

  if (art === 'kinetic') {
    var h1 = document.querySelector('.hero h1');
    if (h1) {
      var name = h1.firstChild.textContent;
      var hangul = h1.querySelector('.hangul');
      var letters = [];

      h1.textContent = '';
      name.split('').forEach(function (ch) {
        var el = document.createElement('span');
        el.className = 'kin';
        el.textContent = ch === ' ' ? ' ' : ch;
        h1.appendChild(el);
        letters.push(el);
      });
      if (hangul) h1.appendChild(hangul);

      var mx = -9999, queued = false;

      function weigh() {
        queued = false;
        for (var i = 0; i < letters.length; i++) {
          var b = letters[i].getBoundingClientRect();
          var d = Math.abs((b.left + b.width / 2) - mx);
          var f = Math.max(0, 1 - d / 210);          // 1 at the pointer, 0 far off
          var w = 700 - Math.pow(f, 1.4) * 400;      // the word opens where it passes
          letters[i].style.fontVariationSettings = "'wght' " + Math.round(w);
        }
      }

      window.addEventListener('pointermove', function (e) {
        mx = e.clientX;
        if (queued) return;
        queued = true;
        requestAnimationFrame(weigh);
      }, { passive: true });

      window.addEventListener('pointerleave', function () {
        mx = -9999; weigh();
      });

      weigh();
    }
  }
  /* ================================================================== *
   * Patterns. Each is built from one rule and stays under 15% ink, so it
   * reads as a surface rather than an image, and every one of them has
   * somewhere for the pointer to go.
   * ================================================================== */

  function fitCanvas(cv) {
    var ctx = cv.getContext('2d');
    var state = { w: 0, h: 0 };
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      state.w = window.innerWidth; state.h = window.innerHeight;
      cv.width = state.w * dpr; cv.height = state.h * dpr;
      cv.style.width = state.w + 'px'; cv.style.height = state.h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resize, { passive: true });
    resize();
    return { ctx: ctx, s: state };
  }

  function pointer(onMove) {
    var p = { x: -9999, y: -9999, qx: 0, qy: 0 };
    window.addEventListener('pointermove', function (e) {
      p.x = e.clientX; p.y = e.clientY;
      if (onMove) onMove(p);
    }, { passive: true });
    return p;
  }

  /* ---- waves -------------------------------------------------------
   * Vertical lines carrying a sine displacement that grows down the page,
   * so the surface is still at the top and moving at the foot. The
   * pointer puts a dent in the field. */

  if (art === 'waves' && canvas && canvas.getContext) {
    var R = fitCanvas(canvas), rp = pointer(), rt = 0;

    (function wavesFrame() {
      var ctx = R.ctx, W = R.s.w, H = R.s.h;
      if (!reduce) rt += 0.006;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(' + ink() + ',0.13)';
      ctx.lineWidth = 1.1;

      for (var x = -20; x < W + 20; x += 15) {
        ctx.beginPath();
        for (var y = 0; y <= H; y += 6) {
          var grow = Math.pow(y / H, 1.8);                 // quiet at the top
          var d = Math.hypot(x - rp.x, y - rp.y);
          var pull = Math.max(0, 1 - d / 320);             // the pointer's dent
          var amp = 7 + grow * 26 + pull * 22;
          var k = 0.016 + grow * 0.012;
          var off = Math.sin(y * k + rt + x * 0.004) * amp;
          if (y === 0) ctx.moveTo(x + off, y); else ctx.lineTo(x + off, y);
        }
        ctx.stroke();
      }
      requestAnimationFrame(wavesFrame);
    })();
  }

  /* ---- bands -------------------------------------------------------
   * Vertical bands of unequal width, a few flipping on and off at a time.
   * A scan column follows the pointer and lifts whatever it crosses. */

  if (art === 'bands' && canvas && canvas.getContext) {
    var K = fitCanvas(canvas), kp = pointer(), kt = 0;
    var bands = [];
    for (var bi = 0; bi < 260; bi++) {
      bands.push({ w: 1 + Math.random() * Math.random() * 26, on: Math.random() > 0.42 });
    }

    (function bandsFrame() {
      var ctx = K.ctx, W = K.s.w, H = K.s.h;
      kt += 1;
      if (!reduce && kt % 26 === 0) {                      // a few bands flip
        for (var f = 0; f < 6; f++) {
          bands[(Math.random() * bands.length) | 0].on = Math.random() > 0.42;
        }
      }
      ctx.clearRect(0, 0, W, H);

      var x = 0, i = 0;
      while (x < W && i < bands.length) {
        var b = bands[i];
        if (b.on) {
          var d = Math.abs(x - kp.x);
          var lit = Math.max(0, 1 - d / 260);              // brighter at the pointer
          ctx.fillStyle = 'rgba(' + ink() + ',' + (0.05 + lit * 0.13) + ')';
          ctx.fillRect(x, 0, b.w, H);
        }
        x += b.w + 3; i++;
      }

      // the scan column
      if (kp.x > -9000) {
        ctx.fillStyle = 'rgba(' + ink() + ',0.22)';
        ctx.fillRect(kp.x, 0, 1, H);
      }
      requestAnimationFrame(bandsFrame);
    })();
  }

  /* ---- forms -------------------------------------------------------
   * Bars and a disc, tilted off every axis, on no ground at all. Each
   * sits at its own depth and parallaxes against the pointer. */

  if (art === 'forms' && canvas && canvas.getContext) {
    var M = fitCanvas(canvas), mp = pointer();
    var FORMS = [
      { x: .17, y: .22, w: .30, h: .045, a: -0.42, d: 1.0 },
      { x: .55, y: .12, w: .12, h: .012, a: -0.42, d: 1.6 },
      { x: .70, y: .34, w: .21, h: .26,  a:  0.18, d: 0.6 },
      { x: .30, y: .58, w: .38, h: .028, a:  0.32, d: 1.3 },
      { x: .12, y: .74, w: .14, h: .14,  a: -0.10, d: 0.9, disc: true },
      { x: .62, y: .70, w: .26, h: .018, a: -0.55, d: 1.8 },
      { x: .44, y: .40, w: .05, h: .34,  a:  0.18, d: 0.4 }
    ];

    (function formsFrame() {
      var ctx = M.ctx, W = M.s.w, H = M.s.h;
      ctx.clearRect(0, 0, W, H);
      var cx = mp.x > -9000 ? (mp.x / W - 0.5) : 0;
      var cy = mp.y > -9000 ? (mp.y / H - 0.5) : 0;

      FORMS.forEach(function (f) {
        var w = f.w * W, h = f.h * W;
        var x = f.x * W - cx * 26 * f.d;
        var y = f.y * H - cy * 26 * f.d;
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate(f.a);
        ctx.fillStyle = 'rgba(' + ink() + ',' + (0.05 + f.d * 0.022) + ')';
        if (f.disc) {
          ctx.beginPath(); ctx.arc(0, 0, w / 2, 0, 6.2832); ctx.fill();
        } else {
          ctx.fillRect(-w / 2, -h / 2, w, h);
        }
        ctx.restore();
      });
      requestAnimationFrame(formsFrame);
    })();
  }

  /* ---- hatch -------------------------------------------------------
   * The page divides into panels, each filled with straight lines at one
   * of four angles. The panel under the pointer rotates to the next. */

  if (art === 'hatch' && canvas && canvas.getContext) {
    var L = fitCanvas(canvas), lp = pointer();
    var DIRS = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4];
    var cells = [];

    function build() {
      cells = [];
      var cols = Math.max(3, Math.round(L.s.w / 340));
      var rows = Math.max(3, Math.round(L.s.h / 300));
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          cells.push({ c: c, r: r, cols: cols, rows: rows,
                       d: (r * cols + c * 3) % 4, want: (r * cols + c * 3) % 4, t: 0 });
        }
      }
    }
    build();
    window.addEventListener('resize', build, { passive: true });

    (function hatchFrame() {
      var ctx = L.ctx, W = L.s.w, H = L.s.h;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(' + ink() + ',0.1)';
      ctx.lineWidth = 1;

      cells.forEach(function (cell) {
        var cw = W / cell.cols, ch = H / cell.rows;
        var x0 = cell.c * cw, y0 = cell.r * ch;
        var hot = lp.x >= x0 && lp.x < x0 + cw && lp.y >= y0 && lp.y < y0 + ch;
        if (hot && cell.want === cell.d) cell.want = (cell.d + 1) % 4;
        if (!hot && cell.want !== cell.d) cell.t = Math.min(1, cell.t + 0.045);
        if (cell.t >= 1) { cell.d = cell.want; cell.t = 0; }
        if (hot) cell.t = Math.min(1, cell.t + 0.045);

        var a = DIRS[cell.d] + (DIRS[cell.want] - DIRS[cell.d]) * cell.t;
        ctx.save();
        ctx.beginPath(); ctx.rect(x0, y0, cw, ch); ctx.clip();
        ctx.translate(x0 + cw / 2, y0 + ch / 2);
        ctx.rotate(a);
        var reach = Math.hypot(cw, ch) / 2;
        for (var o = -reach; o <= reach; o += 11) {
          ctx.beginPath();
          ctx.moveTo(-reach, o); ctx.lineTo(reach, o);
          ctx.stroke();
        }
        ctx.restore();
      });
      requestAnimationFrame(hatchFrame);
    })();
  }

  /* ---- flow --------------------------------------------------------
   * Long thin strokes released into a slowly turning field, so the page
   * carries a drawn line rather than a constructed one. The pointer
   * swirls the field where it passes. */

  if (art === 'flow' && canvas && canvas.getContext) {
    var F = fitCanvas(canvas), fp = pointer(), ft = 0;

    function field(x, y, w, h) {
      var a = Math.sin(x / 260 + ft) * 1.1
            + Math.cos(y / 210 - ft * 0.7) * 1.1
            + Math.sin((x + y) / 430) * 0.8;
      if (fp.x > -9000) {
        var dx = x - fp.x, dy = y - fp.y, d = Math.hypot(dx, dy);
        if (d < 300) a += Math.atan2(dy, dx) * (1 - d / 300) * 1.6;   // a swirl
      }
      return a;
    }

    (function flowFrame() {
      var ctx = F.ctx, W = F.s.w, H = F.s.h;
      if (!reduce) ft += 0.0022;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(' + ink() + ',0.11)';
      ctx.lineWidth = 1;

      var STEP = 46;
      for (var sy = -STEP; sy < H + STEP; sy += STEP) {
        for (var sx = -STEP; sx < W + STEP; sx += STEP) {
          var x = sx, y = sy;
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (var k = 0; k < 26; k++) {                  // walk the field
            var a = field(x, y, W, H);
            x += Math.cos(a) * 9;
            y += Math.sin(a) * 9;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      requestAnimationFrame(flowFrame);
    })();
  }
})();
