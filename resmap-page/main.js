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
    var frames = pickShape()(x, y, reach, w, h);

    // The two directions are time-reverses of each other. Going dark the new
    // theme opens out of the button; coming back to light the dark snapshot
    // closes into it instead, so the shape gathers rather than spreads. That
    // means clipping the outgoing snapshot, which has to sit on top for the
    // duration. See the [data-wipe] rules in style.css.
    var closing = next === 'light';
    if (closing) {
      root.dataset.wipe = 'out';
      frames = frames.slice().reverse();
    }

    var transition = document.startViewTransition(function () { paint(next); });

    function done() { delete root.dataset.wipe; }
    transition.finished.then(done, done);
    transition.ready.then(function () { remember(next); }, function () { remember(next); });

    transition.ready.then(function () {
      root.animate({ clipPath: frames }, {
        duration: closing ? 560 : 620,
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
   * 7. The name in the title
   *
   * Now and then one letter of the name drops to its outline and fills back
   * in, and a pointer over the name runs the same thing through it letter by
   * letter. It is the paper in miniature: the evidence goes, the shape is
   * held, the letter comes back.
   *
   * Colour only, never position. Moving a letter means making each one its
   * own inline-block, which breaks the kerning across the word; a colour
   * change on plain inline spans leaves the setting exactly as it was. The
   * name is read once, whole, by a screen reader, and none of this runs for
   * anyone who has asked for less motion.
   * ------------------------------------------------------------------ */

  var nameEl = document.querySelector('.h1-name');
  if (nameEl && !reduceMotion.matches) {
    var word = nameEl.textContent;
    var said = document.createElement('span');
    said.className = 'sr-only';
    said.textContent = word;
    var drawn = document.createElement('span');
    drawn.setAttribute('aria-hidden', 'true');
    var letters = word.split('').map(function (c) {
      var span = document.createElement('span');
      span.className = 'ch';
      span.textContent = c;
      drawn.appendChild(span);
      return span;
    });
    nameEl.textContent = '';
    nameEl.appendChild(said);
    nameEl.appendChild(drawn);

    var HOLD = 560;            // ms a letter spends as an outline
    var STEP = 65;             // ms between letters in a sweep
    var sweeping = false, over = false, lastIdle = -1;

    function blink(span, delay) {
      setTimeout(function () {
        span.classList.add('out');
        setTimeout(function () { span.classList.remove('out'); }, HOLD);
      }, delay);
    }

    nameEl.addEventListener('mouseenter', function () {
      over = true;
      if (sweeping) return;
      sweeping = true;
      letters.forEach(function (span, i) { blink(span, i * STEP); });
      setTimeout(function () { sweeping = false; },
                 (letters.length - 1) * STEP + HOLD + 400);
    });
    nameEl.addEventListener('mouseleave', function () { over = false; });

    /* The idle one: a single letter, every six to ten seconds, and only while
       the name is on screen in a visible tab and nobody is pointing at it. */
    (function idle() {
      setTimeout(function () {
        var box = nameEl.getBoundingClientRect();
        var seen = box.bottom > 0 && box.top < (window.innerHeight || 0);
        if (seen && !document.hidden && !over && !sweeping) {
          var i;
          do { i = Math.floor(Math.random() * letters.length); } while (i === lastIdle && letters.length > 1);
          lastIdle = i;
          blink(letters[i], 0);
        }
        idle();
      }, 6000 + Math.random() * 4000);
    })();
  }
})();
