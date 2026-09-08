// ReSMap project page — theme, ambient grid, and a few small behaviours.

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------------------ *
   * 1. Theme
   *
   * The palette is a set of custom properties, so applying a theme is one
   * attribute write. The wipe is a clip-path animation on the incoming
   * View Transition snapshot; the shape is picked at random each time and
   * is always oversized past the furthest corner, so the motion finishes
   * out of frame rather than crawling through the corners at the tail of
   * the easing curve.
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
    try { localStorage.setItem('resmap-theme', theme); } catch (e) { /* private mode */ }
    window.dispatchEvent(new CustomEvent('resmap:theme', { detail: theme }));
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

    // The two directions are time-reverses of each other. Going dark the new
    // theme opens out of the button; coming back to light the dark snapshot
    // closes into it instead, so the shape gathers rather than spreads. That
    // means clipping the outgoing snapshot, which has to sit on top for the
    // duration — see the [data-wipe] rules in style.css.
    var closing = next === 'light';
    if (closing) {
      root.dataset.wipe = 'out';
      frames = frames.slice().reverse();
    }

    var transition = document.startViewTransition(function () { paint(next); });

    function done() { delete root.dataset.wipe; }
    transition.finished.then(done, done);

    transition.ready.then(function () {
      root.animate({ clipPath: frames }, {
        duration: closing ? 680 : 760,
        // Opening leads with speed and settles. The literal mirror of that
        // curve holds the shape at full size and then collapses it in the
        // last few frames, which reads as a blink rather than a wipe, so
        // closing gets a symmetric curve instead.
        easing: closing ? 'cubic-bezier(.55, 0, .35, 1)'
                        : 'cubic-bezier(.3, .7, .2, 1)',
        // Without this the clip reverts to its base value on the last frame
        // and the closing wipe flashes the whole outgoing theme back in.
        fill: 'forwards',
        pseudoElement: closing ? '::view-transition-old(root)'
                               : '::view-transition-new(root)'
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
   * 2. Sections rise in as they are reached
   * ------------------------------------------------------------------ */

  var sections = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  if ('IntersectionObserver' in window) {
    var reveal = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        reveal.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });

    sections.forEach(function (s) { reveal.observe(s); });
  } else {
    sections.forEach(function (s) { s.classList.add('in'); });
  }

  /* ------------------------------------------------------------------ *
   * 3. Nav highlighting
   * ------------------------------------------------------------------ */

  var links = Array.prototype.slice.call(document.querySelectorAll('.topbar ul a'));
  var targets = links
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && targets.length) {
    var seen = new Map();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { seen.set(e.target.id, e.intersectionRatio); });

      var best = null, bestRatio = 0;
      seen.forEach(function (ratio, id) {
        if (ratio > bestRatio) { bestRatio = ratio; best = id; }
      });

      links.forEach(function (a) {
        a.classList.toggle('current', best !== null && a.getAttribute('href') === '#' + best);
      });
    }, { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 1] });

    targets.forEach(function (t) { observer.observe(t); });
  }

  /* ------------------------------------------------------------------ *
   * 4. Qualitative scene switcher
   * ------------------------------------------------------------------ */

  var picker = document.querySelector('.scene-picker');
  var video = document.getElementById('scene-video');

  if (picker && video) {
    picker.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-scene]');
      if (!button) return;

      var scene = button.dataset.scene;
      picker.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-selected', String(b === button));
      });

      video.pause();
      video.poster = 'assets/video/' + scene + '.jpg';
      video.querySelector('source').src = 'assets/video/' + scene + '.mp4';
      video.load();
    });
  }

  /* ------------------------------------------------------------------ *
   * 5. BibTeX copy
   * ------------------------------------------------------------------ */

  var copy = document.getElementById('copy-bib');
  var bib = document.getElementById('bib');

  if (copy && bib && navigator.clipboard) {
    copy.addEventListener('click', function () {
      navigator.clipboard.writeText(bib.textContent).then(function () {
        var text = copy.textContent;
        copy.textContent = 'Copied';
        setTimeout(function () { copy.textContent = text; }, 1600);
      });
    });
  } else if (copy) {
    copy.hidden = true;
  }

  /* ------------------------------------------------------------------ *
   * 6. Placeholders for figures that have not been added yet
   * ------------------------------------------------------------------ */

  document.querySelectorAll('.figure img').forEach(function (img) {
    img.addEventListener('error', function () {
      var note = document.createElement('div');
      note.className = 'placeholder';
      note.textContent = 'missing figure — add ' + img.getAttribute('src');
      img.replaceWith(note);
    });
  });
})();
