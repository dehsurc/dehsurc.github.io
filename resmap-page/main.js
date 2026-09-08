// ReSMap project page — theme, ambient grid, and a few small behaviours.

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var themeListeners = [];

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
    themeListeners.forEach(function (fn) { fn(theme); });
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
   * 2. Ambient BEV grid
   *
   * The page sits on the same kind of grid the model reasons over: cells
   * light up around the pointer the way the PTF reliability map does. The
   * static lattice is rendered once to an offscreen canvas and blitted with
   * a scroll offset; only the ~100 cells near the pointer are redrawn per
   * frame.
   * ------------------------------------------------------------------ */

  var canvas = document.getElementById('bev-grid');

  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var base = document.createElement('canvas');
    var baseCtx = base.getContext('2d');

    var SPACING = 32;      // BEV cell pitch, px
    var DOT = 1;           // resting dot radius
    var GLOW = 165;        // pointer influence radius
    var PARALLAX = 0.05;

    var dpr = 1, vw = 0, vh = 0;
    var dot = '27, 27, 25';
    var baseAlpha = 0.11;

    var px = -1e5, py = -1e5;
    var glow = 0, glowTarget = 0;
    var queued = false;

    function readTheme() {
      var styles = getComputedStyle(root);
      dot = (styles.getPropertyValue('--grid-dot') || '27, 27, 25').trim();
      baseAlpha = root.dataset.theme === 'dark' ? 0.14 : 0.11;
    }

    function drawBase() {
      base.width = Math.ceil(vw * dpr);
      base.height = Math.ceil((vh + SPACING) * dpr);
      baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      baseCtx.clearRect(0, 0, vw, vh + SPACING);
      baseCtx.fillStyle = 'rgba(' + dot + ', ' + baseAlpha + ')';
      for (var y = 0; y <= vh + SPACING; y += SPACING) {
        for (var x = 0; x <= vw; x += SPACING) {
          baseCtx.beginPath();
          baseCtx.arc(x, y, DOT, 0, Math.PI * 2);
          baseCtx.fill();
        }
      }
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      vw = window.innerWidth;
      vh = window.innerHeight;
      canvas.width = Math.ceil(vw * dpr);
      canvas.height = Math.ceil(vh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      readTheme();
      drawBase();
      request();
    }

    function render() {
      queued = false;
      glow += (glowTarget - glow) * 0.18;
      if (Math.abs(glowTarget - glow) < 0.004) glow = glowTarget;

      var offset = (window.scrollY * PARALLAX) % SPACING;

      ctx.clearRect(0, 0, vw, vh);
      ctx.drawImage(base, 0, 0, base.width, base.height, 0, -offset, vw, vh + SPACING);

      if (glow > 0.01) {
        // Only the cells inside the influence radius need repainting.
        var x0 = Math.floor((px - GLOW) / SPACING) * SPACING;
        var x1 = px + GLOW;
        var y1 = py + GLOW;
        for (var gx = x0; gx <= x1; gx += SPACING) {
          var startY = Math.floor((py + offset - GLOW) / SPACING) * SPACING;
          for (var gy = startY; gy <= y1 + offset; gy += SPACING) {
            var sy = gy - offset;
            var d = Math.hypot(gx - px, sy - py);
            if (d > GLOW) continue;
            var t = (1 - d / GLOW);
            t = t * t * glow;
            ctx.fillStyle = 'rgba(' + dot + ', ' + (baseAlpha + t * 0.5) + ')';
            ctx.beginPath();
            ctx.arc(gx, sy, DOT + t * 1.7, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      if (glow !== glowTarget) request();
    }

    function request() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(render);
    }

    resize();
    window.addEventListener('resize', resize);
    themeListeners.push(function () { readTheme(); drawBase(); request(); });

    if (!reduceMotion.matches) {
      window.addEventListener('scroll', request, { passive: true });
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        px = e.clientX; py = e.clientY;
        glowTarget = 1;
        request();
      }, { passive: true });
      document.addEventListener('pointerleave', function () {
        glowTarget = 0;
        request();
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * 3. Scroll progress
   * ------------------------------------------------------------------ */

  var progress = document.querySelector('.progress i');

  if (progress) {
    progress.style.width = '100%';
    var ticking = false;

    var update = function () {
      ticking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      progress.style.transform = 'scaleX(' + ratio + ')';
    };

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ------------------------------------------------------------------ *
   * 4. Sections rise in as they are reached
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
   * 5. Nav highlighting
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
   * 6. Qualitative scene switcher
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
   * 7. BibTeX copy
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
   * 8. Placeholders for figures that have not been added yet
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
