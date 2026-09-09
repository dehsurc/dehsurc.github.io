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
 * Reverse is a real gear. It is how you go back up.
 */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var road       = document.getElementById('road');
  var canvas     = document.getElementById('road-map');
  var signBox    = document.getElementById('road-signs');
  var routeBar   = document.getElementById('route');
  var routeTicks = document.getElementById('route-ticks');
  var routeDone  = document.getElementById('route-done');
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
  var PX_PER_M = 18;        // document pixels to the metre
  var FOLLOW_K = 4.5;         // how hard the car chases a page you scroll yourself
  var FOLLOW_SMOOTH = 5.5;   // and how smoothly that chase changes speed
  var FOLLOW_SNAP = 60;     // m of gap past which it stops chasing and relocates
  // The model predicts a map over a region of interest around the ego, not a
  // trail behind it. 60 x 30 m is the paper's main setting, so the prediction
  // reaches 30 m up the road, and thins out towards the end of that range the
  // way the evidence does.
  var PERCEPTION_M = 30;
  var ROAD_PX_PER_M = 9;    // strip pixels to the metre
  var CAR_X = 0.26;         // the car's fixed position across the strip
  var MIN_VIEWPORT = 900;   // below this the road hides and the links return

  /* ---------------------------------------------------------------- *
   * The car
   *
   * A mid-size saloon: 1500 kg, a 210 Nm engine, a five-speed automatic.
   * The numbers are ordinary ones on purpose, so the way it pulls away, runs
   * out of first, and settles into a cruise is the way a car does.
   * ---------------------------------------------------------------- */

  var MASS = 1500;                                  // kg
  var WHEEL_R = 0.32;                               // m
  var FINAL = 3.9;                                  // final drive ratio
  var EFF = 0.85;                                   // driveline efficiency
  var GEARS = [3.55, 2.05, 1.35, 1.00, 0.78];       // five forward ratios
  var REV_RATIO = 3.30;
  var IDLE = 780, REDLINE = 6500;                   // rpm
  var DRAG_K = 0.42;                                // ½·rho·Cd·A
  var C_RR = 0.013;                                 // rolling resistance
  var GRAV = 9.81;
  var BRAKE_MAX = 9200;                             // N, about 6 m/s²
  var SHIFT_T = 0.16;                               // s of torque cut per shift
  var REV_LIMIT = 5.0;                              // m/s in reverse, ~18 km/h
  var STOP_V = 0.15;                                // below this, call it stopped

  // Torque curve: pulls from just off idle, peaks around the middle of the
  // range, and tails off before the redline. A parabola is close enough.
  function torque(r) {
    var t = clamp((r - 700) / (REDLINE - 700), 0, 1);
    return 210 * (0.58 + 1.55 * t - 1.30 * t * t);
  }

  // Off throttle, the engine drags the car back through the same gearing.
  function engineBrake(r) { return 22 + r * 0.012; }

  function ratio() {
    return gear === 'R' ? REV_RATIO : GEARS[g];
  }
  function rpmAt(v) {
    var r = Math.abs(v) / (2 * Math.PI * WHEEL_R) * ratio() * FINAL * 60;
    return clamp(r, IDLE, REDLINE);
  }

  /* ---------------------------------------------------------------- *
   * State
   * ---------------------------------------------------------------- */

  // Two gears, because there are only two things you can do to a page: go
  // down it or go back up. Park and Neutral had nothing to select between.
  var gear = 'D';           // D or R
  var g = 0;                // index into GEARS while in D
  var shifting = 0;         // seconds of torque cut left
  var speed = 0;            // m/s, signed: positive is down the page
  var pos = 0;              // metres from the top of the document
  /* The stretch the car has actually driven, and so built a map of. Only the
     model advances it: scrolling the page by hand is not driving, and a road
     that arrives already mapped has nothing left to show you. Leave the
     stretch and it starts again from wherever you are. */
  var mapFrom = 0, mappedTo = 0;
  var rpm = IDLE;
  var throttle = 0, brake = 0;
  var holdGas = false, holdBrake = false;

  var raf = 0, last = 0, idleFor = 0;
  var ownScroll = -1, wasBehaviour = '', driving = false;
  var stops = [], routeM = 1, dragging = false;
  var W = 0, H = 0, dpr = 1;
  var shownKmh = -1, shownGear = '', shownNext = '';

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
    routeM = maxM();

    stops = Array.prototype.slice
      .call(document.querySelectorAll('main section[id]'))
      .map(function (s) {
        var link = document.querySelector('.topbar a[href="#' + s.id + '"]');
        var h2 = s.querySelector('h2');
        var top = s.getBoundingClientRect().top + window.scrollY;
        return {
          id: s.id,
          m: top / PX_PER_M,
          name: link ? link.textContent
                     : (h2 ? h2.textContent.replace(/^\s*\d+\s*/, '') : s.id)
        };
      });

    signBox.textContent = '';
    routeTicks.textContent = '';

    stops.forEach(function (stop, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sign';
      var num = document.createElement('b');
      num.textContent = i + 1;
      b.appendChild(num);
      b.appendChild(document.createTextNode(stop.name));
      b.addEventListener('click', function () { jumpTo(stop); });
      signBox.appendChild(b);
      stop.el = b;

      var tick = document.createElement('i');
      tick.style.left = (routeM > 0 ? clamp(stop.m / routeM, 0, 1) : 0) * 100 + '%';
      tick.title = stop.name;
      routeTicks.appendChild(tick);
      stop.tick = tick;
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
    W = road.clientWidth;
    H = canvas.parentNode.clientHeight || 78;
    canvas.width = Math.ceil(W * dpr);
    canvas.height = Math.ceil(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    readPalette();
    measure();
    syncFromScroll();
    draw();
  }

  function syncFromScroll() {
    pos = window.scrollY / PX_PER_M;
    relocate();
  }

  /* Off the end of what has been driven, the map is not yours any more. */
  function relocate() {
    if (pos > mappedTo + PERCEPTION_M || pos < mapFrom - PERCEPTION_M) {
      mapFrom = mappedTo = pos;
    }
  }

  /* ---------------------------------------------------------------- *
   * Drawing
   * ---------------------------------------------------------------- */

  var SIGN_TOP = 2;          // matches .sign { top } in style.css

  function sx(m) { return CAR_X * W + (m - pos) * ROAD_PX_PER_M; }

  // Top-down car, nose to the right. Headlamp wash ahead, brake lamps behind
  // when the pedal is down, reversing lamps behind when the gear is R.
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

    // Tail, brake and reversing lamps.
    if (gear === 'R') ctx.fillStyle = 'rgba(255,255,255,.95)';
    else if (brake > 0.02) ctx.fillStyle = 'rgba(240, 78, 60, .98)';
    else ctx.fillStyle = 'rgba(190, 52, 42, .55)';
    ctx.fillRect(-len / 2 + 1, -wide / 2 + 1.8, 2, 3);
    ctx.fillRect(-len / 2 + 1, wide / 2 - 4.8, 2, 3);

    ctx.restore();
  }

  function draw() {
    if (road.hidden) return;

    var ink = neutral();
    // The band leaves room for the sign gantry above and the distance posts
    // along the shoulder below.
    var rTop = Math.round(H * 0.45);
    var rBot = H - 9;
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

    /* The map the car has built, in its class colours with the per-polyline
       vertices a predicted map is drawn with.

       It is not the whole road. It is the stretch actually driven, solid,
       with the perception range hanging off each end of it: the model
       predicts over a region of interest around the ego, so the map runs on
       a little way up the road and thins out across that range, because
       distant evidence is sparse and the prediction there is a guess. Drive
       and you watch it laid down ahead of you; scroll past a stretch you
       never drove and there is nothing there to see. */
    var backM = mapFrom - PERCEPTION_M;
    var frontM = Math.max(mappedTo, pos + PERCEPTION_M);
    var x0 = sx(backM), x1 = sx(mapFrom), x2 = sx(mappedTo), x3 = sx(frontM);
    var clipL = Math.max(0, x0), clipR = Math.min(W, x3);

    function shade(kind) {
      var hex = colour(kind);
      var grd = ctx.createLinearGradient(0, 0, W, 0);
      var a0 = clamp(x0 / W, 0, 1), a1 = clamp(x1 / W, 0, 1);
      var a2 = clamp(x2 / W, 0, 1), a3 = clamp(x3 / W, 0, 1);
      var st = [];
      if (a1 > 0) {
        st.push([0, 0]);
        if (a0 > 0) st.push([a0, 0]);
        if (a1 > a0 + 0.0005) st.push([a0 + (a1 - a0) * 0.5, 0.5]);
      }
      st.push([a1, 1]);
      if (a2 > a1) st.push([a2, 1]);
      if (a3 > a2 + 0.0005) st.push([a2 + (a3 - a2) * 0.5, 0.5]);
      if (a3 < 1) st.push([a3, 0]);
      st.push([1, 0]);
      st.forEach(function (s) {
        grd.addColorStop(s[0], s[1] === 1 ? hex : rgba(hex, s[1]));
      });
      return grd;
    }

    // How confident the map is at one point, for elements drawn whole.
    function conf(m) {
      if (m >= mapFrom && m <= mappedTo) return 1;
      if (m < mapFrom) return clamp((m - backM) / PERCEPTION_M, 0, 1);
      return clamp((frontM - m) / Math.max(0.001, frontM - mappedTo), 0, 1);
    }

    if (clipR > clipL) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(clipL, 0, clipR - clipL, H);
      ctx.clip();

      var bound = shade('boundary');
      ctx.strokeStyle = bound;
      ctx.fillStyle = bound;
      ctx.lineWidth = 1.6;
      [edgeT, edgeB].forEach(function (y) {
        ctx.beginPath();
        ctx.moveTo(clipL, y);
        ctx.lineTo(clipR, y);
        ctx.stroke();
        var m0 = Math.floor(backM / VERT) * VERT;
        for (var m = m0; m <= frontM + VERT; m += VERT) {
          var vx = sx(m);
          if (vx < clipL - 4 || vx > clipR + 4) continue;
          ctx.beginPath();
          ctx.arc(vx, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ctx.strokeStyle = shade('divider');
      ctx.lineWidth = 1.3;
      ctx.setLineDash([DASH, GAP]);
      ctx.lineDashOffset = ((-sx(0)) % PERIOD + PERIOD) % PERIOD;
      ctx.beginPath();
      ctx.moveTo(clipL, mid);
      ctx.lineTo(clipR, mid);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      // A crossing is one element, so it takes one confidence rather than a
      // gradient across itself.
      stops.forEach(function (s) {
        var a = conf(s.m);
        if (a > 0.02) crossing(sx(s.m), colour('crossing'), 2.6, a);
      });
      ctx.restore();
    }

    drawCar(carX, mid);

    /* Signs sit at their true position and slide in from the right, the way
       they do on the road. Off-strip ones are not drawn at all. */
    stops.forEach(function (s, i) {
      if (!s.el) return;
      var x = sx(s.m);
      if (x < -170 || x > W + 170) { s.el.hidden = true; return; }
      s.el.hidden = false;
      s.el.style.left = Math.round(x) + 'px';
      s.el.classList.toggle('passed', s.m <= pos);
      var isHere = s === current();
      s.el.classList.toggle('here', isHere);

      /* Two posts from the plate down into the verge, with a footing where
         they meet the ground. A sign hanging in the air is a label; a sign on
         legs is a sign. */
      var footY = rTop + 3;
      var plateY = SIGN_TOP + (s.h || 22);
      var leg = Math.max(7, Math.min(34, (s.w || 90) * 0.28));
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

    // Route bar: the whole document, and how much of it has been driven.
    if (routeDone) {
      routeDone.style.width = clamp(pos / routeM, 0, 1) * 100 + '%';
    }
  }

  /* A section counts as current once it is behind the car, which is the same
     lookahead the old rail had, expressed in the only way that makes sense
     here: you are in the section you have driven into. */
  function current() {
    var here = stops.length ? stops[0] : null;
    stops.forEach(function (s) { if (s.m <= pos + 0.5) here = s; });
    return here;
  }

  /* ---------------------------------------------------------------- *
   * The model
   * ---------------------------------------------------------------- */

  function step(dt) {
    // Pedal travel. Real pedals move fast but not instantly, and lifting off
    // is quicker than pressing down.
    throttle += ((holdGas ? 1 : 0) - throttle) * Math.min(1, dt * (holdGas ? 20 : 16));
    brake += ((holdBrake ? 1 : 0) - brake) * Math.min(1, dt * (holdBrake ? 14 : 18));

    var dir = gear === 'R' ? -1 : 1;
    var v = speed;
    var absV = Math.abs(v);

    rpm = rpmAt(v);

    // Gearbox. The upshift point rises with throttle, which is what makes a
    // gentle pull-away shift early and a floored one hold each gear out.
    if (shifting > 0) shifting -= dt;
    else if (gear === 'D') {
      var up = 2600 + throttle * 3400;
      var dn = 1250 + throttle * 900;
      if (g < GEARS.length - 1 && rpm > up) { g++; shifting = SHIFT_T; }
      else if (g > 0 && rpm < dn) { g--; shifting = SHIFT_T; }
    }

    var drive = 0;
    if (shifting <= 0) {
      var t = throttle * torque(rpm) - (1 - throttle) * engineBrake(rpm);
      drive = dir * t * ratio() * FINAL * EFF / WHEEL_R;
    }

    // Reverse is geared and governed the way reverse is: it will not run away
    // with you. Cutting drive outright, because the force here is signed by
    // the direction of travel and clamping it against zero would be a no-op.
    if (gear === 'R' && absV > REV_LIMIT) drive = 0;

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

    if (pos > mappedTo) mappedTo = pos;
    if (pos < mapFrom) mapFrom = pos;
    rpm = rpmAt(speed);
  }

  /* ---------------------------------------------------------------- *
   * Readouts
   * ---------------------------------------------------------------- */

  var kmhEl  = document.getElementById('kmh');
  var rpmEl  = document.getElementById('rpm-fill');
  var gearEl = document.getElementById('gear-now');
  var tripEl = document.getElementById('trip');
  var nextEl = document.getElementById('nextup');

  function metres(m) {
    if (m < 15) return 'arriving';
    return m > 950 ? (m / 1000).toFixed(1) + ' km' : Math.round(m / 10) * 10 + ' m';
  }

  function hud() {
    var kmh = Math.round(Math.abs(speed) * 3.6);
    if (kmh !== shownKmh) {
      shownKmh = kmh;
      if (kmhEl) kmhEl.textContent = String(kmh);
    }
    if (rpmEl) {
      rpmEl.style.width = clamp((rpm - IDLE) / (REDLINE - IDLE), 0, 1) * 100 + '%';
      rpmEl.classList.toggle('red', rpm > REDLINE * 0.88);
    }

    var label = gear === 'D' ? 'D' + (g + 1) : gear;
    if (label !== shownGear) {
      shownGear = label;
      if (gearEl) gearEl.textContent = label;
    }
    if (tripEl) {
      tripEl.textContent = (pos / 1000).toFixed(2) + ' / ' + (routeM / 1000).toFixed(2) + ' km';
    }

    // Next junction, the way a nav system calls it.
    var next = null;
    for (var i = 0; i < stops.length; i++) {
      if (stops[i].m > pos + 0.5) { next = stops[i]; break; }
    }
    var d = next ? metres(next.m - pos) : '';
    var text = next ? '§' + (stops.indexOf(next) + 1) + ' ' + next.name +
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
      speed = clamp(observed, -45, 45);
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

    var sy = window.scrollY;

    // Anything that moved the page other than us wins, and lifts us off.
    if (owned && ownScroll >= 0 && Math.abs(sy - ownScroll) > 2) handBack();

    if (owned && !dragging) {
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
      var m = sy / PX_PER_M;
      // An anchor jump or a scrollbar thrown across the document is not
      // driving. Past a point, the car is simply somewhere else now.
      if (dragging || Math.abs(m - pos) > FOLLOW_SNAP) {
        pos = m;
        observed = 0;
      } else {
        var want = clamp((m - pos) * FOLLOW_K, -45, 45);
        observed += (want - observed) * Math.min(1, dt * FOLLOW_SMOOTH);
        if (Math.abs(m - pos) < 0.03 && Math.abs(observed) < 0.15) {
          pos = m;
          observed = 0;
        } else {
          pos += observed * dt;
        }
      }
      speed = observed;
      throttle = 0;
      brake = 0;
      rpm = rpmAt(speed);
      relocate();
      ownScroll = sy;
    }

    draw();
    hud();

    var busy = dragging || (owned
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
    relocate();
    draw();
    hud();
  }

  /* ---------------------------------------------------------------- *
   * Controls
   * ---------------------------------------------------------------- */

  var gasBtn = document.getElementById('pedal-gas');
  var brakeBtn = document.getElementById('pedal-brake');
  var gearBtns = Array.prototype.slice.call(cockpit.querySelectorAll('[data-gear]'));

  function baulk() {
    cockpit.classList.add('baulk');
    setTimeout(function () { cockpit.classList.remove('baulk'); }, 320);
  }

  function setGear(next) {
    if (next === gear) return;
    // You cannot slam a moving car into the other direction.
    if (Math.abs(speed) > 1.2) { baulk(); return; }
    gear = next;
    g = 0;
    shifting = 0;
    gearBtns.forEach(function (b) {
      var on = b.dataset.gear === gear;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    shownGear = '';
    hud();
    startLoop();
  }

  gearBtns.forEach(function (b, i) {
    b.tabIndex = b.dataset.gear === gear ? 0 : -1;
    b.addEventListener('click', function () { setGear(b.dataset.gear); });
    b.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
            : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var t = gearBtns[(i + d + gearBtns.length) % gearBtns.length];
      t.focus();
      setGear(t.dataset.gear);
    });
  });

  function pressGas() {
    takeWheel();
    holdGas = true;
  }
  function pressBrake() { takeWheel(); holdBrake = true; }
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

  /* Keyboard: W and S are the pedals, D and R the selector. The arrow keys are
     left alone, because they are how the page scrolls. */
  function editable(el) {
    return !el || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable;
  }
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || road.hidden) return;
    if (editable(document.activeElement)) return;
    var k = e.key.toLowerCase();
    if (k === 'w') { e.preventDefault(); pressGas(); }
    else if (k === 's') { e.preventDefault(); pressBrake(); }
    else if (k === 'r' || k === 'd') setGear(k.toUpperCase());
  });
  document.addEventListener('keyup', function (e) {
    var k = e.key.toLowerCase();
    if (k === 'w' || k === 's') release();
  });

  /* The route bar is the whole document, and dragging it seeks one to one.
     Seeking is explicitly instant: html carries scroll-behavior: smooth, and a
     smooth scroll restarted on every pointermove lurches instead of tracking. */
  function seek(clientX) {
    var rect = routeBar.getBoundingClientRect();
    var p = clamp((clientX - rect.left) / rect.width, 0, 1);
    pos = p * maxM();
    relocate();
    speed = 0;
    try {
      window.scrollTo({ top: pos * PX_PER_M, behavior: 'instant' });
    } catch (err) {
      window.scrollTo(0, pos * PX_PER_M);
    }
    ownScroll = window.scrollY;
  }

  if (routeBar) {
    routeBar.addEventListener('pointerdown', function (e) {
      dragging = true;
      handBack();
      routeBar.classList.add('dragging');
      seek(e.clientX);
      startLoop();
      try {
        if (routeBar.setPointerCapture) routeBar.setPointerCapture(e.pointerId);
      } catch (err) { /* nothing to capture */ }
      e.preventDefault();
    });
    routeBar.addEventListener('pointermove', function (e) {
      if (dragging) seek(e.clientX);
    });
    function letGoBar(e) {
      if (!dragging) return;
      dragging = false;
      routeBar.classList.remove('dragging');
      if (routeBar.releasePointerCapture && e && e.pointerId !== undefined) {
        try { routeBar.releasePointerCapture(e.pointerId); } catch (err) { /* gone */ }
      }
      speed = 0;
    }
    routeBar.addEventListener('pointerup', letGoBar);
    routeBar.addEventListener('pointercancel', letGoBar);
  }

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

  var collapse = document.getElementById('cockpit-toggle');
  if (collapse) {
    collapse.addEventListener('click', function () {
      var open = !cockpit.classList.toggle('shut');
      collapse.setAttribute('aria-expanded', String(open));
    });
  }

  window.addEventListener('scroll', function () {
    if (raf) return;
    syncFromScroll();
    draw();
    hud();
  }, { passive: true });

  window.addEventListener('resize', resize);
  window.addEventListener('load', function () { resize(); });
  window.addEventListener('resmap:theme', function () { readPalette(); draw(); });
  if (reduceMotion.addEventListener) {
    reduceMotion.addEventListener('change', resize);
  }

  resize();
  hud();
})();
