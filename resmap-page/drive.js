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
    var signBox = document.getElementById('rail-signs');

    var RW = 168;           // rail width, css px
    var ROAD_X = 140;       // road centreline within the rail
    var ROAD_HALF = 17;     // road half width
    var CAP = 34;           // clear space at each end so the car never clips
    var SIGN_GAP = 25;      // minimum vertical spacing between signs
    var SIGN_RIGHT = 62;    // signs end this far from the rail's right edge
    var ELBOW = 116;        // where the leader line turns
    var MIN_VIEWPORT = 1040;

    var rdpr = 1, RH = 0;
    var stops = [];
    var dragging = false;
    var pending = false;
    var accent = '#0e4a84';

    function maxScroll() {
      return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    }
    function progress() {
      return Math.min(1, Math.max(0, window.scrollY / maxScroll()));
    }
    function carY(p) { return CAP + p * (RH - CAP * 2); }

    /* Each section is a junction on the route and gets a sign beside it. The
       signs are the navigation, which is why the top bar drops its links while
       the rail is up. */
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

      signBox.textContent = '';
      stops.forEach(function (stop) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'sign';
        b.textContent = stop.name;
        b.addEventListener('click', function () {
          var el = document.getElementById(stop.id);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        });
        signBox.appendChild(b);
        stop.el = b;
      });
      layoutSigns();
    }

    /* Sections bunch up wherever the document has several short ones in a row,
       so the plates are pushed apart to a legible spacing while the tick they
       point at stays at the true position. */
    function layoutSigns() {
      if (!stops.length) return;
      var n = stops.length, i;
      for (i = 0; i < n; i++) stops[i].signY = carY(stops[i].p);
      for (i = 1; i < n; i++) {
        if (stops[i].signY - stops[i - 1].signY < SIGN_GAP) {
          stops[i].signY = stops[i - 1].signY + SIGN_GAP;
        }
      }
      var floorY = RH - CAP * 0.6;
      if (stops[n - 1].signY > floorY) {
        stops[n - 1].signY = floorY;
        for (i = n - 2; i >= 0; i--) {
          if (stops[i + 1].signY - stops[i].signY < SIGN_GAP) {
            stops[i].signY = stops[i + 1].signY - SIGN_GAP;
          }
        }
      }
      for (i = 0; i < n; i++) stops[i].el.style.top = Math.round(stops[i].signY) + 'px';
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
      var len = 26, wide = 13, x = ROAD_X;
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
      var lane = ROAD_HALF * 0.38;

      rctx.clearRect(0, 0, RW, RH);
      rctx.lineCap = 'round';

      // Road boundaries and lane dividers, running the height of the viewport.
      rctx.lineWidth = 1.3;
      rctx.strokeStyle = colour('boundary');
      rctx.globalAlpha = 0.55;
      [-ROAD_HALF, ROAD_HALF].forEach(function (off) {
        rctx.beginPath();
        rctx.moveTo(ROAD_X + off, CAP * 0.4);
        rctx.lineTo(ROAD_X + off, RH - CAP * 0.4);
        rctx.stroke();
      });
      rctx.lineWidth = 1;
      rctx.strokeStyle = colour('divider');
      rctx.globalAlpha = 0.4;
      [-lane, lane].forEach(function (off) {
        rctx.beginPath();
        rctx.moveTo(ROAD_X + off, CAP * 0.4);
        rctx.lineTo(ROAD_X + off, RH - CAP * 0.4);
        rctx.stroke();
      });
      rctx.globalAlpha = 1;

      // Junctions, and the post running from each sign out to its junction.
      var here = null;
      stops.forEach(function (s) {
        if (s.p <= p + 0.002) here = s;
      });

      stops.forEach(function (s) {
        var y = carY(s.p);
        var passed = s.p <= p + 0.002;
        var current = s === here;

        rctx.strokeStyle = colour('crossing');
        rctx.globalAlpha = current ? 0.85 : (passed ? 0.3 : 0.62);
        rctx.lineWidth = current ? 1.6 : 1;
        rctx.beginPath();
        rctx.moveTo(ROAD_X - ROAD_HALF, y);
        rctx.lineTo(ROAD_X + ROAD_HALF, y);
        rctx.stroke();

        // Leader line from the junction out to its sign, elbowed rather than
        // drawn straight, since de-collision can move a plate a long way from
        // the tick it belongs to.
        var sy = s.signY === undefined ? y : s.signY;
        rctx.strokeStyle = 'rgba(' + ink + ', ' + (current ? 0.38 : 0.17) + ')';
        rctx.globalAlpha = 1;
        rctx.lineWidth = 1;
        rctx.beginPath();
        rctx.moveTo(ROAD_X - ROAD_HALF - 2, y);
        rctx.lineTo(ELBOW, y);
        rctx.lineTo(ELBOW, sy);
        rctx.lineTo(RW - SIGN_RIGHT - 2, sy);
        rctx.stroke();

        if (s.el) s.el.classList.toggle('here', current);
        if (s.el) s.el.classList.toggle('passed', passed && !current);
      });

      // The stretch already driven.
      rctx.strokeStyle = accent;
      rctx.globalAlpha = 0.22;
      rctx.lineWidth = 2;
      rctx.beginPath();
      rctx.moveTo(ROAD_X, CAP * 0.4);
      rctx.lineTo(ROAD_X, cy);
      rctx.stroke();
      rctx.globalAlpha = 1;

      drawCar(cy);
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

    function onRoad(e) {
      var rect = canvas.getBoundingClientRect();
      return e.clientX - rect.left > RW - SIGN_RIGHT;
    }

    canvas.addEventListener('pointerdown', function (e) {
      if (!onRoad(e)) return;
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

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('load', function () { measure(); draw(); });
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resmap:theme', function () { readAccent(); draw(); });
  }
})();
