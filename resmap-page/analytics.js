/* Google Analytics 4. Page views come from gtag itself; the listeners below add
   the page's own interactions as events, without touching the other scripts.
   Nothing loads until MEASUREMENT_ID is set, and nothing is sent from a local
   copy of the page (localhost, file://), so testing never lands in the reports.

   Events (GA4 > Reports > Engagement > Events):
     code_click       the Code button or any link to the GitHub repo
     paper_open       Paper button / Read the paper
     paper_download   Download PDF
     bibtex_copy      the Copy button on the BibTeX block
     video_play       the long-range clip starts (the teaser autoplays, so its
                      start says nothing; its enlarge button and ending do)
     video_enlarge    the enlarge button on a clip  (video: teaser | long_range)
     video_complete   a clip plays to the end       (video: teaser | long_range)
     qual_scene       a scene picked in the qualitative viewer  (scene)
     qual_setting     range or camera setting switched           (range | cond)
     table_tab        a results table tab                        (tab)
     section_view     a section scrolled into view, once each    (section) */
(function () {
  var MEASUREMENT_ID = 'G-8Y8L3Z9J1K';   // EDIT: 'G-XXXXXXXXXX' from GA4 > Admin > Data streams

  var host = location.hostname;
  if (!MEASUREMENT_ID || host !== 'dehsurc.github.io') return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID);

  function send(name, params) { gtag('event', name, params || {}); }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('a, button');
    if (!t) return;
    var href = t.getAttribute('href') || '';
    if (/github\.com\/dehsurc\/ReSMap/i.test(href)) send('code_click');
    else if (t.matches('.paper-link, [data-open-paper]')) send('paper_open');
    else if (t.matches('.paper-download')) send('paper_download');
    else if (t.id === 'copy-bib') send('bibtex_copy');
    else if (t.matches('#qv [data-scene]')) send('qual_scene', { scene: t.getAttribute('data-scene') });
    else if (t.matches('#qv button[data-range]')) send('qual_setting', { range: t.getAttribute('data-range') });
    else if (t.matches('#qv button[data-cond]')) send('qual_setting', { cond: t.getAttribute('data-cond') });
    else if (t.matches('.table-tabs:not(.reel-tabs) button')) send('table_tab', { tab: t.textContent.trim() });
    else if (t.matches('.video-open')) {
      var v = t.parentNode.querySelector('video');
      if (v) send('video_enlarge', { video: clip(v) });
    }
  }, true);

  // play / ended do not bubble, so listen in the capture phase.
  function clip(v) { return /long_range/.test(v.currentSrc || '') ? 'long_range' : 'teaser'; }
  document.addEventListener('play', function (e) {
    var v = e.target;
    if (v.tagName === 'VIDEO' && clip(v) === 'long_range' && !v.dataset.gaPlayed) {
      v.dataset.gaPlayed = '1';   // once per visit, not per resume
      send('video_play', { video: 'long_range' });
    }
  }, true);
  document.addEventListener('ended', function (e) {
    if (e.target.tagName === 'VIDEO') send('video_complete', { video: clip(e.target) });
  }, true);

  if ('IntersectionObserver' in window) {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        send('section_view', { section: en.target.id });
        seen.unobserve(en.target);
      });
    }, { threshold: 0.25 });
    document.querySelectorAll('section[id]').forEach(function (el) { seen.observe(el); });
  }
})();
