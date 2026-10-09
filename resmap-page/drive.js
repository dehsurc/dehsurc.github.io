/* ReSMap project page: the drive.
 *
 * The road runs across the top of the page. The car sits a quarter of the way
 * into it, nose right, because right is forward is down the page, and the
 * world slides past the car rather than the car sliding along a track. That
 * is what driving looks like from the driver's seat, and it is the only way
 * the speed reads as speed.
 *
 * Behind the car the road is drawn in the map class colours with the
 * per-polyline vertices a predicted map is drawn with; ahead of it the road is
 * bare surface with faint markings. The car is building the map as it drives,
 * which is the subject of the paper, and it is what makes a progress indicator
 * mean something.
 *
 * The scroll is not an easing curve. It is a longitudinal vehicle model: an
 * engine torque curve through a five-speed automatic and a final drive,
 * against aerodynamic drag and rolling resistance, integrated once per frame.
 * Metres are the unit throughout. PX_PER_M converts metres to document pixels
 * and ROAD_PX_PER_M to strip pixels, so the two scales can be tuned apart:
 * the document is long, and a road drawn at the document's own scale would
 * show one lane marking at a time.
 *
 * The strip is a rail down the left-hand edge. Everything here is still drawn
 * in strip coordinates -- x along the route, y across the carriageway -- and
 * the canvas transform turns that on its side once, at the top of resize().
 * So the road runs the way the page does, it costs a gutter rather than the
 * top of every screen, and the guide signs have room to sit beside it and be
 * read. A band across the top had to be hidden at the top of the page to keep
 * the first screen clear; a rail never covers anything, so it is simply
 * always there.
 *
 * There is no reverse. It existed so the map could be un-drawn, which nobody
 * did, and it cost a lever, a reverse ratio, a governor, a signed engine
 * braking term and three of the bugs this file has had. Going back up is what
 * the wheel is for: the model hands the scroll back the moment you touch it,
 * and the map goes back with the page.
 */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var road       = document.getElementById('road');
  var canvas     = document.getElementById('road-map');
  var signBox    = document.getElementById('road-signs');
  var cockpit    = document.getElementById('cockpit');

  if (!road || !canvas || !canvas.getContext || !cockpit) return;

  var ctx = canvas.getContext('2d');

  /* ---------------------------------------------------------------- *
   * Scale
   * ---------------------------------------------------------------- */

  /* Ordinary road speeds have to come out as comfortable reading speeds, and
     the ratio between them is this one number. At 18 px to the metre, 50 km/h
     scrolls at 250 px/s and 90 km/h at 450, so the whole gearbox gets used
     over a document this length instead of the car spending its life in
     second. */
  var PX_PER_M = 32;        // document pixels to the metre
  var FOLLOW_K = 4.5;         // how hard the car chases a page you scroll yourself
  var FOLLOW_SMOOTH = 5.5;   // and how smoothly that chase changes speed
  var FOLLOW_SNAP = 150;    // m of gap past which it stops chasing and relocates
  // The model predicts a map over a region of interest around the ego, not a
  // trail behind it. 60 x 30 m is the paper's main setting, so the prediction
  // reaches 30 m up the road, and thins out towards the end of that range the
  // way the evidence does.
  var PERCEPTION_M = 30;
  var ROAD_PX_PER_M = 6;    // strip pixels to the metre
  var CAR_X = 0.26;         // the car's fixed position across the strip
  // Below this the rail hides and the links return. Gutters on both sides take
  // 400px, and under 1100 that leaves the prose column too little.
  var MIN_VIEWPORT = 1100;

  /* ---------------------------------------------------------------- *
   * The car
   *
   * 1500 kg on a five-speed automatic, geared and powered so that flooring it
   * is worth doing and lifting off is worth noticing: 438 Nm at the peak of
   * the curve, 0-100 km/h in 5.0 s, 205 km/h flat out, and about 2.6 m/s^2 of
   * retardation the moment you come off it. Every figure the cockpit prints is
   * computed from the constants below, and tools/check-numbers.js re-runs the
   * model against the three quoted here, so retuning the car cannot leave
   * either a readout or this paragraph behind.
   * ---------------------------------------------------------------- */

  var MASS = 1500;                                  // kg
  var PEAK_NM = 420;                                // engine torque scale
  var WHEEL_R = 0.32;                               // m
  var FINAL = 3.9;                                  // final drive ratio
  var EFF = 0.85;                                   // driveline efficiency
  var GEARS = [3.55, 2.05, 1.35, 1.00, 0.78];       // five forward ratios
  var IDLE = 780, REDLINE = 6500;                   // rpm
  var DRAG_K = 0.90;                                // ½·rho·Cd·A
  var C_RR = 0.032;                                 // rolling resistance
  var GRAV = 9.81;
  var BRAKE_MAX = 9200;                             // N, about 6 m/s²
  var SHIFT_T = 0.16;                               // s of torque cut per shift
  var STOP_V = 0.15;                                // below this, call it stopped

  // Torque curve: pulls from just off idle, peaks around the middle of the
  // range, and tails off before the redline. A parabola is close enough.
  function torque(r) {
    var t = clamp((r - 700) / (REDLINE - 700), 0, 1);
    return PEAK_NM * (0.58 + 1.55 * t - 1.30 * t * t);
  }

  // Off throttle, the engine drags the car back through the same gearing. It
  // is deliberately strong: lifting off has to be something you can see happen
  // on the page, not a number quietly declining. With drag and rolling
  // resistance it puts about 2.6 m/s² into a lift at speed, where the earlier
  // numbers gave 1.5 and the car just sailed on.
  function engineBrake(r) { return 125 + r * 0.078; }

  function ratio() { return GEARS[g]; }
  function rpmAt(v) {
    var r = Math.abs(v) / (2 * Math.PI * WHEEL_R) * ratio() * FINAL * 60;
    return clamp(r, IDLE, REDLINE);
  }

  /* ---------------------------------------------------------------- *
   * State
   * ---------------------------------------------------------------- */

  var g = 0;                // index into GEARS
  var shifting = 0;         // seconds of torque cut left
  var speed = 0;            // m/s, signed: positive is down the page
  var pos = 0;              // metres from the top of the document
  /* The map is the road up to the car, and the road it can see ahead of it.
     Nothing to remember and nothing to clear: come forward and it is laid
     down, back up and it goes with you. */
  var outro = 0;                       // end-of-route flourish, 0 to 1
  var tick = 0;                        // seconds since the model started
  var arrived = false;                 // latched at the end of the route
  var rpm = IDLE;
  var throttle = 0, brake = 0;
  var holdGas = false, holdBrake = false;

  var raf = 0, last = 0, idleFor = 0;
  var ownScroll = -1, wasBehaviour = '', driving = false;
  var stops = [];
  var sparks = [];                     // the fireworks over the finish
  var W = 0, H = 0, dpr = 1;
  var shownNext = '';
  var stopCol = '#b53228';
  var FACE = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function maxScroll() {
    return Math.max(1, root.scrollHeight - window.innerHeight);
  }
  function maxM() { return maxScroll() / PX_PER_M; }

  /* ---------------------------------------------------------------- *
   * Palette
   * ---------------------------------------------------------------- */

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
  function neutral() {
    return root.dataset.theme === 'dark' ? '229, 231, 234' : '21, 23, 27';
  }

  var accent = '#0e4a84', pavement = '#f4f5f7', paint = '#b4b9c1', sign = '#16673c';

  function readPalette() {
    var cs = getComputedStyle(root);
    function v(name, fallback) {
      var got = (cs.getPropertyValue(name) || '').trim();
      return got || fallback;
    }
    accent = v('--accent', '#0e4a84');
    pavement = v('--road-surface', '#d6d9df');
    paint = v('--road-line', '#fbfcfd');
    sign = v('--sign', '#16673c');
  }

  /* A hex colour at an alpha, for the fade over the predicted stretch. */
  function rgba(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function box(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* ---------------------------------------------------------------- *
   * The route
   *
   * Each section is a junction, with an overhead guide sign at its true
   * position on the road and a tick on the route bar underneath. Names come
   * from the top bar's link list, which is why every section needs an entry
   * there.
   * ---------------------------------------------------------------- */

  function measure() {
    stops = Array.prototype.slice
      .call(document.querySelectorAll('main section[id]'))
      .map(function (s) {
        var link = document.querySelector('.topbar a[href="#' + s.id + '"]');
        var h2 = s.querySelector('h2');
        var top = s.getBoundingClientRect().top + window.scrollY;
        var numbered = s.querySelector('h2 .num');
        return {
          id: s.id,
          num: numbered ? numbered.textContent.trim() : '',
          m: top / PX_PER_M,
          name: link ? link.textContent
                     : (h2 ? h2.textContent.replace(/^\s*\d+\s*/, '') : s.id)
        };
      });

    /* The last section starts lower than the page can scroll, so its junction
       stood past the finish line, a stop the car could never reach. Any stop
       beyond the end is drawn just ahead of the finish, in order, so the route
       ends at the last section and then the line. */
    var limit = maxM() - 6;
    for (var i = stops.length - 1; i >= 0; i--) {
      stops[i].m = Math.min(stops[i].m, limit);
      limit = stops[i].m - 6;
    }

    signBox.textContent = '';

    stops.forEach(function (stop) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sign';
      /* The number comes off the section's own heading, not off this loop.
         The walkthrough leads the page without one, so counting the stops put
         every sign a number ahead of the section it names. */
      if (stop.num) {
        var num = document.createElement('b');
        num.textContent = stop.num;
        b.appendChild(num);
      }
      b.appendChild(document.createTextNode(stop.name));
      b.addEventListener('click', function () { jumpTo(stop); });
      signBox.appendChild(b);
      stop.el = b;
    });

    // One forced layout, here rather than per frame, so the posts can be drawn
    // to the plate they actually hold up.
    stops.forEach(function (stop) {
      stop.w = stop.el.offsetWidth || 90;
      stop.h = stop.el.offsetHeight || 22;
    });
  }

  /* A sign is navigation, not a drive control: coast to a stop and let the
     browser's own smooth scroll take it from there. */
  function jumpTo(stop) {
    holdGas = holdBrake = false;
    throttle = 0;
    speed = 0;
    stopLoop();
    var el = document.getElementById(stop.id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  /* ---------------------------------------------------------------- *
   * Sizing
   * ---------------------------------------------------------------- */

  function resize() {
    var on = window.innerWidth >= MIN_VIEWPORT && !reduceMotion.matches;
    road.hidden = !on;
    cockpit.hidden = !on;
    root.classList.toggle('has-road', on);
    if (!on) { stopLoop(); return; }

    dpr = Math.min(window.devicePixelRatio || 1, 2);

    /* The canvas is tall and narrow; the drawing is long and shallow. W and H
       stay the strip's own dimensions -- W along the route, H across the
       carriageway -- and the transform below does the turning.

         screen x = railW - strip y      the verge ends up on the right, next
         screen y = strip x              to the signs, and the route runs down

       It is a transpose rather than a rotation, which mirrors the across-axis.
       Nothing on the strip is handed: the road is symmetric about its centre
       line and the car's asymmetries are all along the route. There is no text
       on this canvas at all, which is what made turning it cheap. */
    var railW = road.clientWidth;
    var railH = canvas.parentNode.clientHeight || window.innerHeight || 600;
    W = railH;
    H = railW;
    canvas.width = Math.ceil(railW * dpr);
    canvas.height = Math.ceil(railH * dpr);
    canvas.style.width = railW + 'px';
    canvas.style.height = railH + 'px';
    ctx.setTransform(0, dpr, -dpr, 0, railW * dpr, 0);

    offerHint();

    readPalette();
    measure();
    syncFromScroll();
    draw();
  }

  function syncFromScroll() {
    pos = window.scrollY / PX_PER_M;
  }

  /* ---------------------------------------------------------------- *
   * Drawing
   * ---------------------------------------------------------------- */

  var SIGN_TOP = 0;          // the edge of the rail the signs stand against

  function sx(m) { return CAR_X * W + (m - pos) * ROAD_PX_PER_M; }

  // Top-down car, nose to the right. Headlamp wash ahead, brake lamps behind
  // when the pedal is down.
  function drawCar(x, y) {
    var len = 34, wide = 17;
    ctx.save();
    ctx.translate(x, y);

    /* A headlamp adds light, it does not tint the road. Painted with normal
       alpha over dark tarmac a warm wash blends to olive mud, so on the dark
       palette the beam is composited additively instead. */
    var dark = root.dataset.theme === 'dark';
    var beam = ctx.createLinearGradient(len * 0.5, 0, len * 3.0, 0);
    beam.addColorStop(0, 'rgba(255, 218, 145, ' + (dark ? '.34' : '.22') + ')');
    beam.addColorStop(1, 'rgba(255, 218, 145, 0)');
    ctx.save();
    if (dark) ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(len * 0.5, -wide * 0.34);
    ctx.lineTo(len * 3.0, -wide * 1.15);
    ctx.lineTo(len * 3.0, wide * 1.15);
    ctx.lineTo(len * 0.5, wide * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (brake > 0.02) {
      var glow = ctx.createLinearGradient(-len * 0.5, 0, -len * 1.9, 0);
      glow.addColorStop(0, 'rgba(226, 62, 46, ' + (0.20 + brake * 0.34).toFixed(3) + ')');
      glow.addColorStop(1, 'rgba(226, 62, 46, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-len * 1.9, -wide * 0.62, len * 1.4, wide * 1.24);
    }

    ctx.fillStyle = accent;
    box(ctx, -len / 2, -wide / 2, len, wide, 3.4);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,.62)';
    box(ctx, len * 0.04, -wide / 2 + 2.4, len * 0.28, wide - 4.8, 1.6);
    ctx.fill();

    // Headlamps.
    ctx.fillStyle = 'rgba(255,236,186,.95)';
    ctx.fillRect(len / 2 - 3, -wide / 2 + 1.8, 2, 3);
    ctx.fillRect(len / 2 - 3, wide / 2 - 4.8, 2, 3);

    // Tail and brake lamps.
    if (brake > 0.02) ctx.fillStyle = 'rgba(240, 78, 60, .98)';
    else ctx.fillStyle = 'rgba(190, 52, 42, .55)';
    ctx.fillRect(-len / 2 + 1, -wide / 2 + 1.8, 2, 3);
    ctx.fillRect(-len / 2 + 1, wide / 2 - 4.8, 2, 3);

    ctx.restore();
  }

  function draw() {
    if (road.hidden) return;

    var ink = neutral();
    /* Across the rail the carriageway sits centred, with the same margin on
       both sides: the sign posts stand in one and the distance ticks in the
       other. It used to be 20px against 9, and the rail looked lopsided. */
    var verge = Math.round(H * 0.19);
    var rTop = verge;
    var rBot = H - verge;
    var mid = (rTop + rBot) / 2;
    var edgeT = rTop + 2.5, edgeB = rBot - 2.5;
    var carX = CAR_X * W;
    var VERT = 2.4;            // metres between polyline vertices
    var DASH = 4 * ROAD_PX_PER_M, GAP = 8 * ROAD_PX_PER_M;
    var PERIOD = DASH + GAP;

    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'butt';

    // Carriageway.
    ctx.fillStyle = pavement;
    ctx.fillRect(0, rTop, W, rBot - rTop);

    // Distance posts every 50 m, so the scale is legible without a readout.
    ctx.strokeStyle = 'rgba(' + ink + ', 0.22)';
    ctx.lineWidth = 1;
    var first = Math.floor((pos - CAR_X * W / ROAD_PX_PER_M) / 50) * 50;
    for (var d = first; sx(d) < W + 20; d += 50) {
      var px = sx(d);
      if (px < -20) continue;
      ctx.beginPath();
      ctx.moveTo(px, rBot + 2);
      ctx.lineTo(px, rBot + 6);
      ctx.stroke();
    }

    /* Zebra stripes run with the traffic, so on a road drawn left to right
       they stack across the carriageway. */
    function crossing(x, style, width, alpha) {
      ctx.strokeStyle = style;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      for (var b = 0; b < 5; b++) {
        var y = rTop + 5 + b * ((rBot - rTop - 10) / 4);
        ctx.beginPath();
        ctx.moveTo(x - 7, y);
        ctx.lineTo(x + 7, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    /* Ahead of the car the road is unmapped: bare surface, plain markings. */
    ctx.strokeStyle = paint;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.4;
    [edgeT, edgeB].forEach(function (y) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    });
    ctx.setLineDash([DASH, GAP]);
    ctx.lineDashOffset = ((-sx(0)) % PERIOD + PERIOD) % PERIOD;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(W, mid);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    ctx.globalAlpha = 1;
    stops.forEach(function (s) { crossing(sx(s.m), paint, 2.6, 0.75); });

    /* The car sits in a lane rather than straddling the divider. It does not
       say which way the road runs -- the divider is dashed, which is a lane
       divider and not a centre line, so this is two lanes going the same way
       and either of them would do. It is simply that a car parked on the line
       between them reads as a token on a track rather than a vehicle. */
    var laneY = mid + (rBot - rTop) * 0.19;

    /* The map, in its class colours with the per-polyline vertices a predicted
       map is drawn with.

       Everything from the start of the route up to the car is laid down. Ahead
       of it the model is still predicting, over a region of interest around
       the ego, so the map runs on to the edge of the perception range and thins
       out across it: distant evidence is sparse and the prediction there is a
       guess. Back up and the map goes with you. */
    /* On the way out the car keeps mapping. The extent follows it off the
       right-hand side, so the road under the sign it leaves you with is drawn
       like the rest of the route rather than stopping where the car used to
       sit. */
    var offX = carX + outro * (W + 90 - carX);
    var extentM = pos + (offX - carX) / ROAD_PX_PER_M;
    var edgeX = offX;
    var predictX = sx(extentM + PERCEPTION_M);
    var clipR = Math.min(W, predictX);

    if (clipR > 0) {
      function shade(kind) {
        var hex = colour(kind);
        var a1 = clamp(edgeX / W, 0, 1);
        var a2 = clamp(predictX / W, 0, 1);
        var grd = ctx.createLinearGradient(0, 0, W, 0);
        grd.addColorStop(0, hex);
        grd.addColorStop(a1, hex);
        if (a2 > a1 + 0.0005) grd.addColorStop(a1 + (a2 - a1) * 0.5, rgba(hex, 0.5));
        grd.addColorStop(Math.max(a1, a2), rgba(hex, 0));
        grd.addColorStop(1, rgba(hex, 0));
        return grd;
      }

      // A crossing is one element, so it takes one confidence rather than a
      // gradient across itself.
      function conf(m) {
        if (m <= extentM) return 1;
        return clamp((extentM + PERCEPTION_M - m) / PERCEPTION_M, 0, 1);
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, clipR, H);
      ctx.clip();

      var bound = shade('boundary');
      ctx.strokeStyle = bound;
      ctx.fillStyle = bound;
      ctx.lineWidth = 1.8;
      [edgeT, edgeB].forEach(function (y) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        var m0 = Math.floor((pos - carX / ROAD_PX_PER_M) / VERT) * VERT;
        for (var m = m0; m <= extentM + PERCEPTION_M + VERT; m += VERT) {
          var vx = sx(m);
          if (vx < -4 || vx > clipR + 4) continue;
          ctx.beginPath();
          ctx.arc(vx, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      /* Canvas measures a dash pattern from the start of the path, so this
         line has to begin where the plain one under it begins or the two sets
         of dashes sit out of step. The clip decides how much of it shows. */
      ctx.strokeStyle = shade('divider');
      ctx.lineWidth = 1.4;
      ctx.setLineDash([DASH, GAP]);
      ctx.lineDashOffset = ((-sx(0)) % PERIOD + PERIOD) % PERIOD;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(W, mid);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      stops.forEach(function (s) {
        var a = conf(s.m);
        if (a > 0.02) crossing(sx(s.m), colour('crossing'), 2.6, a);
      });
      ctx.restore();
    }

    /* Both ends of the route, as a chequer laid across the carriageway. The
       name used to be painted on the tarmac here and then hung on a gantry
       over it; neither was any good on a road seen from above, so the route
       is marked and left to be a road. It goes on after the map layer, which
       was the first thing to cover the old marker up.

       A chequer is black and white in both themes. The neutral ink inverts
       with the theme, so the dark square is a fixed one. */
    function chequer(x) {
      if (x < -40 || x > W + 40) return;
      var sTop = rTop + 3, sBot = rBot - 3;
      var cell = (sBot - sTop) / 4;
      for (var r = 0; r < 4; r++) {
        for (var c = 0; c < 3; c++) {
          ctx.fillStyle = (r + c) % 2 ? paint : 'rgba(14, 16, 20, 0.72)';
          ctx.fillRect(x - 1.5 * cell + c * cell, sTop + r * cell,
                       cell + 0.5, cell + 0.5);
        }
      }
    }
    chequer(sx(0));
    /* And the same line at the far end, so the route has a finish you can see
       coming rather than a stop you discover by hitting it. */
    chequer(sx(maxM()));

    /* The chequered flag, waved over the line.
     *
     * A band of light running back up the rail was doing something no race
     * does. This is the thing everyone has seen at the end of a lap: the same
     * chequer as the start line, grown wide enough to be a flag, pinned at the
     * verge and rippling out across the road. The ripple runs on a clock
     * rather than off the flourish, so it keeps waving while you sit at the
     * end instead of freezing the moment the fade finishes. */
    if (outro > 0.01) {
      var fx = sx(maxM());
      var fTop = rTop + 3, fBot = rBot - 3;
      var fRows = 4, fCols = 7;
      var fCell = (fBot - fTop) / fRows;
      var lift = clamp(outro * 3, 0, 1);
      ctx.save();
      ctx.globalAlpha = lift;
      for (var fr = 0; fr < fRows; fr++) {
        /* Pinned at the verge edge and free at the far one, so the wave grows
           across the flag the way cloth does. */
        var grip = fr / (fRows - 1);
        var wave = Math.sin(tick * 7 - fr * 0.9) * fCell * 0.85 * grip * lift;
        for (var fc = 0; fc < fCols; fc++) {
          ctx.fillStyle = (fr + fc) % 2 ? paint : 'rgba(14, 16, 20, 0.82)';
          ctx.fillRect(fx - (fCols - 2.5) * fCell + fc * fCell + wave,
                       fTop + fr * fCell, fCell + 0.5, fCell + 0.5);
        }
      }
      ctx.restore();
    }

    drawCar(offX, laneY);

    /* Fireworks. Short streaks along each spark's own heading, so they read
       as a burst going off rather than as confetti sitting on the road. */
    if (sparks.length) {
      ctx.save();
      ctx.lineCap = 'round';
      sparks.forEach(function (p) {
        if (p.wait > 0) return;
        var k = p.life / p.max;
        var x = sx(p.m) + p.dx, y = mid + p.dy;
        ctx.globalAlpha = (1 - k) * (1 - k);
        ctx.strokeStyle = p.c;
        ctx.lineWidth = p.w;
        ctx.beginPath();
        ctx.moveTo(x - p.vx * 0.045, y - p.vy * 0.045);
        ctx.lineTo(x, y);
        ctx.stroke();
      });
      ctx.restore();
    }

    /* End of the route: the car carries on past the flag, and the road says
       thank you.
     *
     * Painted on the tarmac, the way it was when the road ran across the top.
     * A panel beside the rail was fussier and did less: it popped, it broke
     * over lines, and the link it carried was pointing at the section the
     * reader had just scrolled to anyway.
     *
     * The canvas transform is a rotation rather than a reflection, so text
     * drawn here in strip coordinates comes out reading down the rail, which
     * is the direction the rail is read in. */
    if (outro > 0.02) {
      var fade = clamp((outro - 0.35) / 0.4, 0, 1);
      if (fade > 0) {
        var label = 'THANK YOU FOR VISITING ReSMap';
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 13px ' + FACE;

        /* Fresh tarmac behind the words. The divider runs straight through
           them otherwise, and a broken line through a word is worse than no
           line at all. */
        var tw = ctx.measureText(label).width;
        ctx.fillStyle = pavement;
        box(ctx, W / 2 - tw / 2 - 14, mid - 11, tw + 28, 22, 4);
        ctx.fill();

        ctx.fillStyle = 'rgba(' + ink + ', 0.82)';
        ctx.fillText(label, W / 2, mid);
        ctx.restore();
      }
    }

    /* Signs sit at their true position and slide in from the right, the way
       they do on the road. Off-strip ones are not drawn at all. */
    stops.forEach(function (s, i) {
      if (!s.el) return;
      var x = sx(s.m);
      if (x < -170 || x > W + 170) { s.el.hidden = true; return; }
      s.el.hidden = false;
      s.el.style.top = Math.round(x) + 'px';
      s.el.classList.toggle('passed', s.m <= pos);
      var isHere = s === current();
      s.el.classList.toggle('here', isHere);

      /* Two posts from the verge out to the plate, with a footing where they
         meet the ground. A sign hanging in the air is a label; a sign on legs
         is a sign. The plate sits outside the rail now, so the posts run the
         whole width of the verge. */
      var footY = rTop + 3;
      var plateY = SIGN_TOP;
      /* Spaced off the plate's height, because the posts now stand apart
         along the route and the plate's long side runs across it. */
      var leg = Math.max(6, Math.min(16, (s.h || 22) * 0.36));
      ctx.strokeStyle = isHere ? sign : 'rgba(' + ink + ', 0.34)';
      ctx.lineCap = 'butt';
      [-leg, leg].forEach(function (dx) {
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x + dx, plateY);
        ctx.lineTo(x + dx, footY);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + dx - 3.5, footY);
        ctx.lineTo(x + dx + 3.5, footY);
        ctx.stroke();
      });
    });

  }

  /* A section counts as current once the car has driven into it. */
  function current() {
    if (!stops.length) return null;
    /* Except at the bottom of the document, where the last section's top can
       never reach the top of the viewport because the scroll runs out first.
       Sat at the end of the route you are in the last section, whatever the
       arithmetic says. */
    if (pos >= maxM() - 0.5) return stops[stops.length - 1];
    var here = stops[0];
    stops.forEach(function (s) { if (s.m <= pos + 0.5) here = s; });
    return here;
  }

  /* ---------------------------------------------------------------- *
   * The model
   * ---------------------------------------------------------------- */

  /* Everything that moves on the strip without being the car.
   *
   * These used to be advanced in step(), which only runs while the pedals own
   * the page, so a reader scrolling with the wheel -- nearly every reader --
   * arrived at the finish to a flag that did not wave. The loop calls this on
   * every frame whoever is driving. */
  function ambient(dt) {
    tick += dt;

    for (var i = sparks.length - 1; i >= 0; i--) {
      var p = sparks[i];
      if (p.wait > 0) { p.wait -= dt; continue; }
      p.life += dt;
      if (p.life >= p.max) { sparks.splice(i, 1); continue; }
      var drag = Math.max(0, 1 - 1.7 * dt);
      p.vx *= drag;
      p.vy *= drag;
      p.dx += p.vx * dt;
      p.dy += p.vy * dt;
    }
  }

  /* Three shells over the finish, a beat apart and a few metres either side
     of the line. Positions are kept in route metres plus an offset, so the
     burst stays where it went off on the road rather than on the screen. */
  function burst() {
    var hues = [accent, stopCol, colour('boundary'), colour('divider'), paint];
    [0, 0.3, 0.6].forEach(function (delay, k) {
      var at = maxM() + (k - 1) * 8;
      for (var i = 0; i < 26; i++) {
        var a = Math.random() * Math.PI * 2;
        var v = 50 + Math.random() * 80;
        sparks.push({
          m: at, dx: 0, dy: 0,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v * 0.6,
          life: 0, max: 1.0 + Math.random() * 0.9, wait: delay,
          c: hues[(i + k) % hues.length],
          w: 1.3 + Math.random() * 1.1
        });
      }
    });
  }

  function step(dt) {
    // Pedal travel. Taking up over about half a second rather than snapping
    // to the floor is what makes a dab different from holding it down, which
    // is the whole of the control you have with a mouse.
    throttle += ((holdGas ? 1 : 0) - throttle) * Math.min(1, dt * (holdGas ? 8 : 15));
    brake += ((holdBrake ? 1 : 0) - brake) * Math.min(1, dt * (holdBrake ? 7 : 18));

    var v = speed;
    var absV = Math.abs(v);

    rpm = rpmAt(v);

    // Gearbox. The upshift point rises with throttle, which is what makes a
    // gentle pull-away shift early and a floored one hold each gear out.
    if (shifting > 0) shifting -= dt;
    else {
      var up = 2900 + throttle * 3200;
      var dn = 1950 + throttle * 700;
      if (g < GEARS.length - 1 && rpm > up) { g++; shifting = SHIFT_T; }
      else if (g > 0 && rpm < dn) { g--; shifting = SHIFT_T; }
    }

    var drive = 0;
    if (shifting <= 0) {
      var gearing = ratio() * FINAL * EFF / WHEEL_R;
      drive = throttle * torque(rpm) * gearing;
      /* Engine braking opposes the way the wheels are turning, and a car that
         is not moving has nothing for it to oppose. Signed by the gear instead,
         it pushed the car backwards off the end of the route the moment the
         throttle came off: held against the end, speed is zero, and the braking
         term is the only force left. */
      if (absV > 0.05) {
        drive -= Math.sign(v) * (1 - throttle) * engineBrake(rpm) * gearing;
      }
    }

    var resist = -Math.sign(v) * (DRAG_K * v * v + C_RR * MASS * GRAV);
    if (absV < 0.05) resist = 0;

    var braking = -Math.sign(v) * brake * BRAKE_MAX;
    if (absV < 0.05) braking = 0;

    var a = (drive + resist + braking) / MASS;
    speed = v + a * dt;

    // Do not let the brake or the drag pull the car through zero into a
    // creep the other way.
    if (v !== 0 && Math.sign(speed) !== Math.sign(v) && throttle < 0.02) speed = 0;
    if (Math.abs(speed) < STOP_V && throttle < 0.02) speed = 0;

    pos += speed * dt;

    // The ends of the document are the ends of the road.
    var top = maxM();
    if (pos >= top) { pos = top; speed = 0; }
    if (pos <= 0) { pos = 0; speed = 0; }

    rpm = rpmAt(speed);
  }

  /* ---------------------------------------------------------------- *
   * Readouts
   * ---------------------------------------------------------------- */

  var gaugeEl = document.getElementById('gauge');
  var gctx = gaugeEl && gaugeEl.getContext ? gaugeEl.getContext('2d') : null;
  var tripEl = document.getElementById('trip');
  var nextEl = document.getElementById('nextup');
  var gasBtnEl = document.getElementById('pedal-gas');
  var brakeBtnEl = document.getElementById('pedal-brake');

  /* The end of the scale is the fastest the drivetrain can go - top gear at
     the redline - rounded up to the next labelled tick, so the needle cannot
     peg and read low. Chosen by hand it was 200, and the car does 250. */
  var TICK = 40;                   // km/h between numbered ticks
  var V_MAX = Math.ceil(REDLINE / 60 / (GEARS[GEARS.length - 1] * FINAL) *
                        (2 * Math.PI * WHEEL_R) * 3.6 / TICK) * TICK;
  var SWEEP = Math.PI * 1.5;       // 270 degrees of it
  var START = Math.PI * 0.75;      // beginning at the lower left

  // A needle has mass. It is driven as a spring toward the reading rather than
  // snapped to it, which is what makes acceleration something you watch happen
  // rather than a number that changes.
  var needle = 0, needleV = 0;

  function swingNeedle(target, dt) {
    var k = 190, c = 22;           // stiffness and damping, lightly underdamped
    needleV += ((target - needle) * k - needleV * c) * dt;
    needle += needleV * dt;
    if (Math.abs(target - needle) < 0.0004 && Math.abs(needleV) < 0.004) {
      needle = target;
      needleV = 0;
    }
  }

  function gauge() {
    if (!gctx) return;
    var S = 240, C = S / 2;
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.clearRect(0, 0, S, S);

    var ink = neutral();
    var faceR = 108;

    // Face.
    gctx.fillStyle = pavement;
    gctx.beginPath();
    gctx.arc(C, C, faceR, 0, Math.PI * 2);
    gctx.fill();
    gctx.strokeStyle = 'rgba(' + ink + ', 0.22)';
    gctx.lineWidth = 2;
    gctx.stroke();

    // Speed scale.
    for (var v = 0; v <= V_MAX; v += 10) {
      var a = START + (v / V_MAX) * SWEEP;
      var major = v % TICK === 0;
      var r1 = faceR - 10, r0 = r1 - (major ? 15 : 8);
      gctx.strokeStyle = 'rgba(' + ink + ', ' + (major ? 0.72 : 0.34) + ')';
      gctx.lineWidth = major ? 3 : 1.8;
      gctx.beginPath();
      gctx.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0);
      gctx.lineTo(C + Math.cos(a) * r1, C + Math.sin(a) * r1);
      gctx.stroke();
      if (major) {
        var rt = r0 - 15;
        gctx.fillStyle = 'rgba(' + ink + ', 0.62)';
        gctx.font = '600 19px ' + FACE;
        gctx.textAlign = 'center';
        gctx.textBaseline = 'middle';
        gctx.fillText(String(v), C + Math.cos(a) * rt, C + Math.sin(a) * rt);
      }
    }

    // Rev counter, an arc inside the scale with the last of it in the red.
    var rFrac = clamp((rpm - IDLE) / (REDLINE - IDLE), 0, 1);
    var rR = faceR - 40;
    gctx.lineCap = 'butt';
    gctx.strokeStyle = 'rgba(' + ink + ', 0.13)';
    gctx.lineWidth = 7;
    gctx.beginPath();
    gctx.arc(C, C, rR, START, START + SWEEP);
    gctx.stroke();
    if (rFrac > 0.002) {
      gctx.strokeStyle = rpm > REDLINE * 0.88 ? stopCol : accent;
      gctx.beginPath();
      gctx.arc(C, C, rR, START, START + SWEEP * rFrac);
      gctx.stroke();
    }

    // Gear, where the odometer window is on a real one.
    gctx.fillStyle = 'rgba(' + ink + ', 0.75)';
    gctx.font = '700 22px ' + FACE;
    gctx.textAlign = 'center';
    gctx.textBaseline = 'middle';
    gctx.fillText('D' + (g + 1), C, C + 40);

    gctx.fillStyle = 'rgba(' + ink + ', 0.42)';
    gctx.font = '600 13px ' + FACE;
    gctx.fillText('km/h', C, C + 66);

    // Needle.
    var na = START + clamp(needle, 0, 1) * SWEEP;
    var tip = faceR - 16, tail = 22;
    gctx.strokeStyle = stopCol;
    gctx.lineWidth = 4;
    gctx.lineCap = 'round';
    gctx.beginPath();
    gctx.moveTo(C - Math.cos(na) * tail, C - Math.sin(na) * tail);
    gctx.lineTo(C + Math.cos(na) * tip, C + Math.sin(na) * tip);
    gctx.stroke();
    gctx.fillStyle = 'rgba(' + ink + ', 0.85)';
    gctx.beginPath();
    gctx.arc(C, C, 9, 0, Math.PI * 2);
    gctx.fill();
  }

  function metres(m) {
    if (m < 15) return 'arriving';
    return m > 950 ? (m / 1000).toFixed(1) + ' km' : Math.round(m / 10) * 10 + ' m';
  }

  function hud(dt) {
    swingNeedle(clamp(Math.abs(speed) * 3.6 / V_MAX, 0, 1), dt || 0.016);
    gauge();

    // The pedals carry their own travel, so the glyph goes down under your
    // foot and stays down while you hold it.
    if (gasBtnEl) gasBtnEl.style.setProperty('--travel', throttle.toFixed(3));
    if (brakeBtnEl) brakeBtnEl.style.setProperty('--travel', brake.toFixed(3));

    /* How far down the route, as a percentage. It used to read kilometres,
       which were made up: at 32 px to the metre a whole page is about 600 m,
       so "0.62 / 0.62 km" was a number that could not be checked against
       anything. A percentage of the document is true. */
    if (tripEl) {
      tripEl.textContent = Math.round(clamp(pos / maxM(), 0, 1) * 100) + '%';
    }

    // Next junction, the way a nav system calls it.
    var next = null;
    for (var i = 0; i < stops.length; i++) {
      if (stops[i].m > pos + 0.5) { next = stops[i]; break; }
    }
    var d = next ? metres(next.m - pos) : '';
    /* The number comes off the section's own heading, the same place the signs
       take theirs. Counting the array put every junction one ahead, and gave
       the unnumbered walkthrough a section number it does not have. */
    var text = next ? (next.num ? '§' + next.num + ' ' : '') + next.name +
                      (d === 'arriving' ? ' · arriving' : ' · ' + d)
                    : 'end of route';
    if (nextEl && text !== shownNext) {
      shownNext = text;
      nextEl.textContent = text;
    }

    cockpit.classList.toggle('moving', Math.abs(speed) > 0.3);
  }

  /* ---------------------------------------------------------------- *
   * The loop
   *
   * One rAF advancing a float position in metres. The model owns the scroll
   * position only while someone is actually driving it; a wheel or a touch of
   * your own hands it straight back, and from then on the page scrolls the way
   * it always did while the road and the speedometer simply report what it is
   * doing. Pressing a pedal takes the wheel again, from whatever speed the
   * page was already travelling at — a flicked wheel is not a launch control,
   * so what is adopted is clamped to something a car could be doing.
   *
   * While the model is driving, scroll-behavior is forced to auto: a chain of
   * smooth scrollTo calls restarts itself every frame and stutters.
   * ---------------------------------------------------------------- */

  var owned = false;      // does the model own the scroll position?
  var observed = 0;       // m/s read off the page's own scrolling

  function grabScroll() {
    if (driving) return;
    wasBehaviour = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    driving = true;
  }
  function freeScroll() {
    if (!driving) return;
    root.style.scrollBehavior = wasBehaviour || '';
    driving = false;
  }

  function takeWheel() {
    if (!owned) {
      owned = true;
      pos = window.scrollY / PX_PER_M;
      /* Pick the page's own motion up, but only the half of it the car can
         do anything with. Scrolling back up the page and then pressing the
         accelerator used to hand the car that momentum whole, so it pulled
         away backwards and the page climbed until the engine won. */
      var v = clamp(observed, -45, 45);
      speed = Math.max(0, v);
      grabScroll();
    }
    startLoop();
  }

  function handBack() {
    owned = false;
    holdGas = holdBrake = false;
    throttle = 0;
    brake = 0;
    freeScroll();
  }

  function loop(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;

    /* Hold still through a theme wipe. The browser is compositing two
       snapshots of the whole page across those frames, and two canvases
       repainting underneath it is the last thing it needs. */
    if (root.dataset.wipe) {
      raf = requestAnimationFrame(loop);
      return;
    }

    var sy = window.scrollY;

    // Anything that moved the page other than us wins, and lifts us off.
    if (owned && ownScroll >= 0 && Math.abs(sy - ownScroll) > 2) handBack();

    if (owned) {
      step(dt);
      window.scrollTo(0, pos * PX_PER_M);
      ownScroll = window.scrollY;
      observed = speed;
    } else {
      /* Reading the page's own motion rather than driving it.
       *
       * A wheel moves the page in notches: differentiating that staircase
       * gives a speed that spikes and dies every notch, and a road that jumps
       * with it. So the car does not sit exactly where the page is. It chases
       * it, and its speed is the chase's own rate, which is continuous by
       * construction. The lag is a hundred milliseconds and reads as the
       * weight of a car rather than as lag. */
      /* Clamped to the road that exists. Elastic overscroll runs scrollY past
         both ends of the document and settles it back, and chasing that walks
         the road on past the end and brings it back under a car that never
         moved -- the same bounce, arriving from the platform instead of from
         the follower. */
      var m = clamp(sy / PX_PER_M, 0, maxM());
      // An anchor jump or a scrollbar thrown across the document is not
      // driving. Past a point, the car is simply somewhere else now.
      if (Math.abs(m - pos) > FOLLOW_SNAP) {
        pos = m;
        observed = 0;
      } else {
        /* The chase stiffens with the gap. A fixed gain and a speed clamp made
           a fast scroll outrun the car until the gap tripped the snap, over
           and over, which is exactly the stutter that was in it. */
        /* Soft at reading pace, so the needle does not jitter on every wheel
           notch, and stiffening hard beyond that, so a flick cannot outrun the
           car until the gap trips the snap. That race was the stutter. */
        var gap = Math.abs(m - pos);
        var want = (m - pos) * (FOLLOW_K + Math.max(0, gap - 8) * 1.4);
        observed += (want - observed) * Math.min(1, dt * FOLLOW_SMOOTH);
        if (gap < 0.03 && Math.abs(observed) < 0.15) {
          pos = m;
          observed = 0;
        } else {
          /* The chase may lag. It may not reverse.
           *
           * A displacement force through a lag, integrated, is a
           * mass-spring-damper, and this one is underdamped: the ratio is
           * sqrt(FOLLOW_SMOOTH / FOLLOW_K) / 2, which is 0.55, and it falls
           * further as the chase stiffens with the gap. So a flick sailed
           * 12% past where you scrolled to at reading pace and 67% past it
           * at speed, and then came back to meet you. Inertia carrying the
           * car on is the point; a car that reverses into you is a spring.
           *
           * Arresting it on the target is what removes the return, and it
           * costs nothing else: the gap is what drives the chase, so while
           * there is one the dynamics here are untouched, and this only
           * decides what happens at the instant the gap would go negative.
           * Rise time and the lag you feel while actually scrolling come
           * out identical either way. */
          var was = m - pos;
          pos += observed * dt;
          if (was > 0) pos = Math.min(pos, m);
          else if (was < 0) pos = Math.max(pos, m);
          else pos = m;
        }
      }
      speed = observed;
      throttle = 0;
      brake = 0;
      rpm = rpmAt(speed);
      ownScroll = sy;
    }

    /* Arrival latches. Browsers report a fractional scrollY at the bottom of
       a page, so an exact test flickers, and letting go of the accelerator
       must not put the flourish away. */
    var wasArrived = arrived;
    if (pos >= maxM() - 1.5) arrived = true;
    else if (pos < maxM() - 6) arrived = false;
    var atEnd = arrived;
    if (atEnd && !wasArrived) burst();
    outro = clamp(outro + (atEnd ? dt / 1.2 : -dt / 0.25), 0, 1);

    ambient(dt);
    draw();
    hud(dt);

    /* Awake while anything on the strip is still moving: a spark in the air,
       and the flag, which waves for as long as you sit at the finish. */
    var busy = Math.abs(needleV) > 0.008 || sparks.length > 0 ||
      outro > 0 || (owned
      ? (Math.abs(speed) > 0.02 || holdGas || holdBrake || throttle > 0.02 || brake > 0.02)
      : Math.abs(observed) > 0.05);
    idleFor = busy ? 0 : idleFor + dt;
    if (idleFor > 0.5) { stopLoop(); return; }

    raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (raf || road.hidden) return;
    last = 0;
    idleFor = 0;
    ownScroll = window.scrollY;
    raf = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    // Coming to rest gives the scroll back, so the next anchor jump is smooth
    // and the next pedal press starts from a known state.
    owned = false;
    freeScroll();
    ownScroll = -1;
    // Settle exactly on the page, so the next frame does not start from a lag.
    pos = window.scrollY / PX_PER_M;
    speed = 0;
    observed = 0;
    draw();
    hud();
  }

  /* ---------------------------------------------------------------- *
   * Controls
   * ---------------------------------------------------------------- */

  var gasBtn = document.getElementById('pedal-gas');
  var brakeBtn = document.getElementById('pedal-brake');
  var topBtn = document.getElementById('to-top');
  if (topBtn) {
    topBtn.addEventListener('click', function () {
      // Navigation, not a drive control: come off the pedals and let the
      // browser's own smooth scroll take it from there. Asking for the top is
      // also done with the route, so the sign goes now rather than fading out
      // somewhere on the way up.
      holdGas = holdBrake = false;
      throttle = 0;
      brake = 0;
      speed = 0;
      arrived = false;
      outro = 0;
      sparks.length = 0;
      stopLoop();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---- the hint, once ----
   *
   * A cluster in the corner is not self-evidently a control, and the page it
   * drives looks exactly the same to anyone who never touches it. So it says
   * so: shown the first time the road comes into frame, taken away the moment
   * a pedal moves, and never offered again on this browser. */
  var hintEl = document.getElementById('drive-hint');
  var hintTimer = 0, hintDone = false;
  /* Remembered only once a pedal has actually been pressed. It used to be
     remembered when its timer ran out as well, which meant twenty-two seconds
     of not looking at the corner of the screen retired it for good, and a
     hard reload does not clear local storage. The key moved on when that was
     fixed, so nobody is left holding the old verdict. */
  var HINT_KEY = 'resmap-drove-2';

  function hintOffered() {
    hintDone = true;
    try { localStorage.setItem(HINT_KEY, '1'); } catch (err) { /* private mode */ }
  }
  function dropHint(learned) {
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = 0; }
    if (hintEl) hintEl.hidden = true;
    cockpit.classList.remove('hinting');
    cockpit.classList.remove('nudge');
    if (learned && !hintDone) hintOffered();
  }
  function offerHint() {
    // resize() offers it, and resize() runs again on every window change.
    if (hintDone || !hintEl || hintEl.hidden === false) return;
    /* A blocked or empty store is the same as a first visit as far as this is
       concerned, so the read only ever decides whether to stay quiet. */
    var known = false;
    try { known = !!localStorage.getItem(HINT_KEY); } catch (err) { known = false; }
    if (known) { hintDone = true; return; }
    hintEl.hidden = false;
    cockpit.classList.add('hinting');
    /* Folded, the hint inside cannot be seen, so the folded button itself
       glows twice instead -- only for someone who has never opened or closed
       the cockpit, which is a first visit in all but name. */
    var pref = null;
    try { pref = localStorage.getItem('resmap-cockpit'); } catch (err) { /* private mode */ }
    if (!pref) cockpit.classList.add('nudge');
    /* Long enough to be read by someone who is reading the page rather than
       watching the corner of it. It goes the instant a pedal moves. */
    hintTimer = setTimeout(function () { dropHint(false); }, 22000);
  }

  function pressGas() {
    dropHint(true);
    takeWheel();
    holdGas = true;
  }
  function pressBrake() { dropHint(true); takeWheel(); holdBrake = true; }
  function release() { holdGas = holdBrake = false; }

  function pedal(btn, press) {
    if (!btn) return;
    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      // Press first. Capturing the pointer is a convenience — it keeps the
      // release if you slide off the button — and it throws for a pointer the
      // element never saw, which must not cost us the pedal.
      press();
      try {
        if (btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
      } catch (err) { /* nothing to capture */ }
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    // A pedal you can only reach with a mouse is not a control.
    btn.addEventListener('keydown', function (e) {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      press();
    });
    btn.addEventListener('keyup', function (e) {
      if (e.key === ' ' || e.key === 'Enter') release();
    });
    btn.addEventListener('blur', release);
  }
  pedal(gasBtn, pressGas);
  pedal(brakeBtn, pressBrake);
  window.addEventListener('pointerup', release);
  window.addEventListener('blur', release);

  /* Keyboard: W and S are the pedals. The arrow keys are left alone, because
     they are how the page scrolls. */
  function editable(el) {
    return !el || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable;
  }
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || road.hidden) return;
    if (root.dataset.lightbox) return;          // a figure is open over the page
    if (editable(document.activeElement)) return;
    var k = e.key.toLowerCase();
    if (k === 'w') { e.preventDefault(); clearTimeout(liftTimer); pressGas(); }
    else if (k === 's') { e.preventDefault(); clearTimeout(liftTimer); pressBrake(); }
  });
  /* Auto-repeat sends a keyup between every keydown on X11, which switched
     the pedal off as fast as it went on. A held key is one whose release has
     not survived a couple of frames. */
  var liftTimer = 0;
  document.addEventListener('keyup', function (e) {
    var k = e.key.toLowerCase();
    if (k !== 'w' && k !== 's') return;
    clearTimeout(liftTimer);
    liftTimer = setTimeout(release, 60);
  });


  // Taking the wheel yourself lifts off completely, and the model picks the
  // page's own motion back up on the next frame.
  ['wheel', 'touchstart'].forEach(function (type) {
    window.addEventListener(type, function () {
      handBack();
      startLoop();
    }, { passive: true });
  });

  /* ---------------------------------------------------------------- *
   * Wiring
   * ---------------------------------------------------------------- */

  /* The cockpit starts folded (class="shut" in the markup, so it never flashes
     open first): most readers are here to read, and the car on the rail is
     there whether or not anyone drives it. Whichever way a reader leaves it
     is how it opens for them next time. */
  var COCKPIT_KEY = 'resmap-cockpit';
  var collapse = document.getElementById('cockpit-toggle');
  function fold(open) {
    cockpit.classList.toggle('shut', !open);
    if (collapse) {
      collapse.setAttribute('aria-expanded', String(open));
      collapse.setAttribute('aria-label', open ? 'Collapse the cockpit' : 'Open the cockpit');
    }
  }
  var cockpitPref = null;
  try { cockpitPref = localStorage.getItem(COCKPIT_KEY); } catch (err) { /* private mode */ }
  if (cockpitPref === 'open') fold(true);
  if (collapse) {
    collapse.addEventListener('click', function () {
      var open = cockpit.classList.contains('shut');
      fold(open);
      cockpitPref = open ? 'open' : 'shut';
      try { localStorage.setItem(COCKPIT_KEY, cockpitPref); } catch (err) { /* private mode */ }
    });
  }

  /* Scrolling starts the loop rather than drawing a single frame of it. The
     follower, the needle and the arrival all live in there, and a lone frame
     leaves them frozen: that is why the sign at the end used to hang about
     after you had scrolled away from it, with the car still off the edge. The
     loop idles itself out half a second after the page stops moving. */
  window.addEventListener('scroll', function () {
    if (!raf) startLoop();
  }, { passive: true });

  window.addEventListener('resize', resize);
  window.addEventListener('load', function () { resize(); });
  /* Both canvases, not just the strip. The gauge is only drawn from hud(), which
     only runs while something is moving, so after a theme switch it kept the
     old face until the car next moved -- and the tick marks, which read the
     theme's ink fresh, could land on a face of the same colour. The event
     fires inside the view transition's update, so both are right in the
     snapshot. */
  window.addEventListener('resmap:theme', function () { readPalette(); draw(); gauge(); });
  if (reduceMotion.addEventListener) {
    reduceMotion.addEventListener('change', resize);
  }

  resize();
  hud();
})();
