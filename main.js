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

    var transition = document.startViewTransition(function () { paint(next); });

    transition.ready.then(function () {
      root.animate({ clipPath: frames }, {
        duration: 760,
        easing: 'cubic-bezier(.3, .7, .2, 1)',
        pseudoElement: '::view-transition-new(root)'
      });
    }).catch(function () { /* transition skipped; the theme still applied */ });
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
})();
