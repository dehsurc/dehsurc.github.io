// ReSMap project page: theme and a few small behaviours.

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
    // Everything that has to be right in the snapshot happens here and only
    // here. Persisting the choice does not, and localStorage is a synchronous
    // write, so it waits until the animation is running.
    window.dispatchEvent(new CustomEvent('resmap:theme', { detail: theme }));
  }

  function remember(theme) {
    try { localStorage.setItem('resmap-theme', theme); } catch (e) { /* private mode */ }
  }

  function round(v) { return Math.round(v * 10) / 10; }

  /* A polygon of n vertices, each at its own radius from (x, y). Kept short:
     a circle or an ellipse animates on the compositor, a polygon has to be
     re-rasterised every frame, and the cost climbs with the vertex count. */
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
    function starWipe(x, y, reach) {
      var phase = -Math.PI / 2, out = cover(reach, 10) / .45, radii = [];
      for (var i = 0; i < 10; i++) radii.push(i % 2 ? out * .45 : out);
      return [polygon(x, y, flat(10, 0), phase), polygon(x, y, radii, phase)];
    },
    function triangleWipe(x, y, reach) {
      var phase = Math.random() * Math.PI * 2 / 3;
      return [polygon(x, y, flat(3, 0), phase), polygon(x, y, flat(3, cover(reach, 3)), phase)];
    },
    function boxWipe(x, y, reach, w, h) {
      return ['inset(' + round(y) + 'px ' + round(w - x) + 'px ' +
                round(h - y) + 'px ' + round(x) + 'px round 999px)',
              'inset(0px 0px 0px 0px round 0px)'];
    }
  ];

  /* The viewport with a hole in it, as one even-odd polygon: the four window
     corners, a zero-width slit in to the hole, the hole's own ring, and back
     out. Every size uses the same number of points, so it interpolates. */
  function holed(ring, w, h) {
    var pts = ['0px 0px', w + 'px 0px', w + 'px ' + h + 'px', '0px ' + h + 'px', '0px 0px'];
    ring.forEach(function (p) { pts.push(round(p[0]) + 'px ' + round(p[1]) + 'px'); });
    pts.push(round(ring[0][0]) + 'px ' + round(ring[0][1]) + 'px', '0px 0px');
    return 'polygon(evenodd, ' + pts.join(', ') + ')';
  }
  function ring(x, y, rx, ry, n, phase) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var a = phase + (i / n) * Math.PI * 2;
      out.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]);
    }
    return out;
  }
  var HOLES = [
    function circleHole(x, y, reach, w, h) {
      return [holed(ring(x, y, 0, 0, 48, 0), w, h), holed(ring(x, y, reach, reach, 48, 0), w, h)];
    },
    function ellipseHole(x, y, reach, w, h) {
      return [holed(ring(x, y, 0, 0, 48, 0), w, h), holed(ring(x, y, reach * 1.35, reach, 48, 0), w, h)];
    },
    function diamondHole(x, y, reach, w, h) {
      var ph = Math.random() * Math.PI / 2, r = cover(reach, 4);
      return [holed(ring(x, y, 0, 0, 4, ph), w, h), holed(ring(x, y, r, r, 4, ph), w, h)];
    },
    function hexHole(x, y, reach, w, h) {
      var ph = Math.random() * Math.PI / 3, r = cover(reach, 6);
      return [holed(ring(x, y, 0, 0, 6, ph), w, h), holed(ring(x, y, r, r, 6, ph), w, h)];
    },
    function starHole(x, y, reach, w, h) {
      var out = cover(reach, 10) / .45, pts0 = [], pts1 = [];
      for (var i = 0; i < 10; i++) {
        var a = -Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? out * .45 : out;
        pts0.push([x, y]); pts1.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
      }
      return [holed(pts0, w, h), holed(pts1, w, h)];
    },
    function triangleHole(x, y, reach, w, h) {
      var ph = Math.random() * Math.PI * 2 / 3, r = cover(reach, 3);
      return [holed(ring(x, y, 0, 0, 3, ph), w, h), holed(ring(x, y, r, r, 3, ph), w, h)];
    },
    function boxHole(x, y, reach, w, h) {
      var from = [[x, y], [x, y], [x, y], [x, y]];
      var to = [[-2, -2], [w + 2, -2], [w + 2, h + 2], [-2, h + 2]];
      return [holed(from, w, h), holed(to, w, h)];
    }
  ];
  function pickHole() {
    var i = Math.floor(Math.random() * HOLES.length);
    if (i === lastShape) i = (i + 1) % HOLES.length;
    lastShape = i;
    return HOLES[i];
  }

  /* Easter eggs: now and then, instead of a shape, something with a bit of
     character. Each one only transforms the outgoing snapshot (the still image
     on top), so like the shapes they work the same in both directions and
     never touch the incoming page's first frames. */
  var NOISE = 'url("data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">' +
    '<filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/>' +
    '<feColorMatrix type="saturate" values="0"/><feComponentTransfer>' +
    '<feFuncR type="discrete" tableValues="0 1"/><feFuncG type="discrete" tableValues="0 1"/>' +
    '<feFuncB type="discrete" tableValues="0 1"/></feComponentTransfer></filter>' +
    '<rect width="100%" height="100%" filter="url(#n)"/></svg>') + '")';

  function blinds(w, h, open) {       // horizontal bands, each `open` (0..1) of its height
    var n = 9, band = h / n, pts = [];
    for (var i = 0; i < n; i++) {
      var c = (i + .5) * band, half = band * open / 2 + (open ? 1 : 0);
      var t = round(c - half), b = round(c + half);
      pts.push('-5px ' + t + 'px', (w + 5) + 'px ' + t + 'px', (w + 5) + 'px ' + b + 'px', '-5px ' + b + 'px');
    }
    return 'polygon(' + pts.join(', ') + ')';
  }

  var EGGS = {
    // An old tube switching off: a flash, the picture crushed to a bright line,
    // the line to a dot, the dot out.
    crt: function () {
      return [[
        { transform: 'scale(1, 1)', filter: 'brightness(1)', offset: 0 },
        { transform: 'scale(1, 1)', filter: 'brightness(1.9) contrast(1.15)', offset: .12,
          easing: 'cubic-bezier(.3, 0, .2, 1)' },
        { transform: 'scale(1, .004)', filter: 'brightness(2.8)', offset: .55,
          easing: 'cubic-bezier(.5, 0, .3, 1)' },
        { transform: 'scale(.004, .004)', filter: 'brightness(4)', offset: .88 },
        { transform: 'scale(0, 0)', filter: 'brightness(4)', offset: 1 }
      ], { duration: 720 }];
    },
    // Static: the picture jumps, goes grey and grainy, and cuts out in steps.
    static: function () {
      var mask = { maskImage: NOISE, webkitMaskImage: NOISE, maskSize: '360px 360px', webkitMaskSize: '360px 360px' };
      function k(offset, extra) {
        var o = { offset: offset, easing: 'steps(1, end)' };
        for (var key in extra) o[key] = extra[key];
        return o;
      }
      function m(offset, pos, opacity, dx) {
        var o = k(offset, { maskPosition: pos, webkitMaskPosition: pos, opacity: opacity,
                            transform: 'translate(' + dx + 'px, 0)',
                            filter: 'grayscale(1) contrast(1.7) brightness(1.15)' });
        for (var key in mask) o[key] = mask[key];
        return o;
      }
      return [[
        k(0,   { transform: 'translate(0, 0)', filter: 'none', opacity: 1 }),
        k(.07, { transform: 'translate(-7px, 2px)', filter: 'contrast(1.5) brightness(1.3)', opacity: 1 }),
        k(.12, { transform: 'translate(6px, -2px)', filter: 'grayscale(.6) contrast(1.6)', opacity: 1 }),
        m(.17, '0px 0px', 1, -3), m(.26, '61px 113px', .95, 4), m(.35, '140px 27px', .85, -2),
        m(.44, '33px 160px', .72, 3), m(.53, '118px 88px', .58, -4), m(.62, '72px 12px', .44, 2),
        m(.71, '165px 131px', .3, -1), m(.8, '19px 52px', .17, 2), m(.89, '96px 170px', .07, 0),
        m(1, '0px 0px', 0, 0)
      ], { duration: 780 }];
    },
    // Venetian blinds: the old theme narrows to stripes and the stripes to nothing.
    blinds: function (x, y, reach, w, h) {
      return [{ clipPath: [blinds(w, h, 1), blinds(w, h, 0)] },
              { duration: 640, easing: 'cubic-bezier(.55, 0, .35, 1)' }];
    }
  };
  var EGG_RATE = 1 / 7;
  // ?wipe=<name> pins one effect: any shape or egg by name, for checking them.
  var PINNED = (/[?&]wipe=([a-z]+)/.exec(location.search) || [])[1] || null;

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
      remember(next);
      return;
    }

    var box = toggle.getBoundingClientRect();
    var x = box.left + box.width / 2;
    var y = box.top + box.height / 2;
    var w = window.innerWidth, h = window.innerHeight;

    // Distance to the furthest corner, plus headroom so the shape leaves the
    // viewport before the easing curve flattens out.
    var reach = Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) * 1.18;
    var closing = next === 'light';
    var frames;

    /* Both directions clip the OUTGOING snapshot, which sits on top for the
       whole wipe (see [data-wipe] in style.css). That is the direction that
       always worked: the outgoing snapshot is a still image, ready before the
       first frame. Going dark used to clip the incoming page instead, and in
       some browsers that live image is not painted for the first frames, so
       the whole screen went dark and blank before the shape appeared.

       Closing (to light) shrinks the dark snapshot into the button. Opening
       (to dark) is its exact reverse in look: the light snapshot stays whole
       and a hole in the chosen shape grows out of the button, the dark page
       showing through it. */
    var egg = PINNED ? (EGGS[PINNED] ? PINNED : null)
                     : (Math.random() < EGG_RATE ? Object.keys(EGGS)[Math.floor(Math.random() * 3)] : null);
    var effect;
    if (egg) {
      effect = EGGS[egg](x, y, reach, w, h);
    } else {
      var shape = closing ? pickShape() : pickHole();
      if (PINNED) {
        var table = closing ? SHAPES : HOLES;
        for (var s = 0; s < table.length; s++) {
          if (table[s].name.indexOf(PINNED) === 0) shape = table[s];
        }
      }
      frames = shape(x, y, reach, w, h);
      if (closing) frames = frames.slice().reverse();
      effect = [{ clipPath: frames }, {
        /* What matters is the time the shape spends crossing the screen, not
           the duration: it overshoots the viewport by 18%. Opening on
           cubic-bezier(.3, .7, .2, 1) over 620 ms crossed it in 240 ms, against
           395 ms for closing, and going dark felt twice as fast. This leaves
           the button at once and settles, and crosses in about 380 ms. */
        duration: closing ? 560 : 660,
        easing: closing ? 'cubic-bezier(.55, 0, .35, 1)' : 'cubic-bezier(.45, .25, .3, 1)'
      }];
    }
    root.dataset.wipe = 'out';

    var transition = document.startViewTransition(function () { paint(next); });

    /* The effect is filled forwards so it holds its last frame until the
       transition ends -- and a filled animation outlives the transition: it
       stays on the root's ::view-transition-old pseudo and applies to the next
       one too. For the shapes that went unnoticed, since each new clip-path
       replaced the last. The static egg leaves opacity 0 and the CRT scale 0,
       so after either one every later switch showed nothing of the old theme
       and just blinked. So: clear them when the transition ends, and clear
       any stragglers before a new one starts. */
    function clearEffects() {
      document.getAnimations().forEach(function (a) {
        if (a.effect && a.effect.pseudoElement &&
            a.effect.pseudoElement.indexOf('view-transition') >= 0) a.cancel();
      });
    }
    clearEffects();
    function done() { delete root.dataset.wipe; clearEffects(); }
    transition.finished.then(done, done);
    transition.ready.then(function () { remember(next); }, function () { remember(next); });

    transition.ready.then(function () {
      var opts = effect[1];
      // Without this the effect reverts on its last frame and flashes the whole
      // outgoing theme back in.
      opts.fill = 'forwards';
      opts.pseudoElement = '::view-transition-old(root)';
      root.animate(effect[0], opts);
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
   * 4. Videos: the teaser in the header and the clips in section 4
   *
   * None of these files exist yet, and a <video> with nothing behind it
   * renders as an empty player with its controls showing -- which is what
   * section 4 put on the live page. So a video is shown only once it has
   * loaded. Until then the teaser slot stays hidden and section 4 says the
   * clips are coming. With ?draft in the address, every slot names the file
   * it is waiting for instead, so the layout can be checked before the
   * renders exist. Dropping a file in needs no change to the markup.
   * ------------------------------------------------------------------ */

  var draft = /[?&]draft(?:[=&]|$)/.test(location.search);

  /* Whether a video's current source exists. Each call supersedes the last
     for that element, because a source swapped mid-load leaves the previous
     call's listeners armed, and the new file's events would answer them. */
  function probe(video, onReady, onMissing) {
    var mine = (video._probe || 0) + 1;
    video._probe = mine;
    var settled = false;
    function settle(fn) {
      return function () {
        if (settled || video._probe !== mine) return;
        settled = true;
        fn();
      };
    }
    var ready = settle(onReady), missing = settle(onMissing);
    video.addEventListener('loadedmetadata', ready);
    video.addEventListener('error', missing);
    var source = video.querySelector('source');
    if (source) source.addEventListener('error', missing);
    // The answer may already be in by the time this runs.
    if (video.readyState >= 1) ready();
    else if (video.networkState === 3) missing();   // NETWORK_NO_SOURCE
  }

  function pending(text, quiet) {
    var box = document.createElement('div');
    box.className = 'video-pending' + (quiet ? ' quiet' : '');
    box.textContent = text;
    return box;
  }

  var teaserSlot = document.getElementById('teaser-slot');
  var teaserVideo = document.getElementById('teaser-video');
  if (teaserSlot && teaserVideo) {
    probe(teaserVideo, function () {
      teaserSlot.hidden = false;
      var playing = teaserVideo.play();
      if (playing && playing.catch) playing.catch(function () {});
    }, function () {
      // Nothing on the first screen of the live page; a labelled box in draft.
      if (!draft) return;
      teaserVideo.hidden = true;
      teaserVideo.parentNode.insertBefore(
        pending('assets/video/teaser.mp4 · autoplay, muted, loop'), teaserVideo);
      teaserSlot.hidden = false;
    });
  }

  var qual = document.getElementById('qualitative');
  var video = document.getElementById('scene-video');

  if (qual && video) {
    var source = video.querySelector('source');
    var caption = document.getElementById('scene-caption');
    var base = caption ? caption.getAttribute('data-base') || '' : '';
    var rows = Array.prototype.slice.call(qual.querySelectorAll('.picker-row'));
    var pickers = Array.prototype.slice.call(qual.querySelectorAll('.scene-picker[data-axis]'));
    var chosen = {};
    var note = null;

    pickers.forEach(function (picker) {
      chosen[picker.getAttribute('data-axis')] =
        picker.querySelector('[aria-selected="true"]') || picker.querySelector('button');
    });

    function clip(ext) {
      return 'assets/video/' + chosen.scene.getAttribute('data-value') + '_' +
             chosen.setting.getAttribute('data-value') + ext;
    }
    function say(text, quiet) {
      if (note) note.remove();
      note = pending(text, quiet);
      video.hidden = true;
      video.parentNode.insertBefore(note, video);
    }

    function show(first) {
      if (note) { note.remove(); note = null; }
      video.hidden = false;
      if (caption) caption.textContent = base + ' ' + (chosen.setting.getAttribute('data-caption') || '');

      video.pause();
      video.poster = clip('.jpg');
      source.src = clip('.mp4');
      video.load();

      probe(video, function () {
        rows.forEach(function (r) { r.hidden = false; });
        if (caption) caption.hidden = false;
      }, function () {
        if (draft) { say('missing ' + clip('.mp4')); return; }
        if (first) {
          /* Nothing rendered yet at all: no pickers for clips that do not
             exist, just the one line, in the same voice as the "(soon)" on
             the Paper and Code buttons. */
          rows.forEach(function (r) { r.hidden = true; });
          if (caption) caption.hidden = true;
          say('The videos are on their way.', true);
          return;
        }
        say('Not rendered for this scene and setting yet.', true);
      });
    }

    pickers.forEach(function (picker) {
      picker.addEventListener('click', function (event) {
        var button = event.target.closest('button[data-value]');
        if (!button) return;
        picker.querySelectorAll('button').forEach(function (b) {
          b.setAttribute('aria-selected', String(b === button));
        });
        chosen[picker.getAttribute('data-axis')] = button;
        show(false);
      });
    });

    show(true);
  }

  /* ------------------------------------------------------------------ *
   * 4b. Dataset tabs on the results tables
   *
   * One table per figure, with the dataset or split switched above it, rather
   * than three tables stacked down the page: the columns are the same, so a
   * reader compares by switching and the page stays the length it was. The
   * tabs keep their names visible, which is what a sideways carousel would
   * have lost. A tab marked data-draft (a table still waiting on numbers)
   * exists only with ?draft in the address.
   * ------------------------------------------------------------------ */

  Array.prototype.slice.call(document.querySelectorAll('.table-tabs')).forEach(function (bar) {
    var tabs = Array.prototype.slice.call(bar.querySelectorAll('[role="tab"]'));
    function panel(tab) { return document.getElementById(tab.getAttribute('aria-controls')); }

    tabs = tabs.filter(function (tab) {
      if (!tab.hasAttribute('data-draft')) return true;
      if (draft) { tab.hidden = false; return true; }
      tab.remove();
      var p = panel(tab);
      if (p) p.remove();
      return false;
    });
    // A single table needs no switch.
    if (tabs.length < 2) { bar.hidden = true; return; }

    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        var p = panel(t);
        if (p) p.hidden = !on;
      });
      if (focus) tab.focus();
    }

    bar.addEventListener('click', function (event) {
      var tab = event.target.closest('[role="tab"]');
      if (tab) select(tab, false);
    });
    bar.addEventListener('keydown', function (event) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var d = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      event.preventDefault();
      select(tabs[(i + d + tabs.length) % tabs.length], true);
    });
  });

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

  function placehold(img) {
    var note = document.createElement('div');
    note.className = 'placeholder';
    note.textContent = 'missing figure, add ' + img.getAttribute('src');
    img.replaceWith(note);
  }

  Array.prototype.slice.call(document.querySelectorAll('.figure img'))
    .forEach(function (img) {
      img.addEventListener('error', function () { placehold(img); });
      // This script runs at the end of the body, by which time an image that
      // was going to 404 already has, and its error event fired with nothing
      // listening. A decoded image has a natural width; a failed one does not,
      // so that is the state to check rather than the event to wait for.
      if (img.complete && !img.naturalWidth) placehold(img);
    });

  /* ------------------------------------------------------------------ *
   * 6b. Figures open full screen
   *
   * Click, tap or Enter on a figure and it fills the window over a dark
   * scrim, with its caption under it. On a desktop a second click shows it
   * at its natural size, to be dragged or scrolled around; on a phone it can
   * be pinched. It closes on the scrim, the close button, Escape, or the
   * phone's back gesture -- it takes a history entry, so back closes the
   * figure instead of leaving the page.
   * ------------------------------------------------------------------ */

  var shots = Array.prototype.slice.call(document.querySelectorAll('.figure img'));
  if (shots.length) {
    var box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Figure');
    box.hidden = true;
    box.innerHTML = '<button type="button" class="lightbox-close" aria-label="Close">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
      '<div class="lightbox-stage"><img alt=""></div><p class="lightbox-hint">Pinch to zoom</p>' +
      '<p class="lightbox-cap"></p>';
    document.body.appendChild(box);
    var stage = box.querySelector('.lightbox-stage');
    var big = box.querySelector('img');
    var cap = box.querySelector('.lightbox-cap');
    var closeBtn = box.querySelector('.lightbox-close');
    var opener = null, viaHistory = false;

    function open(img) {
      opener = img;
      big.src = img.currentSrc || img.src;
      big.alt = img.alt;
      var fc = img.closest('figure') && img.closest('figure').querySelector('figcaption');
      cap.innerHTML = fc ? fc.innerHTML : '';
      cap.hidden = !fc;
      box.classList.remove('actual');
      box.hidden = false;
      root.dataset.lightbox = '1';
      requestAnimationFrame(function () { box.classList.add('shown'); });
      closeBtn.focus({ preventScroll: true });
      try { history.pushState({ lightbox: 1 }, ''); viaHistory = true; } catch (e) { viaHistory = false; }
    }
    function shut(fromHistory) {
      if (box.hidden) return;
      box.classList.remove('shown');
      delete root.dataset.lightbox;
      setTimeout(function () { box.hidden = true; big.removeAttribute('src'); }, 180);
      if (opener) opener.focus({ preventScroll: true });
      if (viaHistory && !fromHistory) { viaHistory = false; history.back(); }
      viaHistory = false;
    }

    shots.forEach(function (img) {
      img.classList.add('zoomable');
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', 'Enlarge figure: ' + (img.alt || ''));
      img.addEventListener('click', function () { open(img); });
      img.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); }
      });
    });

    box.addEventListener('click', function (e) {
      if (e.target === big) {
        // Natural size on a large screen; a phone pinches instead.
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
            big.naturalWidth > stage.clientWidth) box.classList.toggle('actual');
        return;
      }
      if (e.target === box || e.target === stage || e.target.closest('.lightbox-close')) shut(false);
    });
    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); shut(false); }
      if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); }   // keep focus in the dialog
    });
    window.addEventListener('popstate', function () { if (!box.hidden) shut(true); });
  }

  /* ------------------------------------------------------------------ *
   * 7. The name in the title
   *
   * A round lens follows the pointer over the name, and inside it the
   * letters are shown as the HD map a model would build from them. It also
   * passes along the name by itself whenever the reader arrives at the top of
   * the page -- on opening it, and again on coming back up, by scrolling or by
   * the to-top button -- so a first-time reader, and anyone on a touch screen,
   * sees what it does. The
   * drawing is in index.html, generated by tools/title/; this only moves the
   * lens and switches it on and off.
   * ------------------------------------------------------------------ */

  var nameSvg = document.querySelector('.name-svg');
  if (nameSvg) {
    var lens = document.getElementById('nm-lens');
    var spec = (nameSvg.getAttribute('data-lens') || '0 0').split(' ').map(Number);
    var LR = spec[0], MID = spec[1];
    var vb = nameSvg.viewBox.baseVal;
    var nameBox = nameSvg.parentNode;
    var still = reduceMotion.matches;
    var at = null, aimAt = null, glide = 0, pointerIn = false, running = false, away = false;

    function place(p) { lens.setAttribute('cx', p.x); lens.setAttribute('cy', p.y); }
    function show(on) { nameSvg.classList.toggle('has-roi', on); }
    function svgPoint(e) {
      var box = nameSvg.getBoundingClientRect();
      return { x: vb.x + (e.clientX - box.left) / (box.width || 1) * vb.width,
               y: vb.y + (e.clientY - box.top) / (box.height || 1) * vb.height };
    }

    // The lens trails the pointer a little rather than sticking to it.
    function follow() {
      glide = 0;
      if (!aimAt) return;
      if (!at || still) at = { x: aimAt.x, y: aimAt.y };
      else { at.x += (aimAt.x - at.x) * 0.22; at.y += (aimAt.y - at.y) * 0.22; }
      place(at);
      if (Math.abs(aimAt.x - at.x) + Math.abs(aimAt.y - at.y) > 0.5) glide = requestAnimationFrame(follow);
    }
    function aim(p) { aimAt = p; if (!glide) glide = requestAnimationFrame(follow); }

    nameBox.addEventListener('pointerenter', function (e) {
      pointerIn = true;
      at = null;                      // arrive at the pointer, do not slide in from the last spot
      aim(svgPoint(e));
      show(true);
    });
    nameBox.addEventListener('pointermove', function (e) { aim(svgPoint(e)); });
    nameBox.addEventListener('pointerleave', function () { pointerIn = false; show(false); });

    // The unprompted pass, along the middle of the letters.
    function demo() {
      if (running || pointerIn || document.hidden) return;
      var box = nameBox.getBoundingClientRect();
      if (box.bottom <= 0 || box.top >= (window.innerHeight || 0)) return;
      running = true;
      var from = -LR, to = vb.width + LR, ms = 2400, t0 = null;
      show(true);
      (function pass(now) {
        if (pointerIn) { running = false; return; }   // a real pointer takes over
        if (t0 === null) t0 = now;
        var k = Math.min(1, (now - t0) / ms);
        var e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        at = { x: from + (to - from) * e, y: MID };
        place(at);
        if (k < 1) requestAnimationFrame(pass);
        else { show(false); running = false; }
      })(performance.now());
    }

    if (!still) {
      setTimeout(demo, 1100);
      /* And again on every return to the top. "Away" means the name went off
         the top of the window; coming back means the page is at its top
         again, which is where a reload, the to-top button and a long scroll
         up all end. A short wait lets a smooth scroll finish landing. */
      var looking = false;
      window.addEventListener('scroll', function () {
        if (looking) return;
        looking = true;
        requestAnimationFrame(function () {
          looking = false;
          if (nameBox.getBoundingClientRect().bottom < 0) away = true;
          else if (away && (window.scrollY || 0) < 40) { away = false; setTimeout(demo, 250); }
        });
      }, { passive: true });
    }
  }
})();
