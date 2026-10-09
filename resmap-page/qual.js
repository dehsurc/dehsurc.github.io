/* §4 qualitative viewer: the page draws every frame itself, so the range and
   the camera condition switch on the frame being shown instead of loading
   another clip.

   Data, one folder per scene (written by export_scene.py):
     assets/qual/<scene>/data.json   frames, GT and predictions for both ranges
     assets/qual/<scene>/cams/NN.jpg  the six cameras, 3 x 2 sprite (FL F FR / BL B BR)
     assets/qual/<scene>/sat60/NN.jpg, sat100/NN.jpg  satellite tile, forward up
     assets/qual/<scene>/thumb.jpg    front camera, for the scene card
   A line is [label, x0, y0, x1, y1, ...]: ego decimetres, x forward, y left;
   label 0 crossing, 1 divider, 2 boundary. A (model, range, condition) that is
   absent from data.json shows as not available.

   Zoom is shared by every panel and the satellite tile: the +/- buttons,
   ctrl + wheel or a trackpad pinch, two fingers on a phone, a double click;
   drag to move while zoomed. The expand button fills the window. */
(function () {
  var root = document.getElementById('qv');
  if (!root) return;

  var RANGES = {
    '60x30': { len: 60, wid: 30, sat: 'sat60' },
    '100x50': { len: 100, wid: 50, sat: 'sat100' }
  };
  var CONDS = ['clean', 'front1', 'front3', 'all'];
  var DROPPED = {
    clean: [], front1: ['CAM_FRONT'],
    front3: ['CAM_FRONT_LEFT', 'CAM_FRONT', 'CAM_FRONT_RIGHT'],
    all: ['CAM_FRONT_LEFT', 'CAM_FRONT', 'CAM_FRONT_RIGHT', 'CAM_BACK_LEFT', 'CAM_BACK', 'CAM_BACK_RIGHT']
  };
  var FPS = 2;        // nuScenes keyframes: 2 Hz, so 1x is real time
  var ZMAX = 5;

  var state = { scene: null, range: '60x30', cond: 'clean', frame: 0, rate: 1, gt: true, playing: false,
                zoom: 1, ex: 0, ey: 0 };   // view centre in ego metres
  var data = null, images = { cams: [], sat60: [], sat100: [] };
  var timer = null, loadToken = 0;

  var $ = function (sel, el) { return (el || root).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || root).querySelectorAll(sel)); };

  var panels = $$('.qv-panel[data-model]').map(function (el) {
    var mod = $('.qv-mod', el);
    return { el: el, key: el.getAttribute('data-model'), canvas: $('canvas', el), note: $('.qv-note', el),
             mod: mod, modText: mod ? mod.textContent : '' };
  });
  var panelBox = $('.qv-panels');
  var satBox = $('.qv-panel.sat .qv-box');
  var satImg = $('img', satBox);
  var camCells = $$('.qv-cam');
  var slider = $('.qv-seek input');
  var seekBar = $('.qv-seek');
  var seekTip = $('.qv-seek .seek-tip');
  var counter = $('.qv-count');
  var playBtn = $('.qv-play');
  var zoomOut = $('[data-zoom="out"]'), zoomIn = $('[data-zoom="in"]'), zoomFit = $('[data-zoom="fit"]');
  var maxBtn = $('.qv-max');
  var sceneName = $('.qv-scene-name');
  var sceneDesc = $('.qv-scene-desc');
  var scenes = $$('.qv-scenes button');

  function css(name) {
    return getComputedStyle(root).getPropertyValue(name).trim();
  }

  /* ---------------------------------------------------------------- view */
  function clampView() {
    var R = RANGES[state.range], z = state.zoom;
    var mx = R.len / 2 * (1 - 1 / z), my = R.wid / 2 * (1 - 1 / z);
    state.ex = Math.max(-mx, Math.min(mx, state.ex));
    state.ey = Math.max(-my, Math.min(my, state.ey));
  }

  // zoom to z keeping the point at (fx, fy) of a panel (fractions of its box) still
  function zoomTo(z, fx, fy) {
    var R = RANGES[state.range];
    z = Math.max(1, Math.min(ZMAX, z));
    if (fx == null) { fx = .5; fy = .5; }
    var x = state.ex + (.5 - fy) * R.len / state.zoom, y = state.ey + (.5 - fx) * R.wid / state.zoom;
    state.zoom = z;
    state.ex = x - (.5 - fy) * R.len / z;
    state.ey = y - (.5 - fx) * R.wid / z;
    clampView();
    root.classList.toggle('zoomed', z > 1.001);
    zoomOut.disabled = z <= 1.001; zoomFit.disabled = z <= 1.001; zoomIn.disabled = z >= ZMAX - .001;
    placeSat();
    draw();
  }

  function placeSat() {
    var R = RANGES[state.range], k = satBox.clientHeight / R.len;
    satImg.style.transform = state.zoom > 1.001 ?
      'scale(' + state.zoom + ') translate(' + (state.ey * k) + 'px,' + (state.ex * k) + 'px)' : '';
  }

  /* ---------------------------------------------------------------- drawing */
  function draw() {
    if (!data) return;
    var R = RANGES[state.range], f = state.frame, z = state.zoom;
    var colors = [css('--map-crossing'), css('--map-divider'), css('--map-boundary')];
    var surface = css('--qv-ground'), gtColor = css('--qv-gt'), ink = css('--ink'), faint = css('--ink-faint');

    panels.forEach(function (p) {
      var c = p.canvas, rect = c.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var W = Math.round(rect.width * dpr), H = Math.round(rect.height * dpr);
      if (!W || !H) return;
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      var g = c.getContext('2d');
      g.fillStyle = surface;
      g.fillRect(0, 0, W, H);
      var k = H / R.len * z;   // px per metre
      function X(xm, ym) { return W / 2 - (ym - state.ey) * k; }
      function Y(xm) { return H / 2 - (xm - state.ex) * k; }
      // ego (x forward, y left) in decimetres -> canvas, forward up
      function line(a, color, width) {
        g.strokeStyle = color; g.lineWidth = width * dpr;
        g.beginPath();
        for (var i = 1; i < a.length; i += 2) {
          var px = X(a[i] / 10, a[i + 1] / 10), py = Y(a[i] / 10);
          if (i === 1) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.stroke();
      }
      g.lineCap = 'round'; g.lineJoin = 'round';

      if (state.range === '100x50') {
        // the 60 x 30 m range, for scale
        g.save();
        g.setLineDash([6 * dpr, 5 * dpr]); g.strokeStyle = faint; g.lineWidth = 1.2 * dpr;
        g.strokeRect(X(0, 15), Y(30), 30 * k, 60 * k);
        g.restore();
      }
      if (state.gt) data.gt[state.range][f].forEach(function (a) { line(a, gtColor, 3); });

      // with every camera off, ReSMap is shown without temporal memory: the variant
      // that holds up best there (Table 2), when the scene has it
      var key = p.key;
      var nt = p.key === 'resmap' && state.cond === 'all' && data.preds[state.range].resmapnt &&
               data.preds[state.range].resmapnt.all;
      if (nt) key = 'resmapnt';
      var m = data.preds[state.range][key];
      var pred = m && m[state.cond];
      p.el.classList.toggle('missing', !pred);
      if (p.note) {
        p.note.textContent = !pred ? (m ? 'not run for this condition' :
          (p.key === 'satforhdmap' && state.range === '100x50' ? 'no 100 × 50 m model' : 'coming soon')) : '';
      }
      if (pred) {
        var w = Math.max(2.2, Math.min(3.4, rect.width / 60));
        pred[f].forEach(function (a) { line(a, colors[a[0]], w); });
      }
      ego(g, X(0, 0), Y(0), k, ink);
    });
  }

  function ego(g, cx, cy, k, ink) {
    var w = Math.max(1.9 * k, 6), h = Math.max(4.6 * k, 14);
    g.fillStyle = css('--paper');
    roundRect(g, cx - w / 2 - 2, cy - h / 2 - 2, w + 4, h + 4, w * .32); g.fill();
    g.fillStyle = ink;
    roundRect(g, cx - w / 2, cy - h / 2, w, h, w * .28); g.fill();
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function showFrame() {
    if (!data) return;
    var f = state.frame, n = data.frames.length;
    var cam = images.cams[f];
    if (cam) camCells.forEach(function (cell) { cell.style.backgroundImage = 'url("' + cam.src + '")'; });
    var sat = images[RANGES[state.range].sat][f];
    if (sat) satImg.src = sat.src;
    slider.value = String(f);
    slider.style.setProperty('--p', (n > 1 ? f / (n - 1) * 100 : 0) + '%');
    counter.textContent = 'Frame ' + (f + 1) + ' / ' + n;
    draw();
  }

  /* ---------------------------------------------------------------- state */
  function setCond(cond) {
    state.cond = cond;
    $$('.qv-cond button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-cond') === cond));
    });
    var off = DROPPED[cond];
    camCells.forEach(function (cell) {
      cell.classList.toggle('off', off.indexOf(cell.getAttribute('data-cam')) >= 0);
    });
    root.setAttribute('data-cond', cond);
    draw();
  }

  function setRange(range) {
    var fx = null;
    state.range = range;
    $$('.qv-range button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-range') === range));
    });
    root.setAttribute('data-range', range);
    $('.qv-satlabel').textContent = range === '60x30' ? '60 × 30 m' : '100 × 50 m';
    clampView();
    placeSat();
    setCond(state.cond);
    showFrame();
  }

  function setFrame(f) {
    if (!data) return;
    var n = data.frames.length;
    state.frame = Math.max(0, Math.min(n - 1, f));
    showFrame();
    if (state.frame >= n - 1 && !state.playing) playBtn.setAttribute('data-state', 'ended');
  }

  function play(on) {
    state.playing = on;
    clearInterval(timer);
    var ended = !on && data && state.frame >= data.frames.length - 1;
    playBtn.setAttribute('data-state', on ? 'playing' : ended ? 'ended' : 'paused');
    playBtn.setAttribute('aria-label', on ? 'Pause' : ended ? 'Replay' : 'Play');
    if (!on) return;
    if (state.frame >= data.frames.length - 1) setFrame(0);
    timer = setInterval(function () {
      if (state.frame >= data.frames.length - 1) { play(false); return; }
      setFrame(state.frame + 1);
    }, 1000 / (FPS * state.rate));
  }

  function loadScene(name) {
    var token = ++loadToken;
    play(false);
    state.scene = name;
    scenes.forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-scene') === name)); });
    if (typeof syncSteps === 'function') syncSteps();
    var btn = scenes.filter(function (b) { return b.getAttribute('data-scene') === name; })[0];
    root.classList.add('loading');
    var base = 'assets/qual/' + name + '/';
    fetch(base + 'data.json').then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (d) {
      if (token !== loadToken) return;
      var n = d.frames.length, pad = function (i) { return (i < 10 ? '0' : '') + i; };
      var next = { cams: [], sat60: [], sat100: [] }, left = 3 * n, done = false;
      function ready() {
        if (done || token !== loadToken) return;
        done = true;
        data = d; images = next;
        slider.max = String(n - 1);
        sceneName.textContent = name;
        sceneDesc.textContent = btn ? btn.getAttribute('data-caption') || '' : '';
        root.classList.remove('loading');
        state.frame = 0;
        setRange(state.range);
        playBtn.setAttribute('data-state', 'paused');
      }
      ['cams', 'sat60', 'sat100'].forEach(function (k) {
        for (var i = 0; i < n; i++) {
          var im = new Image();
          im.onload = im.onerror = function () { if (--left <= n * 2) ready(); };   // a third is enough to start
          im.src = base + k + '/' + pad(i) + '.jpg';
          next[k].push(im);
        }
      });
      setTimeout(ready, 4000);
    }).catch(function () {
      if (token !== loadToken) return;
      root.classList.remove('loading');
      sceneDesc.textContent = 'This scene is not available yet.';
    });
  }

  /* ---------------------------------------------------------------- full window */
  function setMax(on) {
    root.classList.toggle('max', on);
    document.documentElement.classList.toggle('qv-max-open', on);
    maxBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
    maxBtn.setAttribute('aria-pressed', String(on));
    if (on && root.requestFullscreen && !document.fullscreenElement) {
      root.requestFullscreen().catch(function () {});
    } else if (!on && document.fullscreenElement === root && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
    if (on) root.focus({ preventScroll: true });
    requestAnimationFrame(function () { placeSat(); draw(); });
  }
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && root.classList.contains('max')) setMax(false);
  });

  /* ---------------------------------------------------------------- wiring */
  $$('.qv-cond button').forEach(function (b) {
    b.addEventListener('click', function () { setCond(b.getAttribute('data-cond')); });
  });
  $$('.qv-range button').forEach(function (b) {
    b.addEventListener('click', function () { setRange(b.getAttribute('data-range')); });
  });
  scenes.forEach(function (b) {
    b.addEventListener('click', function () { loadScene(b.getAttribute('data-scene')); });
  });
  // previous / next scene; the row has two ends, it does not wrap round
  var steps = $$('.qv-step');
  function sceneIndex() {
    return scenes.map(function (x) { return x.getAttribute('data-scene'); }).indexOf(state.scene);
  }
  function syncSteps() {
    var i = sceneIndex();
    steps.forEach(function (b) {
      var d = Number(b.getAttribute('data-step'));
      b.disabled = i + d < 0 || i + d >= scenes.length;
    });
    var cur = scenes[i], row = $('.qv-scenes');
    if (cur && row) {
      var l = cur.offsetLeft - row.offsetLeft, r = l + cur.offsetWidth;
      if (l < row.scrollLeft || r > row.scrollLeft + row.clientWidth) {
        row.scrollTo({ left: l - (row.clientWidth - cur.offsetWidth) / 2, behavior: 'smooth' });
      }
    }
  }
  steps.forEach(function (b) {
    b.addEventListener('click', function () {
      var j = sceneIndex() + Number(b.getAttribute('data-step'));
      if (j >= 0 && j < scenes.length) loadScene(scenes[j].getAttribute('data-scene'));
    });
  });
  slider.addEventListener('input', function () { play(false); setFrame(Number(slider.value)); });
  playBtn.addEventListener('click', function () { play(!state.playing); });
  $$('.qv-speed [data-rate]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.rate = Number(b.getAttribute('data-rate'));
      $$('.qv-speed [data-rate]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      if (state.playing) play(true);
    });
  });
  zoomIn.addEventListener('click', function () { zoomTo(state.zoom * 1.5); });
  zoomOut.addEventListener('click', function () { zoomTo(state.zoom / 1.5); });
  zoomFit.addEventListener('click', function () { state.ex = state.ey = 0; zoomTo(1); });
  maxBtn.addEventListener('click', function () { setMax(!root.classList.contains('max')); });
  var gtBox = $('.qv-gt input');
  gtBox.addEventListener('change', function () { state.gt = gtBox.checked; draw(); });

  // hover label over the frame bar
  function tipAt(e) {
    var r = slider.getBoundingClientRect(), n = data ? data.frames.length : 1;
    var t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    seekTip.textContent = 'Frame ' + (Math.round(t * (n - 1)) + 1);
    seekTip.style.left = (t * r.width) + 'px';
    slider.style.setProperty('--h', (t * 100) + '%');
  }
  seekBar.addEventListener('pointermove', function (e) { seekBar.classList.add('live'); tipAt(e); });
  seekBar.addEventListener('pointerleave', function () { seekBar.classList.remove('live'); slider.style.setProperty('--h', '0%'); });

  // zoom and pan on the map panels: position as a fraction of the panel under the pointer
  function frac(e) {
    var box = e.target.closest('.qv-box');
    if (!box) return null;
    var r = box.getBoundingClientRect();
    return { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height, h: r.height };
  }
  panelBox.addEventListener('wheel', function (e) {
    if (!(e.ctrlKey || e.metaKey) && state.zoom <= 1.001) return;   // plain wheel scrolls the page
    if (!(e.ctrlKey || e.metaKey) && !root.classList.contains('max')) return;
    var p = frac(e);
    if (!p) return;
    e.preventDefault();
    zoomTo(state.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .002)), p.fx, p.fy);
  }, { passive: false });
  panelBox.addEventListener('dblclick', function (e) {
    var p = frac(e);
    if (!p) return;
    if (state.zoom >= ZMAX - .001) { state.ex = state.ey = 0; zoomTo(1); } else zoomTo(state.zoom * 2, p.fx, p.fy);
  });
  var pointers = {}, pinch = null;
  panelBox.addEventListener('pointerdown', function (e) {
    if (!e.target.closest('.qv-box')) return;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointers);
    if (ids.length === 2) {
      var a = pointers[ids[0]], b = pointers[ids[1]];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: state.zoom };
    }
    if (state.zoom > 1.001 || ids.length === 2) panelBox.setPointerCapture(e.pointerId);
  });
  panelBox.addEventListener('pointermove', function (e) {
    var prev = pointers[e.pointerId];
    if (!prev) return;
    var ids = Object.keys(pointers);
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (ids.length === 2 && pinch) {
      var a = pointers[ids[0]], b = pointers[ids[1]];
      var p = frac({ target: e.target, clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }) || { fx: .5, fy: .5 };
      zoomTo(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, p.fx, p.fy);
    } else if (ids.length === 1 && state.zoom > 1.001) {
      var box = e.target.closest('.qv-box') || satBox, h = box.getBoundingClientRect().height;
      var R = RANGES[state.range], k = h / R.len * state.zoom;
      state.ex += (e.clientY - prev.y) / k;
      state.ey += (e.clientX - prev.x) / k;
      clampView(); placeSat(); draw();
    }
  });
  function lift(e) { delete pointers[e.pointerId]; if (Object.keys(pointers).length < 2) pinch = null; }
  panelBox.addEventListener('pointerup', lift);
  panelBox.addEventListener('pointercancel', lift);

  root.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' && e.target.type === 'range' && /Arrow/.test(e.key)) return;
    if (e.key === ' ' || e.key === 'k') { play(!state.playing); e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === '.') { play(false); setFrame(state.frame + 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === ',') { play(false); setFrame(state.frame - 1); e.preventDefault(); }
    else if ('1234'.indexOf(e.key) >= 0 && e.key) setCond(CONDS[Number(e.key) - 1]);
    else if (e.key === '+' || e.key === '=') zoomTo(state.zoom * 1.5);
    else if (e.key === '-') zoomTo(state.zoom / 1.5);
    else if (e.key === '0') { state.ex = state.ey = 0; zoomTo(1); }
    else if (e.key === 'f') setMax(!root.classList.contains('max'));
    else if (e.key === 'Escape' && root.classList.contains('max')) setMax(false);
  });

  // redraw on resize and on a theme switch
  if (window.ResizeObserver) new ResizeObserver(function () { placeSat(); draw(); }).observe(root);
  else window.addEventListener('resize', draw);
  new MutationObserver(function () { draw(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // start when the section comes near, not on page load
  var first = scenes[0] && scenes[0].getAttribute('data-scene');
  if (!first) return;
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); loadScene(first); }
    }, { rootMargin: '600px 0px' });
    io.observe(root);
  } else loadScene(first);
})();
