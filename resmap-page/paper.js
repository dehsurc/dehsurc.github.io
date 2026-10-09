/* §5 paper: a card with the first page as its cover, and a reader that opens
   over the page (the header's Paper button opens it too).

   Everything waits on assets/paper.pdf. Until that file is there the card
   says the PDF is coming and the buttons stay "(soon)"; drop the file in and
   the cover, the reader and the header button switch on by themselves.
   Pages are drawn with pdf.js (cdnjs), loaded only when the section comes
   near or the reader opens, so a visitor who never gets here pays nothing. */
(function () {
  var PDF = 'assets/paper.pdf';
  var LIB = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

  var card = document.getElementById('paper-card');
  var box = document.getElementById('pdfbox');
  if (!card || !box) return;

  var cover = card.querySelector('.paper-cover canvas');
  var opens = Array.prototype.slice.call(document.querySelectorAll('[data-open-paper]'));
  var header = document.querySelector('.links a.paper-link');
  var scroller = box.querySelector('.pdf-pages');
  var pageNow = box.querySelector('.pdf-page-now');
  var zoomLabel = box.querySelector('.pdf-zoom-label');

  var lib = null, doc = null, zoom = 1, lastFocus = null, rendered = {};

  function loadLib() {
    if (lib) return lib;
    lib = new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = LIB + 'pdf.min.js';
      s.onload = function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = LIB + 'pdf.worker.min.js';
        ok(window.pdfjsLib);
      };
      s.onerror = fail;
      document.head.appendChild(s);
    });
    return lib;
  }
  function loadDoc() {
    if (doc) return doc;
    doc = loadLib().then(function (pdfjs) { return pdfjs.getDocument(PDF).promise; });
    return doc;
  }

  /* ---------------------------------------------------------------- the card */
  function enable() {
    card.classList.add('ready');
    opens.forEach(function (b) {
      b.disabled = false;
      b.removeAttribute('aria-disabled');
      var soon = b.querySelector('.soon');
      if (soon) soon.remove();
    });
    var dl = card.querySelector('.paper-download');
    if (dl) { dl.href = PDF; dl.removeAttribute('aria-disabled'); var s = dl.querySelector('.soon'); if (s) s.remove(); }
    if (header) {
      header.href = PDF;
      header.removeAttribute('aria-disabled');
      var hs = header.querySelector('.soon');
      if (hs) hs.remove();
      header.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;   // a new tab still gets the file
        e.preventDefault();
        open();
      });
    }
    // the cover, once the section is close
    var io = 'IntersectionObserver' in window && new IntersectionObserver(function (es) {
      if (!es.some(function (e) { return e.isIntersecting; })) return;
      io.disconnect();
      drawCover();
    }, { rootMargin: '400px 0px' });
    if (io) io.observe(card); else drawCover();
  }

  function drawCover() {
    loadDoc().then(function (d) { return d.getPage(1); }).then(function (page) {
      var w = cover.clientWidth || 220, dpr = Math.min(window.devicePixelRatio || 1, 2);
      var v = page.getViewport({ scale: 1 });
      var vp = page.getViewport({ scale: w * dpr / v.width });
      cover.width = vp.width; cover.height = vp.height;
      return page.render({ canvasContext: cover.getContext('2d'), viewport: vp }).promise;
    }).then(function () { card.classList.add('covered'); }).catch(function () {});
  }

  /* ---------------------------------------------------------------- the reader */
  function pageWidth() {
    return Math.min(scroller.clientWidth - 32, 880) * zoom;
  }

  function build(d) {
    if (scroller.childElementCount) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) renderPage(Number(e.target.getAttribute('data-page'))); });
    }, { root: scroller, rootMargin: '600px 0px' });
    for (var i = 1; i <= d.numPages; i++) {
      var slot = document.createElement('div');
      slot.className = 'pdf-page';
      slot.setAttribute('data-page', String(i));
      slot.style.width = pageWidth() + 'px';
      slot.style.aspectRatio = '8.5 / 11';
      slot.appendChild(document.createElement('canvas'));
      scroller.appendChild(slot);
      io.observe(slot);
    }
    box.querySelector('.pdf-page-total').textContent = String(d.numPages);
  }

  function renderPage(n) {
    var key = n + '@' + zoom;
    if (rendered[n] === key) return;
    rendered[n] = key;
    loadDoc().then(function (d) { return d.getPage(n); }).then(function (page) {
      var slot = scroller.querySelector('[data-page="' + n + '"]');
      var canvas = slot.querySelector('canvas');
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var v = page.getViewport({ scale: 1 });
      var w = pageWidth();
      var vp = page.getViewport({ scale: w * dpr / v.width });
      slot.style.aspectRatio = v.width + ' / ' + v.height;
      canvas.width = vp.width; canvas.height = vp.height;
      return page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    }).catch(function () { rendered[n] = null; });
  }

  function setZoom(z) {
    var at = scroller.scrollTop / Math.max(1, scroller.scrollHeight);
    zoom = Math.max(.6, Math.min(2.5, z));
    zoomLabel.textContent = Math.round(zoom * 100) + '%';
    Array.prototype.forEach.call(scroller.children, function (slot) { slot.style.width = pageWidth() + 'px'; });
    scroller.scrollTop = at * scroller.scrollHeight;
    Array.prototype.forEach.call(scroller.children, function (slot) {
      var r = slot.getBoundingClientRect(), s = scroller.getBoundingClientRect();
      if (r.bottom > s.top - 600 && r.top < s.bottom + 600) renderPage(Number(slot.getAttribute('data-page')));
    });
  }

  function trackPage() {
    var s = scroller.getBoundingClientRect(), mid = s.top + s.height / 3, n = 1;
    Array.prototype.forEach.call(scroller.children, function (slot) {
      if (slot.getBoundingClientRect().top <= mid) n = Number(slot.getAttribute('data-page'));
    });
    pageNow.textContent = String(n);
  }

  function open() {
    lastFocus = document.activeElement;
    box.hidden = false;
    document.documentElement.classList.add('pdf-open');
    requestAnimationFrame(function () { box.classList.add('shown'); });
    box.querySelector('.pdf-close').focus();
    loadDoc().then(function (d) { build(d); trackPage(); }).catch(function () {
      scroller.innerHTML = '<p class="pdf-fail">The PDF could not be opened here. <a href="' + PDF + '">Open it directly</a>.</p>';
    });
  }
  function close() {
    box.classList.remove('shown');
    document.documentElement.classList.remove('pdf-open');
    setTimeout(function () { box.hidden = true; }, 180);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  opens.forEach(function (b) { b.addEventListener('click', open); });
  box.querySelector('.pdf-close').addEventListener('click', close);
  box.querySelector('[data-pdf-zoom="in"]').addEventListener('click', function () { setZoom(zoom * 1.2); });
  box.querySelector('[data-pdf-zoom="out"]').addEventListener('click', function () { setZoom(zoom / 1.2); });
  box.querySelector('[data-pdf-zoom="fit"]').addEventListener('click', function () { setZoom(1); });
  scroller.addEventListener('scroll', trackPage, { passive: true });
  box.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
    else if (e.key === '+' || e.key === '=') setZoom(zoom * 1.2);
    else if (e.key === '-') setZoom(zoom / 1.2);
  });
  box.addEventListener('click', function (e) { if (e.target === scroller) close(); });

  // is the PDF there yet?
  fetch(PDF, { method: 'HEAD' }).then(function (r) {
    if (r.ok) enable();
  }).catch(function () {});
})();
