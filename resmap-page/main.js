// ReSMap project page — a few small behaviours, nothing else.

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // 1. Theme toggle. The palette lives in CSS custom properties, so applying a
  //    theme is one attribute write; the interesting part is the transition.
  var toggle = document.getElementById('theme-toggle');

  function label(theme) {
    return 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' theme';
  }

  function paint(theme) {
    root.dataset.theme = theme;
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(theme === 'dark'));
      toggle.setAttribute('aria-label', label(theme));
    }
    try { localStorage.setItem('resmap-theme', theme); } catch (e) { /* private mode */ }
  }

  if (toggle) {
    paint(root.dataset.theme === 'dark' ? 'dark' : 'light');

    toggle.addEventListener('click', function () {
      var next = root.dataset.theme === 'dark' ? 'light' : 'dark';

      // Without View Transitions (or with reduced motion), swap and let the
      // CSS colour transitions carry it.
      if (!document.startViewTransition || reduceMotion.matches) {
        paint(next);
        return;
      }

      // Otherwise: wipe the new theme in as a circle growing out of the
      // button, sized so it reaches the furthest corner of the viewport.
      var box = toggle.getBoundingClientRect();
      var x = box.left + box.width / 2;
      var y = box.top + box.height / 2;
      var radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      var transition = document.startViewTransition(function () { paint(next); });

      transition.ready.then(function () {
        root.animate(
          {
            clipPath: [
              'circle(0px at ' + x + 'px ' + y + 'px)',
              'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'
            ]
          },
          {
            duration: 620,
            easing: 'cubic-bezier(.22, 1, .36, 1)',
            pseudoElement: '::view-transition-new(root)'
          }
        );
      }).catch(function () { /* transition skipped; the theme still applied */ });
    });
  }

  // 2. Highlight the nav entry for the section currently in view.
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

  // 3. Swap the qualitative video when a scene is picked.
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

  // 4. Copy the BibTeX entry.
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

  // 5. Figures whose file has not been added yet: show what is missing instead
  //    of a broken-image icon. Remove this once the assets are in place.
  document.querySelectorAll('.figure img').forEach(function (img) {
    img.addEventListener('error', function () {
      var note = document.createElement('div');
      note.className = 'placeholder';
      note.textContent = 'missing figure — add ' + img.getAttribute('src');
      img.replaceWith(note);
    });
  });
})();
