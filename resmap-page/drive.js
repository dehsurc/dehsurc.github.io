/* ReSMap project page: the route rail.
 *
 * The rail down the right edge is the document as a single road. The car is
 * the scroll thumb: it travels down as the page scrolls, each section is a
 * junction with a sign naming it, and pressing or dragging on the carriageway
 * seeks one to one.
 *
 * Ahead of the car the road is bare surface with faint markings. Behind it the
 * same elements are drawn in their map class colours, with vertices, because
 * the car is building the map as it drives. That is the subject of the paper,
 * and it makes the progress indicator mean something.
 */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function neutral() {
    return root.dataset.theme === 'dark' ? '229, 231, 234' : '21, 23, 27';
  }

  /* Map element colours, in the convention every online-mapping figure uses:
     boundary green, divider amber, pedestrian crossing blue. */
  var CLASS = {
    boundary: { light: '#3f9c63', dark: '#63c98c' },
    divider:  { light: '#c2831f', dark: '#e0a94a' },
    crossing: { light: '#3277bd', dark: '#6aa6e8' }
  };
  function colour(kind) {
    return CLASS[kind][root.dataset.theme === 'dark' ? 'dark' : 'light'];
  }

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
  var roadBox = document.getElementById('rail-road');

  if (rail && canvas && roadBox && canvas.getContext) {
    var rctx = canvas.getContext('2d');
    var signBox = document.getElementById('rail-signs');

    // The rail's width lives in style.css as --rail, so the reserved gutter and
    // the drawing can never drift apart.
    var RW = 172, ROAD_X = 142, ROAD_HALF = 18, ELBOW = 120;
    var CAP = 34;           // clear space at each end so the car never clips
    var SIGN_GAP = 26;      // minimum vertical spacing between signs
    var SIGN_RIGHT = 64;    // signs end this far from the rail's right edge
    var LOOKAHEAD = 0.35;   // a section counts as current once its heading is
                            // this far up the viewport, not only at the very top
    var MIN_VIEWPORT = 900;

    function readWidth() {
      var v = parseFloat(getComputedStyle(root).getPropertyValue('--rail'));
      if (v > 0) RW = v;
      ROAD_X = RW - 30;
      ELBOW = RW - SIGN_RIGHT + 8;
    }

    var rdpr = 1, RH = 0;
    var stops = [];
    var dragging = false;
    var pending = false;
    var accent = '#0e4a84', pavement = '#f4f5f7', paint = '#b4b9c1', sign = '#16673c';

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
            y: top,
            p: Math.min(1, Math.max(0, top / max)),
            name: link ? link.textContent
                       : (h2 ? h2.textContent.replace(/^\s*\d+\s*/, '') : s.id)
          };
        });

      signBox.textContent = '';
      stops.forEach(function (stop, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'sign';
        var num = document.createElement('b');
        num.textContent = i + 1;
        b.appendChild(num);
        b.appendChild(document.createTextNode(stop.name));
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

    function readPalette() {
      var cs = getComputedStyle(root);
      function v(name, fallback) {
        var got = (cs.getPropertyValue(name) || '').trim();
        return got || fallback;
      }
      accent = v('--accent', '#0e4a84');
      pavement = v('--surface', '#f4f5f7');
      paint = v('--rule-dark', '#b4b9c1');
      sign = v('--sign', '#16673c');
    }

    /* One theme toggle, moved into whichever chrome is showing. The top bar is
       the narrow-screen fallback for the rail, so the button has to follow. */
    var toggle = document.getElementById('theme-toggle');
    var railTop = rail.querySelector('.rail-top');
    var barHome = toggle && toggle.parentNode;

    function housetoggle(on) {
      if (!toggle) return;
      var home = on ? railTop : barHome;
      if (home && toggle.parentNode !== home) home.appendChild(toggle);
    }

    function resize() {
      var on = window.innerWidth >= MIN_VIEWPORT;
      rail.hidden = !on;
      root.classList.toggle('has-rail', on);
      housetoggle(on);
      if (!on) return;

      readWidth();
      rdpr = Math.min(window.devicePixelRatio || 1, 2);
      RH = roadBox.clientHeight || window.innerHeight;
      canvas.width = Math.ceil(RW * rdpr);
      canvas.height = Math.ceil(RH * rdpr);
      canvas.style.width = RW + 'px';
      canvas.style.height = RH + 'px';
      rctx.setTransform(rdpr, 0, 0, rdpr, 0, 0);
      readPalette();
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
      var top = CAP * 0.4, bot = RH - CAP * 0.4;
      var left = ROAD_X - ROAD_HALF, right = ROAD_X + ROAD_HALF;
      var edgeL = left + 2.5, edgeR = right - 2.5;
      var VERT = 22;          // vertex spacing on a drawn polyline

      rctx.clearRect(0, 0, RW, RH);
      rctx.lineCap = 'butt';

      // Carriageway.
      rctx.fillStyle = pavement;
      rctx.fillRect(left, top, ROAD_HALF * 2, bot - top);

      var probe = window.scrollY + window.innerHeight * LOOKAHEAD;
      var here = null;
      stops.forEach(function (s) { if (s.y <= probe) here = s; });
      if (!here && stops.length) here = stops[0];

      function crossing(y, style, width, alpha) {
        rctx.strokeStyle = style;
        rctx.globalAlpha = alpha;
        rctx.lineWidth = width;
        for (var b = 0; b < 4; b++) {
          var x = left + 5 + b * ((ROAD_HALF * 2 - 10) / 3.35);
          rctx.beginPath();
          rctx.moveTo(x, y - 4);
          rctx.lineTo(x, y + 4);
          rctx.stroke();
        }
        rctx.globalAlpha = 1;
      }

      /* Ahead of the car the road is unmapped: bare surface, faint markings. */
      rctx.strokeStyle = paint;
      rctx.globalAlpha = 0.45;
      rctx.lineWidth = 1.2;
      [edgeL, edgeR].forEach(function (x) {
        rctx.beginPath();
        rctx.moveTo(x, top);
        rctx.lineTo(x, bot);
        rctx.stroke();
      });
      rctx.setLineDash([7, 7]);
      rctx.beginPath();
      rctx.moveTo(ROAD_X, top);
      rctx.lineTo(ROAD_X, bot);
      rctx.stroke();
      rctx.setLineDash([]);
      rctx.globalAlpha = 1;
      stops.forEach(function (s) { crossing(carY(s.p), paint, 2.4, 0.45); });

      /* Behind it the map has been built: the same elements in their class
         colours, with the per-polyline vertices a predicted map is drawn with.
         The car is drawing the map as it goes, which is the whole subject of
         the paper. */
      rctx.save();
      rctx.beginPath();
      rctx.rect(0, 0, RW, Math.max(0, cy + 2));
      rctx.clip();

      rctx.strokeStyle = colour('boundary');
      rctx.fillStyle = colour('boundary');
      rctx.lineWidth = 1.6;
      [edgeL, edgeR].forEach(function (x) {
        rctx.beginPath();
        rctx.moveTo(x, top);
        rctx.lineTo(x, bot);
        rctx.stroke();
        for (var y = top; y <= bot; y += VERT) {
          rctx.beginPath();
          rctx.arc(x, y, 1.2, 0, Math.PI * 2);
          rctx.fill();
        }
      });

      rctx.strokeStyle = colour('divider');
      rctx.lineWidth = 1.3;
      rctx.setLineDash([7, 7]);
      rctx.beginPath();
      rctx.moveTo(ROAD_X, top);
      rctx.lineTo(ROAD_X, bot);
      rctx.stroke();
      rctx.setLineDash([]);

      stops.forEach(function (s) { crossing(carY(s.p), colour('crossing'), 2.6, 1); });
      rctx.restore();

      /* Junction arms out to the signs. */
      stops.forEach(function (s) {
        var y = carY(s.p);
        var passed = s.y <= probe;
        var current = s === here;
        var sy = s.signY === undefined ? y : s.signY;

        rctx.strokeStyle = current ? sign : 'rgba(' + ink + ', 0.2)';
        rctx.globalAlpha = current ? 0.75 : 1;
        rctx.lineWidth = 1;
        rctx.beginPath();
        rctx.moveTo(left - 2, y);
        rctx.lineTo(ELBOW, y);
        rctx.lineTo(ELBOW, sy);
        rctx.lineTo(RW - SIGN_RIGHT - 2, sy);
        rctx.stroke();
        rctx.globalAlpha = 1;

        if (s.el) s.el.classList.toggle('here', current);
        if (s.el) s.el.classList.toggle('passed', passed && !current);
      });

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

    /* Pedals.
     *
     * One rAF loop advancing a float scroll position, with scroll-behavior
     * forced to auto for the duration. A chain of smooth scrollTo calls
     * restarts itself every frame, which is what made the earlier play control
     * stutter. Speed eases toward whatever the pedals asked for, so pulling
     * away and stopping both have some weight to them.
     */
    var gas = document.getElementById('pedal-gas');
    var brake = document.getElementById('pedal-brake');
    var segs = Array.prototype.slice.call(rail.querySelectorAll('.speedo i'));

    var GEARS = [0, 130, 215, 340];   // px per second
    var gear = 0, speed = 0, target = 0;
    var driveRaf = 0, driveLast = 0, drivePos = 0, wasBehaviour = '';

    function showGear() {
      rail.classList.toggle('driving', gear > 0);
      segs.forEach(function (seg, i) { seg.classList.toggle('lit', i < gear); });
      if (gas) gas.setAttribute('aria-pressed', String(gear > 0));
    }

    function engage() {
      if (driveRaf) return;
      wasBehaviour = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      drivePos = window.scrollY;
      driveLast = 0;
      driveRaf = requestAnimationFrame(driveStep);
    }

    function disengage() {
      if (driveRaf) { cancelAnimationFrame(driveRaf); driveRaf = 0; }
      root.style.scrollBehavior = wasBehaviour || '';
      speed = 0;
    }

    function setGear(n) {
      gear = Math.max(0, Math.min(GEARS.length - 1, n));
      target = GEARS[gear];
      showGear();
      if (target > 0) engage();
    }

    function driveStep(now) {
      var dt = driveLast ? Math.min(0.05, (now - driveLast) / 1000) : 0;
      driveLast = now;

      // Braking has more authority than the accelerator, as it should.
      var k = target < speed ? 7.5 : 3.2;
      speed += (target - speed) * Math.min(1, dt * k);
      if (target === 0 && speed < 2) { disengage(); return; }

      drivePos += speed * dt;
      var max = maxScroll();
      if (drivePos >= max) {
        window.scrollTo(0, max);
        setGear(0);
        disengage();
        return;
      }
      window.scrollTo(0, drivePos);
      driveRaf = requestAnimationFrame(driveStep);
    }

    if (gas) {
      gas.addEventListener('click', function () {
        // Pressed at the end of the route, pull away from the top again.
        if (gear === 0 && window.scrollY >= maxScroll() - 2) window.scrollTo(0, 0);
        setGear(gear + 1);
      });
    }
    if (brake) {
      brake.addEventListener('click', function () { setGear(0); });
    }

    // Taking the wheel yourself lifts off completely, with no coasting.
    function lift(e) {
      if (!gear && !speed) return;
      if (gas && gas.contains(e.target)) return;
      if (brake && brake.contains(e.target)) return;
      gear = 0; target = 0;
      showGear();
      disengage();
    }
    ['wheel', 'touchstart', 'pointerdown'].forEach(function (type) {
      window.addEventListener(type, lift, { passive: true });
    });
    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') lift(e);
    });

    showGear();

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('load', function () { measure(); draw(); });
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resmap:theme', function () { readPalette(); draw(); });
  }
})();
