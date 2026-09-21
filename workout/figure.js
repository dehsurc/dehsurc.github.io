/* =========================================================================
   자세 그림 렌더러 — 각도 기반 스틱 피겨를 SVG로 그립니다.
   좌표계: viewBox 0 0 100 70, 바닥 y=62. 각도: 0=오른쪽, 90=위, 180=왼쪽, -90=아래.
   pose = { hip:[x,y], torso:deg, head?:deg, arch?:n, scale?:n, front?:bool,
            arms:[[upper,fore],[upper,fore]], legs:[[thigh,shin],[thigh,shin]],
            feet?:[deg,deg]|null, props?:[...], note?:'...' }
   ========================================================================= */
(function () {
  const L = { head: 3.6, neck: 2.5, torso: 18, ua: 9, fa: 9, th: 13, sh: 12, foot: 4 };
  const FLOOR = 62;
  const rad = (a) => (a * Math.PI) / 180;
  const pt = (o, a, len) => [o[0] + Math.cos(rad(a)) * len, o[1] - Math.sin(rad(a)) * len];
  const f = (n) => (Math.round(n * 10) / 10).toString();

  function solve(p) {
    const s = p.scale || 1;
    const k = {};
    for (const key in L) k[key] = L[key] * s;
    const hip = p.hip;
    const torso = p.torso;
    const sh = pt(hip, torso, k.torso);
    const headA = p.head == null ? torso : p.head;
    const neck = pt(sh, headA, k.neck);
    const headC = pt(neck, headA, k.head);
    const shOff = p.front ? 4 * s : 0;
    const hipOff = p.front ? 2.5 * s : 0;
    const arms = (p.arms || []).map((a, i) => {
      const o = [sh[0] + (i === 0 ? -shOff : shOff), sh[1]];
      const el = pt(o, a[0], k.ua);
      const hand = pt(el, a[1], k.fa);
      return { o, el, hand };
    });
    const feet = p.feet === undefined ? [0, 0] : p.feet;
    const legs = (p.legs || []).map((l, i) => {
      const o = [hip[0] + (i === 0 ? -hipOff : hipOff), hip[1]];
      const knee = pt(o, l[0], k.th);
      const ankle = pt(knee, l[1], k.sh);
      let foot = null;
      if (feet) {
        const fa = Array.isArray(feet) ? (feet[i] == null ? feet[0] : feet[i]) : feet;
        if (fa != null) foot = pt(ankle, fa, k.foot);
      }
      return { o, knee, ankle, foot };
    });
    return { hip, sh, neck, headC, arms, legs, k, torso, headA };
  }

  function resolve(ref, S) {
    if (Array.isArray(ref)) return ref;
    const m = /^(hand|foot|knee|el)(\d)$/.exec(ref);
    if (!m) return [0, 0];
    const i = +m[2];
    if (m[1] === 'hand') return S.arms[i].hand;
    if (m[1] === 'el') return S.arms[i].el;
    if (m[1] === 'knee') return S.legs[i].knee;
    return S.legs[i].foot || S.legs[i].ankle;
  }

  function propsSvg(props, S, before) {
    let out = '';
    for (const pr of props || []) {
      const t = typeof pr === 'string' ? pr : pr.t;
      if (before) {
        if (t === 'bg') out += `<rect x="0" y="0" width="100" height="${FLOOR}" class="fg-bg"/>`;
        if (t === 'wallL') out += `<line x1="${pr.x}" y1="2" x2="${pr.x}" y2="${FLOOR}" class="fg-prop"/>`;
        if (t === 'wallR') out += `<line x1="${pr.x}" y1="2" x2="${pr.x}" y2="${FLOOR}" class="fg-prop"/>`;
        if (t === 'box') out += `<rect x="${pr.x}" y="${pr.y}" width="${pr.w}" height="${pr.h}" rx="1" class="fg-box"/>`;
        if (t === 'bar') out += `<line x1="${pr.x1}" y1="${pr.y}" x2="${pr.x2}" y2="${pr.y}" class="fg-bar"/>`;
        if (t === 'door') out += `<rect x="${pr.x}" y="2" width="1.6" height="${FLOOR - 2}" class="fg-box"/><circle cx="${pr.x + 0.8}" cy="${pr.hy}" r="1.4" class="fg-dot"/>`;
      } else {
        if (t === 'bottles') {
          for (const a of S.arms) out += `<rect x="${f(a.hand[0] - 1.6)}" y="${f(a.hand[1] - 2.4)}" width="3.2" height="4.8" rx=".6" class="fg-item"/>`;
        }
        if (t === 'line') {
          const a = resolve(pr.a, S), b = resolve(pr.b, S);
          out += `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" class="fg-rope"/>`;
        }
        if (t === 'pad') {
          const a = resolve(pr.at, S);
          out += `<rect x="${f(a[0] - 4)}" y="${f(a[1] - 0.6)}" width="8" height="1.6" rx=".5" class="fg-item"/>`;
        }
        if (t === 'bag') {
          const c = [(S.hip[0] + S.sh[0]) / 2, (S.hip[1] + S.sh[1]) / 2];
          out += `<rect x="${f(c[0] - 6.5)}" y="${f(c[1] - 4)}" width="5" height="8" rx="1" class="fg-item"/>`;
        }
        if (t === 'arrow') {
          out += `<path d="${pr.d}" class="fg-arrow" marker-end="url(#fg-ah)"/>`;
        }
      }
    }
    return out;
  }

  function seg(a, b, cls) {
    return `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" class="${cls}"/>`;
  }

  /* 프레임에서 가장 높은 점 (viewBox 크롭용) */
  function topOf(p) {
    const S = solve(p);
    let y = S.headC[1] - S.k.head;
    for (const a of S.arms) y = Math.min(y, a.el[1], a.hand[1]);
    for (const l of S.legs) y = Math.min(y, l.knee[1], l.ankle[1], l.foot ? l.foot[1] : 99);
    for (const pr of p.props || []) {
      const t = typeof pr === 'string' ? pr : pr.t;
      if (t === 'box') y = Math.min(y, pr.y);
      if (t === 'bar') y = Math.min(y, pr.y);
      if (t === 'wallL' || t === 'wallR' || t === 'door' || t === 'bg') y = Math.min(y, Math.max(2, y - 6));
    }
    return y;
  }

  function figureSvg(p) {
    const S = solve(p);
    let out = '';
    out += propsSvg(p.props, S, true);
    out += `<line x1="0" y1="${FLOOR}" x2="100" y2="${FLOOR}" class="fg-floor"/>`;
    // back limbs first (lighter)
    const limb = (i) => {
      let s = '';
      const cls = i === 1 ? 'fg-limb fg-back' : 'fg-limb';
      const lg = S.legs[i];
      if (lg) {
        s += seg(lg.o, lg.knee, cls) + seg(lg.knee, lg.ankle, cls);
        if (lg.foot) s += seg(lg.ankle, lg.foot, cls);
      }
      const ar = S.arms[i];
      if (ar) s += seg(ar.o, ar.el, cls) + seg(ar.el, ar.hand, cls);
      return s;
    };
    out += limb(1);
    // torso
    if (p.arch) {
      const mx = (S.hip[0] + S.sh[0]) / 2, my = (S.hip[1] + S.sh[1]) / 2;
      const nx = -Math.sin(rad(S.torso)) * -1, ny = -Math.cos(rad(S.torso));
      // perpendicular to torso; positive arch bulges "up" (toward -y side of the body's normal)
      const cx = mx + nx * p.arch, cy = my + ny * p.arch;
      out += `<path d="M${f(S.hip[0])} ${f(S.hip[1])} Q${f(cx)} ${f(cy)} ${f(S.sh[0])} ${f(S.sh[1])}" class="fg-torso"/>`;
    } else {
      out += seg(S.hip, S.sh, 'fg-torso');
    }
    out += seg(S.sh, S.neck, 'fg-limb');
    out += `<circle cx="${f(S.headC[0])}" cy="${f(S.headC[1])}" r="${f(S.k.head)}" class="fg-head"/>`;
    out += limb(0);
    out += propsSvg(p.props, S, false);
    if (p.note) out += `<text x="50" y="68.5" class="fg-note" text-anchor="middle">${p.note}</text>`;
    return out;
  }

  const DEFS = `<defs><marker id="fg-ah" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L6 3L0 6z" class="fg-arrowhead"/></marker></defs>`;

  /* 운동 하나의 그림 (1~3 프레임) */
  function exerciseSvg(frames, opts) {
    opts = opts || {};
    const n = frames.length;
    const labels = opts.labels || (n === 1 ? [''] : n === 2 ? ['시작', '끝'] : ['1', '2', '3']);
    const w = 100 * n + 6 * (n - 1);
    // 위쪽 빈 공간을 잘라내 그림을 크게. 바닥(62)과 메모(68.5)는 항상 포함.
    let top = Math.min.apply(null, frames.map(topOf));
    top = Math.max(0, Math.min(36, Math.floor(top - 5)));
    const h = 72 - top;
    let out = `<svg viewBox="0 ${top} ${w} ${h}" class="fig" role="img" aria-label="${opts.alt || '자세 그림'}">${DEFS}`;
    frames.forEach((fr, i) => {
      const x = i * 106;
      out += `<g transform="translate(${x} 0)">${figureSvg(fr)}`;
      if (labels[i]) out += `<text x="3" y="${top + 6}" class="fg-label">${labels[i]}</text>`;
      out += `</g>`;
      if (i < n - 1) out += `<path d="M${x + 100.5} ${top + h / 2} l4 0 m-1.5 -1.5 l1.5 1.5 l-1.5 1.5" class="fg-sep"/>`;
    });
    out += '</svg>';
    return out;
  }

  window.FIGURE = { exerciseSvg, figureSvg, solve, FLOOR };
})();
