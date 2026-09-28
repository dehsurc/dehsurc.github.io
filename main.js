// dehsurc.github.io — theme switch and the section nav. No framework.

(function () {
  'use strict';

  var root = document.documentElement;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------------------ *
   * 1. Theme
   *
   * Same switch as the ReSMap project page: the palette is a set of custom
   * properties, so applying a theme is one attribute write, and the wipe is
   * a clip-path animation on the incoming View Transition snapshot. The
   * shape is picked at random each time and always overshoots the furthest
   * corner, so the motion leaves the frame instead of crawling through the
   * corners at the tail of the easing curve.
   * ------------------------------------------------------------------ */

  var toggle = document.getElementById('theme-toggle');
  var lastShape = -1;

  function paint(theme) {
    root.dataset.theme = theme;
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(theme === 'dark'));
      toggle.setAttribute('aria-label',
        'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' theme');
    }
    try { localStorage.setItem('kk-theme', theme); } catch (e) { /* private mode */ }
  }

  function round(v) { return Math.round(v * 10) / 10; }

  // A polygon of n vertices, each at its own radius from (x, y).
  function polygon(x, y, radii, phase) {
    var n = radii.length, points = [];
    for (var i = 0; i < n; i++) {
      var a = phase + (i / n) * Math.PI * 2;
      points.push(round(x + Math.cos(a) * radii[i]) + 'px ' +
                  round(y + Math.sin(a) * radii[i]) + 'px');
    }
    return 'polygon(' + points.join(', ') + ')';
  }

  function flat(n, value) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(value);
    return out;
  }

  // Circumradius that guarantees an n-gon still covers a circle of `reach`.
  function cover(reach, n) { return reach / Math.cos(Math.PI / n); }

  var SHAPES = [
    function circleWipe(x, y, reach) {
      return ['circle(0px at ' + x + 'px ' + y + 'px)',
              'circle(' + round(reach) + 'px at ' + x + 'px ' + y + 'px)'];
    },
    function ellipseWipe(x, y, reach) {
      return ['ellipse(0px 0px at ' + x + 'px ' + y + 'px)',
              'ellipse(' + round(reach * 1.35) + 'px ' + round(reach) + 'px at ' +
                x + 'px ' + y + 'px)'];
    },
    function diamondWipe(x, y, reach) {
      var phase = Math.random() * Math.PI / 2;
      return [polygon(x, y, flat(4, 0), phase),
              polygon(x, y, flat(4, cover(reach, 4)), phase)];
    },
    function hexWipe(x, y, reach) {
      var phase = Math.random() * Math.PI / 3;
      return [polygon(x, y, flat(6, 0), phase),
              polygon(x, y, flat(6, cover(reach, 6)), phase)];
    },
    function burstWipe(x, y, reach) {
      var n = 16, phase = Math.random() * Math.PI * 2;
      var outer = cover(reach, n) / 0.62, radii = [];
      for (var i = 0; i < n; i++) radii.push(i % 2 ? outer * 0.62 : outer);
      return [polygon(x, y, flat(n, 0), phase), polygon(x, y, radii, phase)];
    },
    function blobWipe(x, y, reach) {
      var n = 9, phase = Math.random() * Math.PI * 2, radii = [];
      for (var i = 0; i < n; i++) {
        radii.push(cover(reach, n) * (1 + Math.random() * 0.45));
      }
      return [polygon(x, y, flat(n, 0), phase), polygon(x, y, radii, phase)];
    },
    function boxWipe(x, y, reach, w, h) {
      return ['inset(' + round(y) + 'px ' + round(w - x) + 'px ' +
                round(h - y) + 'px ' + round(x) + 'px round 999px)',
              'inset(0px 0px 0px 0px round 0px)'];
    }
  ];

  function pickShape() {
    var i = Math.floor(Math.random() * SHAPES.length);
    if (i === lastShape) i = (i + 1) % SHAPES.length;
    lastShape = i;
    return SHAPES[i];
  }

  function switchTheme() {
    var next = root.dataset.theme === 'dark' ? 'light' : 'dark';

    if (!document.startViewTransition || reduceMotion.matches) {
      paint(next);
      return;
    }

    var box = toggle.getBoundingClientRect();
    var x = box.left + box.width / 2;
    var y = box.top + box.height / 2;
    var w = window.innerWidth, h = window.innerHeight;

    // Distance to the furthest corner, plus headroom so the shape leaves the
    // viewport before the easing curve flattens out.
    var reach = Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) * 1.18;
    var frames = pickShape()(x, y, reach, w, h);

    // The two directions are time-reverses of each other. Going dark, the new
    // theme opens out of the button; coming back to light, the dark snapshot
    // closes into it instead, so the shape gathers rather than spreads. That
    // means clipping the outgoing snapshot, which has to sit on top for the
    // duration — see the [data-wipe] rules in style.css.
    var closing = next === 'light';
    if (closing) {
      root.dataset.wipe = 'in';
      frames = frames.slice().reverse();
    }

    function done() { delete root.dataset.wipe; }

    var transition = document.startViewTransition(function () { paint(next); });

    transition.ready.then(function () {
      root.animate({ clipPath: frames }, {
        duration: closing ? 680 : 760,
        // Opening leads with speed and settles; closing has to move off the
        // mark just as promptly or it reads as lag, so it gets a symmetric
        // curve rather than the literal mirror of the opening one.
        easing: closing ? 'cubic-bezier(.55, 0, .35, 1)'
                        : 'cubic-bezier(.3, .7, .2, 1)',
        // Without this the clip reverts to its base value on the last frame,
        // and the closing wipe flashes the whole outgoing theme back in.
        fill: 'forwards',
        pseudoElement: closing ? '::view-transition-old(root)'
                               : '::view-transition-new(root)'
      });
    }).catch(function () { /* transition skipped; the theme still applied */ });

    transition.finished.then(done, done);
  }

  if (toggle) {
    paint(root.dataset.theme === 'dark' ? 'dark' : 'light');
    toggle.addEventListener('click', switchTheme);

    document.addEventListener('keydown', function (e) {
      if (e.key !== 't' && e.key !== 'T') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      switchTheme();
    });
  }

  /* ------------------------------------------------------------------ *
   * 2. Section nav
   *
   * Marks whichever section is sitting under the top bar.
   * ------------------------------------------------------------------ */

  var links = Array.prototype.slice.call(document.querySelectorAll('.topbar a[href^="#"]'));
  var map = {};
  links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
  var targets = Object.keys(map)
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && targets.length) {
    var seen = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { seen[e.target.id] = e.isIntersecting; });
      var current = targets.filter(function (t) { return seen[t.id]; })[0];
      links.forEach(function (a) { a.classList.remove('here'); });
      if (current) map[current.id].classList.add('here');
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach(function (t) { io.observe(t); });
  }
  /* ------------------------------------------------------------------ *
   * 3. Seoul clock
   *
   * Where the author is, in the reader's own second hand.
   * ------------------------------------------------------------------ */

  var clock = document.getElementById('clock');

  if (clock && window.Intl && Intl.DateTimeFormat) {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Seoul', hour12: false,
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    var tick = function () { clock.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 1000);
  }
  /* ------------------------------------------------------------------ *
   * 4. Pointer light
   *
   * Writes the pointer position into two custom properties; the gradient
   * that reads them lives in style.css and only exists for fine pointers.
   * Coalesced into one write per frame.
   * ------------------------------------------------------------------ */

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var px = 0, py = 0, queued = false;

    function place() {
      queued = false;
      root.style.setProperty('--mx', px + 'px');
      root.style.setProperty('--my', py + 'px');
    }

    window.addEventListener('pointermove', function (e) {
      px = e.clientX;
      py = e.clientY;
      if (!document.body.classList.contains('lit')) document.body.classList.add('lit');
      if (queued) return;
      queued = true;
      requestAnimationFrame(place);
    }, { passive: true });

    window.addEventListener('pointerleave', function () {
      document.body.classList.remove('lit');
    });
  }
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

  function pointer() {
    var p = { x: -9999, y: -9999 };
    window.addEventListener('pointermove', function (e) {
      p.x = e.clientX; p.y = e.clientY;
    }, { passive: true });
    return p;
  }

  /* ------------------------------------------------------------------ *
   * 5. Water
   *
   * Long strokes held close to the horizontal, so the page carries the
   * surface of moving water: one slow swell crossing it, short chop
   * riding on top, the pointer dragging the surface with it, and a ring
   * that spreads from a click the way a dropped thing would.
   *
   * ?w= picks a spacing/swell preset while we settle on one.
   * ------------------------------------------------------------------ */

  /* Sea seen from above.
   *
   * The surface is a height field: a few wave trains running at different
   * angles, which is what makes real swell interlock instead of lining up.
   * What gets drawn is its contours — marching squares over a coarse grid,
   * so the crests come out as closed, organic lines the way they read from
   * a plane. The pointer lifts the water under it and a click sends a ring
   * out through the field.
   *
   * ?w= picks a preset while we settle on one. */

  var SEA = {
    '0': { cell: 16, levels: 5, span: 1.15, scale: 1.00, a: 0.115, lw: 1.0 },
    'a': { cell: 16, levels: 5, span: 1.15, scale: 1.00, a: 0.115, lw: 1.0 },
    'b': { cell: 15, levels: 8, span: 1.30, scale: 1.00, a: 0.095, lw: 1.0 },
    'c': { cell: 20, levels: 3, span: 0.85, scale: 1.55, a: 0.150, lw: 1.2 },
    'd': { cell: 13, levels: 11, span: 1.45, scale: 0.80, a: 0.080, lw: 1.0 },
    'e': { cell: 18, levels: 5, span: 1.15, scale: 2.10, a: 0.135, lw: 1.1 }
  };

  var canvas = document.querySelector('canvas.deco');

  if (canvas && canvas.getContext) {
    var cfg = SEA[new URLSearchParams(location.search).get('w')] || SEA['0'];
    var S = fitCanvas(canvas), sp = pointer(), st = 0, rings = [];
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function ink() {
      return root.dataset.theme === 'dark' ? '255, 255, 255' : '17, 17, 18';
    }

    window.addEventListener('pointerdown', function (e) {
      rings.push({ x: e.clientX, y: e.clientY, t: 0 });
      if (rings.length > 4) rings.shift();
    });

    // Five trains at unrelated angles and speeds, plus whatever is
    // disturbing the surface right now.
    function height(x, y) {
      var k = 1 / cfg.scale;
      // Signs on st set which way each train travels; all but one run with
      // the reading direction, so the sea drifts left to right.
      var h = Math.sin((x * 0.0062 + y * 0.0018) * k - st)
            + Math.sin((x * 0.0029 - y * 0.0051) * k - st * 0.78) * 0.80
            + Math.sin((x * 0.0115 + y * 0.0088) * k - st * 1.70) * 0.34
            + Math.sin((x * 0.0024 + y * 0.0196) * k + st * 1.15) * 0.30
            + Math.sin((x * 0.0380 - y * 0.0245) * k - st * 2.40) * 0.09;

      if (sp.x > -9000) {
        var d = Math.hypot(x - sp.x, y - sp.y);
        if (d < 300) {
          var f = 1 - d / 300;
          h += f * f * 1.25;                       // the water stands up under it
        }
      }
      for (var i = 0; i < rings.length; i++) {
        var r = rings[i];
        var rd = Math.hypot(x - r.x, y - r.y);
        var band = Math.abs(rd - r.t * 5.4);
        if (band < 86) {
          h += Math.cos(band / 27) * (1 - band / 86) *
               Math.max(0, 1 - r.t / 115) * 1.5;
        }
      }
      return h;
    }

    var grid = null, gw = 0, gh = 0;

    function marching(ctx, level) {
      var C = cfg.cell;
      for (var j = 0; j < gh - 1; j++) {
        for (var i = 0; i < gw - 1; i++) {
          var a = grid[j * gw + i],       b = grid[j * gw + i + 1];
          var c = grid[(j + 1) * gw + i + 1], d = grid[(j + 1) * gw + i];
          var code = (a > level ? 1 : 0) | (b > level ? 2 : 0) |
                     (c > level ? 4 : 0) | (d > level ? 8 : 0);
          if (code === 0 || code === 15) continue;

          var x0 = (i - 1) * C, y0 = (j - 1) * C;
          var T = { x: x0 + (level - a) / (b - a) * C, y: y0 };
          var R = { x: x0 + C, y: y0 + (level - b) / (c - b) * C };
          var B = { x: x0 + (level - d) / (c - d) * C, y: y0 + C };
          var Lf = { x: x0, y: y0 + (level - a) / (d - a) * C };

          function seg(p, q) { ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); }

          switch (code) {
            case 1: case 14: seg(Lf, T); break;
            case 2: case 13: seg(T, R); break;
            case 3: case 12: seg(Lf, R); break;
            case 4: case 11: seg(R, B); break;
            case 6: case 9:  seg(T, B); break;
            case 7: case 8:  seg(Lf, B); break;
            case 5:          seg(Lf, T); seg(R, B); break;
            case 10:         seg(T, R); seg(Lf, B); break;
          }
        }
      }
    }

    (function seaFrame() {
      var ctx = S.ctx, W = S.s.w, H = S.s.h, C = cfg.cell;
      if (!reduce) st += 0.0075;

      gw = Math.ceil(W / C) + 3;
      gh = Math.ceil(H / C) + 3;
      if (!grid || grid.length !== gw * gh) grid = new Float32Array(gw * gh);

      for (var j = 0; j < gh; j++) {
        for (var i = 0; i < gw; i++) {
          grid[j * gw + i] = height((i - 1) * C, (j - 1) * C);
        }
      }

      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = cfg.lw;
      ctx.lineJoin = 'round';

      var c = ink(), n = cfg.levels;
      for (var l = 0; l < n; l++) {
        var level = cfg.span * (-1 + 2 * (l + 0.5) / n);
        var edge = Math.abs(level) / cfg.span;                  // troughs fade
        ctx.strokeStyle = 'rgba(' + c + ',' + (cfg.a * (1 - edge * 0.45)) + ')';
        ctx.beginPath();
        marching(ctx, level);
        ctx.stroke();
      }

      for (var r = rings.length - 1; r >= 0; r--) {
        rings[r].t += 1;
        if (rings[r].t > 125) rings.splice(r, 1);
      }
      requestAnimationFrame(seaFrame);
    })();
  }
})();
