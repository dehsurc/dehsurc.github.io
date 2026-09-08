/* ReSMap project page — the route rail.
 *
 * The rail down the right edge is the document as a single road. The car is
 * the scroll thumb: it travels down as the page scrolls, each section is a
 * junction along the way, and pressing or dragging anywhere on the rail seeks
 * one to one.
 *
 * There was a procedurally generated HD map behind the page as well. It is
 * gone: the geometry was invented, so it visibly repeated, and a region of
 * interest over invented geometry reveals nothing worth revealing. If the map
 * comes back it should be real polylines from a real scene.
 */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var CLASS = {
    boundary: { light: '#2f7d4f', dark: '#5cc084' },
    divider:  { light: '#c2831f', dark: '#e0a94a' },
    crossing: { light: '#2f6fb5', dark: '#6aa6e8' }
  };

  function dark() { return root.dataset.theme === 'dark'; }
  function colour(kind) { return CLASS[kind][dark() ? 'dark' : 'light']; }
  function neutral() { return dark() ? '233, 231, 226' : '27, 27, 25'; }

  function box(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------------------------------------------------------------- *
   * The route: the document as one road, the car as the scroll thumb
   * ---------------------------------------------------------------- */

  var rail = document.getElementById('rail');
  var canvas = document.getElementById('rail-map');

  if (rail && canvas && canvas.getContext) {
    var rctx = canvas.getContext('2d');
    var tip = document.getElementById('rail-tip');
    var tipName = document.getElementById('rail-name');
    var tipPct = document.getElementById('rail-pct');

    var RW = 46;            // rail width, css px
    var CAP = 30;           // clear space at each end so the car never clips
    var MIN_VIEWPORT = 900;

    var rdpr = 1, RH = 0;
    var stops = [];
    var dragging = false, hovering = false;
    var pending = false;
    var accent = '#0e4a84';

    function maxScroll() {
      return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    }
    function progress() {
      return Math.min(1, Math.max(0, window.scrollY / maxScroll()));
    }
    function carY(p) { return CAP + p * (RH - CAP * 2); }

    function measure() {
      var max = maxScroll();
      stops = Array.prototype.slice
        .call(document.querySelectorAll('main section[id]'))
        .map(function (s) {
          var link = document.querySelector('.topbar a[href="#' + s.id + '"]');
          var h2 = s.querySelector('h2');
          var top = s.getBoundingClientRect().top + window.scrollY;
          return {
            id: s.id,
            p: Math.min(1, Math.max(0, top / max)),
            name: link ? link.textContent
                       : (h2 ? h2.textContent.replace(/^\s*\d+\s*/, '') : s.id)
          };
        });
    }

    function readAccent() {
      accent = (getComputedStyle(root).getPropertyValue('--accent') || '').trim() || '#0e4a84';
    }

    function resize() {
      var on = window.innerWidth >= MIN_VIEWPORT;
      rail.hidden = !on;
      root.classList.toggle('has-rail', on);
      if (!on) return;

      rdpr = Math.min(window.devicePixelRatio || 1, 2);
      RH = window.innerHeight;
      canvas.width = Math.ceil(RW * rdpr);
      canvas.height = Math.ceil(RH * rdpr);
      canvas.style.width = RW + 'px';
      canvas.style.height = RH + 'px';
      rctx.setTransform(rdpr, 0, 0, rdpr, 0, 0);
      readAccent();
      measure();
      draw();
    }

    // Top-down vehicle, nose down the rail, because down the page is forward.
    function drawCar(y) {
      var len = 26, wide = 13, x = RW / 2;
      rctx.save();
      rctx.translate(x, y);

      var beam = rctx.createLinearGradient(0, len * 0.5, 0, len * 3.2);
      beam.addColorStop(0, 'rgba(255, 214, 130, .32)');
      beam.addColorStop(1, 'rgba(255, 214, 130, 0)');
      rctx.fillStyle = beam;
      rctx.beginPath();
      rctx.moveTo(-wide * 0.34, len * 0.5);
      rctx.lineTo(-wide * 1.25, len * 3.2);
      rctx.lineTo(wide * 1.25, len * 3.2);
      rctx.lineTo(wide * 0.34, len * 0.5);
      rctx.closePath();
      rctx.fill();

      rctx.fillStyle = accent;
      box(rctx, -wide / 2, -len / 2, wide, len, 3);
      rctx.fill();

      rctx.fillStyle = 'rgba(255,255,255,.62)';
      box(rctx, -wide / 2 + 2.2, -len * 0.04, wide - 4.4, len * 0.28, 1.5);
      rctx.fill();

      rctx.fillStyle = 'rgba(255,236,186,.95)';
      rctx.fillRect(-wide / 2 + 1.6, len / 2 - 3, 3, 2);
      rctx.fillRect(wide / 2 - 4.6, len / 2 - 3, 3, 2);
      rctx.restore();
    }

    function draw() {
      pending = false;
      if (rail.hidden) return;

      var p = progress(), ink = neutral();
      var cy = carY(p);
      var mid = RW / 2, half = RW * 0.30, lane = RW * 0.11;

      rctx.clearRect(0, 0, RW, RH);
      rctx.lineCap = 'round';

      // Road boundaries and lane dividers, running the height of the viewport.
      rctx.lineWidth = 1.3;
      rctx.strokeStyle = colour('boundary');
      rctx.globalAlpha = 0.55;
      [-half, half].forEach(function (off) {
        rctx.beginPath();
        rctx.moveTo(mid + off, CAP * 0.4);
        rctx.lineTo(mid + off, RH - CAP * 0.4);
        rctx.stroke();
      });
      rctx.lineWidth = 1;
      rctx.strokeStyle = colour('divider');
      rctx.globalAlpha = 0.4;
      [-lane, lane].forEach(function (off) {
        rctx.beginPath();
        rctx.moveTo(mid + off, CAP * 0.4);
        rctx.lineTo(mid + off, RH - CAP * 0.4);
        rctx.stroke();
      });
      rctx.globalAlpha = 1;

      // Every section is a junction along the route.
      stops.forEach(function (s) {
        var y = carY(s.p);
        var passed = s.p <= p + 0.002;
        rctx.strokeStyle = colour('crossing');
        rctx.globalAlpha = passed ? 0.32 : 0.7;
        rctx.lineWidth = 1;
        rctx.beginPath();
        rctx.moveTo(mid - half, y);
        rctx.lineTo(mid + half, y);
        rctx.stroke();
        rctx.globalAlpha = 1;

        rctx.fillStyle = 'rgba(' + ink + ', ' + (passed ? 0.22 : 0.42) + ')';
        rctx.beginPath();
        rctx.arc(mid + half + 4, y, 1.7, 0, Math.PI * 2);
        rctx.fill();
      });

      // The stretch already driven.
      rctx.strokeStyle = accent;
      rctx.globalAlpha = 0.22;
      rctx.lineWidth = 2;
      rctx.beginPath();
      rctx.moveTo(mid, CAP * 0.4);
      rctx.lineTo(mid, cy);
      rctx.stroke();
      rctx.globalAlpha = 1;

      drawCar(cy);

      if (tip && (hovering || dragging)) {
        var here = stops[0];
        stops.forEach(function (s) { if (s.p <= p + 0.002) here = s; });
        tipName.textContent = here ? here.name : '';
        tipPct.textContent = Math.round(p * 100) + '%';
        tip.hidden = false;
        tip.style.top = Math.round(cy) + 'px';
      } else if (tip) {
        tip.hidden = true;
      }
    }

    function request() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(draw);
    }

    /* Dragging the car is dragging the thumb: the pointer's position on the
       rail is the position in the document, one to one. */
    function seek(clientY) {
      var rect = canvas.getBoundingClientRect();
      var p = (clientY - rect.top - CAP) / (RH - CAP * 2);
      var top = Math.min(1, Math.max(0, p)) * maxScroll();
      // html has scroll-behavior: smooth, and a smooth scroll restarted on
      // every pointermove lurches instead of tracking. Seeking is instant.
      try {
        window.scrollTo({ top: top, behavior: 'instant' });
      } catch (err) {
        window.scrollTo(0, top);
      }
    }

    canvas.addEventListener('pointerdown', function (e) {
      dragging = true;
      rail.classList.add('dragging');
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      seek(e.clientY);
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (dragging) seek(e.clientY);
    });
    function release(e) {
      if (!dragging) return;
      dragging = false;
      rail.classList.remove('dragging');
      if (canvas.releasePointerCapture && e && e.pointerId !== undefined) {
        try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* gone */ }
      }
      request();
    }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    rail.addEventListener('pointerenter', function () { hovering = true; request(); });
    rail.addEventListener('pointerleave', function () { hovering = false; request(); });

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('load', function () { measure(); draw(); });
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resmap:theme', function () { readAccent(); draw(); });
  }
})();
