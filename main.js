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
   * 5. Water---------------------------------------------------
   * Long strokes held close to the horizontal, so the page carries the
   * surface of moving water: one slow swell crossing it, short chop
   * riding on top, the pointer dragging the surface with it, and a ring
   * that spreads from a click the way a dropped thing would. * ------------------------------------------------------------------ */

  var canvas = document.querySelector('canvas.deco');

  if (canvas && canvas.getContext) {
    var Wt = fitCanvas(canvas), wp = pointer(), wt = 0, ripples = [];
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ink = function () {
      return root.dataset.theme === 'dark' ? '255, 255, 255' : '17, 17, 18';
    };

    window.addEventListener('pointerdown', function (e) {
      ripples.push({ x: e.clientX, y: e.clientY, t: 0 });
      if (ripples.length > 4) ripples.shift();
    });

    (function waterFrame() {
      var ctx = Wt.ctx, W = Wt.s.w, H = Wt.s.h;
      if (!reduce) wt += 0.012;
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';

      var c = ink();
      for (var y0 = -30; y0 < H + 30; y0 += 17) {
        var depth = y0 / H;                                  // nearer = stronger
        ctx.strokeStyle = 'rgba(' + c + ',' + (0.05 + depth * 0.09) + ')';
        ctx.beginPath();

        for (var x = -40; x <= W + 40; x += 9) {
          var swell = Math.sin(x / 330 + wt + y0 / 260) * (7 + depth * 16);
          var chop  = Math.sin(x / 74 - wt * 2.4 + y0 / 40) * (1.6 + depth * 3.4);
          var y = y0 + swell + chop;

          // the pointer drags the surface with it
          if (wp.x > -9000) {
            var dx = x - wp.x, dy = y0 - wp.y, d = Math.hypot(dx, dy);
            if (d < 260) y -= Math.cos(d / 40 - wt * 3) * (1 - d / 260) * 13;
          }
          // and anything dropped on it spreads
          for (var r = 0; r < ripples.length; r++) {
            var rp2 = ripples[r];
            var rd = Math.hypot(x - rp2.x, y0 - rp2.y);
            var front = rp2.t * 5.2;
            var band = Math.abs(rd - front);
            if (band < 70) {
              y += Math.cos(band / 22) * (1 - band / 70) * Math.max(0, 1 - rp2.t / 110) * 16;
            }
          }

          if (x === -40) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      for (var r2 = ripples.length - 1; r2 >= 0; r2--) {
        ripples[r2].t += 1;
        if (ripples[r2].t > 120) ripples.splice(r2, 1);
      }
      requestAnimationFrame(waterFrame);
    })();
  }
})();
