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
})();
