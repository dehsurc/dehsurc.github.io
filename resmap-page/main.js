// ReSMap project page — three small behaviours, nothing else.

(function () {
  'use strict';

  // 1. Highlight the nav entry for the section currently in view.
  var links = Array.prototype.slice.call(
    document.querySelectorAll('.topbar ul a')
  );
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

  // 2. Swap the qualitative video when a scene is picked.
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

  // 3. Copy the BibTeX entry.
  var copy = document.getElementById('copy-bib');
  var bib = document.getElementById('bib');

  if (copy && bib && navigator.clipboard) {
    copy.addEventListener('click', function () {
      navigator.clipboard.writeText(bib.textContent).then(function () {
        var label = copy.textContent;
        copy.textContent = 'Copied';
        setTimeout(function () { copy.textContent = label; }, 1600);
      });
    });
  } else if (copy) {
    copy.hidden = true;
  }

  // 4. Figures whose file has not been added yet: show what is missing
  //    instead of a broken-image icon. Remove this once assets are in place.
  document.querySelectorAll('.figure img').forEach(function (img) {
    img.addEventListener('error', function () {
      var note = document.createElement('div');
      note.className = 'placeholder';
      note.textContent = 'missing figure — add ' + img.getAttribute('src');
      img.replaceWith(note);
    });
  });
})();
