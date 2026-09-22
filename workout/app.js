/* =========================================================================
   매일 맨몸운동 — 앱 로직
   ========================================================================= */
(function () {
  'use strict';
  const P = window.PROGRAM, EX = P.EX, CH = P.CHAINS, POSES = window.POSES, FIG = window.FIGURE;
  const KEY = 'bw:state:v1';
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- 몸 치수 ---------- */
  const BODY = [
    { id: 'weight', name: '체중', unit: 'kg' },
    { id: 'shoulder', name: '어깨 둘레', unit: 'cm', hint: '양 어깨 가장 넓은 곳을 지나 가슴 위로 한 바퀴' },
    { id: 'chest', name: '가슴 둘레', unit: 'cm' },
    { id: 'waist', name: '허리 둘레', unit: 'cm', hint: '배꼽 높이' },
    { id: 'arm', name: '팔 둘레', unit: 'cm', hint: '힘 준 상태, 가장 굵은 곳' },
  ];

  /* ---------- 날짜 ---------- */
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const dstr = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => dstr(new Date());
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return dstr(d); };
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const fmtDate = (s) => { const d = parse(s); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + WD[d.getDay()] + ')'; };
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const mondayOf = (s) => { const d = parse(s); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return dstr(d); };

  /* ---------- 상태 ---------- */
  const DEFAULT = () => ({
    v: 1, t: 0,
    onboarded: false,
    settings: { duration: 45, eq: { chair: true, table: true, bottle: true, towel: true, bar: false, band: false }, started: today(), theme: 'auto' },
    levels: {}, prog: {}, logs: {}, tests: [], body: [], override: {},
  });
  let S = load();
  let memMode = false;
  function load() {
    try {
      localStorage.setItem(KEY + ':probe', '1'); localStorage.removeItem(KEY + ':probe');
      const raw = localStorage.getItem(KEY);
      if (raw) { const s = JSON.parse(raw); return Object.assign(DEFAULT(), s, { settings: Object.assign(DEFAULT().settings, s.settings || {}) }); }
    } catch (e) { memMode = true; }
    return DEFAULT();
  }
  function localSave() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { memMode = true; } }
  function save() { S.t = Date.now(); localSave(); scheduleCloud(); }

  /* ---------- 기기 간 동기화 (Artifact db) ----------
     정적 사이트나 로컬 파일로 열면 db가 없어 localStorage만 씁니다.
     claude.ai 비공개 페이지로 열면 폰·노트북이 같은 기록을 봅니다. */
  let DB = null, cloudState = 'off', cloudMsg = '', cloudSettled = false, cloudTimer = null;
  const pushed = { state: null, months: {} };
  const canon = (o) => { const out = {}; Object.keys(o).sort().forEach((k) => { out[k] = o[k]; }); return out; };
  function stateBody() { return { t: S.t || 0, onboarded: !!S.onboarded, settings: S.settings, levels: S.levels, prog: S.prog, tests: S.tests, body: S.body, override: S.override }; }
  function monthMap() {
    const m = {};
    for (const d of Object.keys(S.logs).sort()) { const ym = d.slice(0, 7); (m[ym] = m[ym] || { days: {} }).days[d] = S.logs[d]; }
    return m;
  }
  function scheduleCloud() {
    if (!DB) return;
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(flushCloud, 700);
  }
  async function flushCloud() {
    if (!DB) return;
    setCloud('syncing');
    try {
      const st = JSON.stringify(stateBody());
      if (st !== pushed.state) { await DB.doc('app/state').set(JSON.parse(st)); pushed.state = st; }
      const months = monthMap();
      for (const ym of Object.keys(months)) {
        const body = JSON.stringify(months[ym]);
        if (body !== pushed.months[ym]) { await DB.doc('logs/' + ym).set(JSON.parse(body)); pushed.months[ym] = body; }
      }
      setCloud('ok');
    } catch (e) { setCloud('err', (e && e.code) || 'error'); }
  }
  async function pullCloud() {
    const snap = await DB.doc('app/state').get();
    let adopted = false;
    if (snap.exists) {
      const r = snap.data() || {};
      if ((r.t || 0) > (S.t || 0)) {
        S.onboarded = !!r.onboarded;
        S.settings = Object.assign(DEFAULT().settings, r.settings || {});
        S.levels = r.levels || {}; S.prog = r.prog || {};
        S.tests = r.tests || []; S.body = r.body || []; S.override = r.override || {};
        S.t = r.t || 0; adopted = true;
      }
    }
    pushed.state = adopted ? JSON.stringify(stateBody()) : null;
    const q = await DB.collection('logs').get();
    for (const d of q.docs) {
      const days = ((d.data() || {}).days) || {};
      for (const k of Object.keys(days)) {
        const cur = S.logs[k];
        if (!cur || (days[k].t || 0) > (cur.t || 0)) S.logs[k] = days[k];
      }
      pushed.months[d.id] = JSON.stringify({ days: canon(days) });
    }
    localSave();
  }
  function setCloud(state, msg) { cloudState = state; cloudMsg = msg || ''; const el = $('#syncline'); if (el) el.innerHTML = syncText(); }
  function syncText() {
    if (cloudState === 'off') return '이 브라우저에만 저장 (기기 간 동기화 없음)';
    if (cloudState === 'syncing') return '동기화 중…';
    if (cloudState === 'err') return `동기화 실패 (${esc(cloudMsg)}) · 기록은 이 브라우저에 남아 있습니다`;
    return '✓ 계정에 동기화됨 · 다른 기기에서도 같은 기록';
  }
  async function initCloud() {
    let db = null;
    try { if (window.claude && window.claude.use) db = await window.claude.use('db'); } catch (e) { db = null; }
    if (!db) { cloudSettled = true; if (!S.onboarded) render(); return; }
    DB = db;
    try { await pullCloud(); setCloud('ok'); } catch (e) { setCloud('err', (e && e.code) || 'error'); }
    cloudSettled = true;
    render();
    flushCloud();
  }

  /* 뷰어가 테마를 지정해 두었으면 '자동'일 때 그 값을 되돌려 놓습니다. */
  const HOST_THEME = document.documentElement.getAttribute('data-theme');
  function applyTheme() {
    const t = S.settings.theme || 'auto';
    if (t !== 'auto') { document.documentElement.dataset.theme = t; return; }
    if (HOST_THEME) document.documentElement.setAttribute('data-theme', HOST_THEME);
    else document.documentElement.removeAttribute('data-theme');
  }

  /* ---------- 진행 레벨 ---------- */
  function levelOf(chainId) {
    const c = CH[chainId];
    const lv = S.levels[chainId];
    return typeof lv === 'number' ? Math.max(0, Math.min(c.levels.length - 1, lv)) : c.start;
  }
  /* 장비로 할 수 없는 레벨은 가까운 가능한 레벨로 */
  function usableLevel(chainId, eq) {
    const c = CH[chainId]; const want = levelOf(chainId);
    if (P.usable(c.levels[want], eq)) return want;
    for (let d = 1; d < c.levels.length; d++) {
      if (want - d >= 0 && P.usable(c.levels[want - d], eq)) return want - d;
      if (want + d < c.levels.length && P.usable(c.levels[want + d], eq)) return want + d;
    }
    return -1;
  }

  /* ---------- 루틴 생성 ---------- */
  function weeksIn() { return Math.max(0, Math.floor(daysBetween(S.settings.started, today()) / 7)); }
  function holdMult() { return Math.min(1.5, 1 + weeksIn() * 0.08); }

  function targetOf(ex, phase, D) {
    if (ex.type === 'hold' || ex.type === 'hold_side') {
      let sec = ex.target;
      if (phase === 'cool') sec = sec * D.coolMult * holdMult();
      if (phase === 'flow') sec = sec * D.flowMult * holdMult();
      if (ex.id === 'walk') sec = ex.target;
      return { kind: 'hold', sec: Math.max(10, Math.round(sec / 5) * 5), side: ex.type === 'hold_side' };
    }
    return { kind: 'reps', min: ex.target[0], max: ex.target[1], side: ex.type === 'reps_side', unit: ex.unit || '회' };
  }

  function buildRoutine(dayKey, duration) {
    const day = P.DAYS[dayKey]; const D = P.DURATION[duration]; const eq = S.settings.eq;
    const items = [];
    const push = (exId, phase, chainId, sets, rest) => {
      const ex = Object.assign({ id: exId }, EX[exId]);
      items.push({ ex, phase, chain: chainId || null, level: chainId ? usableLevel(chainId, eq) : null, sets, rest, target: targetOf(ex, phase, D) });
    };
    for (const id of P.WARMUP) push(id, 'warm', null, 1, 0);
    if (dayKey === 'mobility') {
      for (const id of day.flow) if (!EX[id].equip || P.usable(id, eq)) push(id, 'flow', null, 1, 0);
    } else {
      for (const slot of day.main) {
        if (slot.slot === 'wall_angel_fixed') { push('wall_angel', 'main', null, Math.max(2, D.sets - 1), 30); continue; }
        const chainId = P.pickChain(slot.slot, eq); if (!chainId) continue;
        const lv = usableLevel(chainId, eq); if (lv < 0) continue;
        push(CH[chainId].levels[lv], 'main', chainId, D.sets, D.rest);
      }
      for (const slot of day.core) {
        const chainId = P.pickChain(slot.slot, eq); const lv = usableLevel(chainId, eq); if (lv < 0) continue;
        push(CH[chainId].levels[lv], 'core', chainId, D.coreSets, 30);
      }
      for (const id of day.cooldown) if (!EX[id].equip || P.usable(id, eq)) push(id, 'cool', null, 1, 0);
    }
    return { day: dayKey, duration, items, minutes: estimate(items) };
  }

  function estimate(items) {
    let s = 0;
    for (const it of items) {
      const t = it.target;
      for (let i = 0; i < it.sets; i++) {
        if (t.kind === 'hold') s += (t.sec + 8) * (t.side ? 2 : 1);
        else s += (t.side ? 65 : 38);
        if (i < it.sets - 1) s += it.rest;
      }
      if (it.phase === 'warm') s += 10;
      if (it.phase === 'cool' || it.phase === 'flow') s += 12;
      if (it.phase === 'main' || it.phase === 'core') s += 25;
    }
    return Math.round(s / 60);
  }

  function todayDayKey() {
    const d = today();
    if (S.override[d]) return S.override[d];
    return P.WEEK[parse(d).getDay()];
  }

  const PHASE = { warm: '워밍업', main: '본운동', core: '코어', cool: '쿨다운 스트레칭', flow: '가동성 · 스트레칭' };
  function targetText(it) {
    const t = it.target;
    const sets = it.sets > 1 ? `<b>${it.sets}</b>세트 × ` : '';
    if (t.kind === 'hold') return `${sets}<b>${t.sec}</b>초${t.side ? ' · 양쪽' : ''}`;
    const r = t.min === t.max ? `<b>${t.max}</b>` : `<b>${t.min}~${t.max}</b>`;
    return `${sets}${r}${t.unit === '회' ? '회' : ' ' + t.unit}${t.side ? ' · 양쪽' : ''}`;
  }
  function figSvg(exId, opts) {
    const fr = POSES[exId]; if (!fr) return '';
    return FIG.exerciseSvg(fr, Object.assign({ alt: EX[exId].name + ' 자세' }, opts || {}));
  }
  function goalTags(ex) { return ex.goals.map((g) => `<span class="tag g" style="--g:${P.GOALS[g].color}">${P.GOALS[g].label}</span>`).join(''); }
  function cueBox(exId, withFig) {
    const ex = EX[exId];
    const yt = ex.yt ? `<a class="yt" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${encodeURIComponent(ex.yt)}">유튜브에서 영상 찾기 ↗</a>` : '';
    return `<div class="cuebox">${withFig ? `<div class="big">${figSvg(exId)}</div>` : ''}<ol>${ex.cue.map((c) => `<li>${esc(c)}</li>`).join('')}</ol><p class="why"><b>왜 하나:</b> ${esc(ex.why)}</p>${yt}</div>`;
  }
  function exCard(it, done) {
    const ex = it.ex; const lvl = it.chain != null ? `<span class="tag lvl">Lv ${it.level + 1}/${CH[it.chain].levels.length}</span>` : '';
    const check = done == null ? '' : `<button class="check ${done ? 'on' : ''}" data-check="${ex.id}" aria-pressed="${!!done}" aria-label="${esc(ex.name)} ${done ? '완료 취소' : '완료로 표시'}"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="4,12.5 9.5,18 20,6.5"/></svg></button>`;
    return `<div class="ex ${done == null ? '' : 'pick'} ${done ? 'done' : ''}"><div class="thumb">${figSvg(ex.id)}</div><div><div class="name">${esc(ex.name)}</div><div class="target">${targetText(it)}</div><div style="margin-top:4px">${lvl}${goalTags(ex)}</div></div>${check}
      <details class="cue"><summary>자세 설명 펼치기</summary>${cueBox(ex.id, true)}</details></div>`;
  }

  /* ---------- 기록/통계 ---------- */
  /* 오늘 목록의 개별 체크. 러너로 기록한 것도 '한 것'으로 봅니다. */
  function isDone(log, id) {
    if (!log) return false;
    if (log.checked && Object.prototype.hasOwnProperty.call(log.checked, id)) return !!log.checked[id];
    return !!((log.sets && log.sets[id]) || (log.holds && log.holds[id]));
  }
  function routineIds(r) { const seen = {}; const out = []; for (const it of r.items) if (!seen[it.ex.id]) { seen[it.ex.id] = 1; out.push(it.ex.id); } return out; }
  function ensureLog(d, dayKey) {
    if (!S.logs[d]) S.logs[d] = { day: dayKey, dur: S.settings.duration, t: Date.now(), mins: 0, done: false, sets: {}, holds: {}, checked: {}, setCount: 0, note: '' };
    if (!S.logs[d].checked) S.logs[d].checked = {};
    return S.logs[d];
  }
  function toggleCheck(id) {
    const d = today(); const key = todayDayKey();
    const log = ensureLog(d, key);
    log.checked[id] = !isDone(log, id);
    log.t = Date.now();
    const ids = routineIds(buildRoutine(key, S.settings.duration));
    const n = ids.filter((x) => isDone(log, x)).length;
    log.done = n >= ids.length;
    if (n === 0 && !log.setCount && !(log.note || '').trim()) delete S.logs[d];
    save();
    return n;
  }

  function streak() {
    let d = today(); let n = 0;
    if (!S.logs[d]) d = addDays(d, -1);
    while (S.logs[d]) { n++; d = addDays(d, -1); }
    return n;
  }
  function totals() {
    const logs = Object.values(S.logs);
    return { sessions: logs.length, minutes: logs.reduce((a, l) => a + (l.mins || 0), 0), sets: logs.reduce((a, l) => a + (l.setCount || 0), 0) };
  }

  /* ---------- 렌더 ---------- */
  let tab = 'today';
  const app = $('#app');
  function render() {
    applyTheme();
    $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    if (!S.onboarded && !cloudSettled && window.claude && window.claude.use) {
      app.innerHTML = `<div class="top"><h1>매일 맨몸운동</h1></div><div class="card"><p class="muted">기록을 불러오는 중…</p></div>`;
      return;
    }
    if (!S.onboarded) { app.innerHTML = viewOnboard(); bindOnboard(); return; }
    if (tab === 'today') { app.innerHTML = viewToday(); bindToday(); }
    else if (tab === 'progress') { app.innerHTML = viewProgress(); bindProgress(); }
    else if (tab === 'library') { app.innerHTML = viewLibrary(); bindLibrary(); }
    else { app.innerHTML = viewSettings(); bindSettings(); }
    window.scrollTo(0, 0);
  }
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; tab = b.dataset.tab; render(); });
  /* 체크 버튼은 한 번만 위임해 둡니다 (render마다 붙이면 핸들러가 쌓입니다). */
  app.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-check]'); if (!b || tab !== 'today') return;
    const n = toggleCheck(b.dataset.check);
    const y = window.scrollY; render(); window.scrollTo(0, y);
    if (n >= routineIds(buildRoutine(todayDayKey(), S.settings.duration)).length) toast('오늘 루틴 완료 🎉');
  });

  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }

  /* ---------- 온보딩 ---------- */
  function viewOnboard() {
    return `<div class="top"><h1>매일 맨몸운동</h1></div>
    <div class="card onb"><h2>하루 30~60분, 집에서, 장비 없이</h2>
      <p class="muted" style="margin-top:4px">근육량이 적고, 골반이 앞으로 기울어 있고, 몸이 뻣뻣한 사람을 위해 짠 프로그램입니다. 주 6일 운동 + 1일 유연성.</p>
      <div class="goals">${Object.keys(P.GOALS).map((g) => `<div style="--g:${P.GOALS[g].color}"><b>${P.GOALS[g].label}</b>${P.GOALS[g].desc}</div>`).join('')}</div>
      <h3>하루에 얼마나?</h3>
      <div class="seg" id="onb-dur" style="margin:8px 0 14px">${[30, 45, 60].map((d) => `<button data-d="${d}" class="${S.settings.duration === d ? 'on' : ''}">${d}분</button>`).join('')}</div>
      <h3>집에 있는 것</h3>
      <p class="muted small" style="margin-bottom:6px">없는 건 자동으로 다른 운동으로 바꿔줍니다. 나중에 설정에서 바꿀 수 있어요.</p>
      <div id="onb-eq">${Object.keys(P.EQUIP).map((k) => `<div class="opt"><div class="l"><b>${P.EQUIP[k].label}</b><span>${P.EQUIP[k].hint}</span></div><button class="switch ${S.settings.eq[k] ? 'on' : ''}" data-eq="${k}" role="switch" aria-checked="${!!S.settings.eq[k]}" aria-label="${P.EQUIP[k].label}"></button></div>`).join('')}</div>
      <button class="btn primary" id="onb-go" style="margin-top:16px">오늘 루틴 보기</button>
    </div>
    <div class="card"><h3>어떻게 진행되나</h3><p class="small muted" style="margin-top:6px">월·목 푸시(어깨·가슴) / 화·금 풀(등) / 수·토 하체(골반) / 일 유연성. 매일 워밍업 6개 → 본운동 4~5개 → 코어 → 골반전방경사 교정 스트레칭. 목표 개수를 다 채우면 다음 단계 운동을 제안합니다.</p></div>`;
  }
  function bindOnboard() {
    $('#onb-dur').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; S.settings.duration = +b.dataset.d; $$('#onb-dur button').forEach((x) => x.classList.toggle('on', x === b)); });
    $('#onb-eq').addEventListener('click', (e) => { const b = e.target.closest('.switch'); if (!b) return; const k = b.dataset.eq; S.settings.eq[k] = !S.settings.eq[k]; b.classList.toggle('on', S.settings.eq[k]); b.setAttribute('aria-checked', String(S.settings.eq[k])); });
    $('#onb-go').addEventListener('click', () => { S.onboarded = true; S.settings.started = today(); save(); render(); });
  }

  /* ---------- 오늘 ---------- */
  function viewToday() {
    const d = today(); const key = todayDayKey(); const day = P.DAYS[key]; const log = S.logs[d];
    const r = buildRoutine(key, S.settings.duration);
    const st = streak(); const tt = totals();
    const dayColor = `--day:var(--${key})`;
    let html = `<div class="top"><h1>오늘</h1><span class="date">${fmtDate(d)} · ${weeksIn() + 1}주차</span></div>`;
    if (memMode) html += `<div class="card" style="border-color:var(--no)"><b>저장이 안 되는 브라우저입니다.</b><p class="small muted">시크릿 모드이거나 저장이 막혀 있습니다. 기록이 남지 않아요.</p></div>`;
    html += `<div class="card hero" style="${dayColor}"><div class="kicker">${key === 'mobility' ? '일요일 · 회복' : WD[parse(d).getDay()] + '요일'} · ${P.DURATION[S.settings.duration].label}</div><h2>${day.name}<span class="muted" style="font-weight:600;font-size:16px;margin-left:8px">${day.sub}</span></h2><p class="intro">${day.intro}</p>
      <div class="stats"><div><b>${st}</b><span>연속 일수</span></div><div><b>${tt.sessions}</b><span>총 운동 횟수</span></div><div><b>${r.minutes}</b><span>예상 분</span></div></div>`;
    const ids = routineIds(r); const doneN = ids.filter((x) => isDone(log, x)).length;
    html += `<div class="todaybar"><div class="pbar"><i style="width:${Math.round((doneN / ids.length) * 100)}%"></i></div><span class="num" id="progcount">${doneN}/${ids.length}</span></div>`;
    if (doneN >= ids.length) {
      html += `<div class="okbanner">오늘 다 했습니다 ✓${log && log.mins ? ` &nbsp;<span class="num">${log.mins}분 · ${log.setCount}세트</span>` : ''}</div>
        <button class="btn secondary" id="start" style="margin-top:10px">한 번 더 하기</button>`;
    } else {
      html += `<button class="btn primary" id="start" style="margin-top:12px">${doneN > 0 ? '남은 것부터 이어하기' : '운동 시작'}</button>`;
    }
    html += `<div class="chips" id="daychips">${Object.keys(P.DAYS).map((k) => `<button class="chip day-${k} ${k === key ? 'on' : ''}" data-day="${k}">${P.DAYS[k].name}</button>`).join('')}
      <button class="chip ${S.settings.duration === 30 ? 'on' : ''}" id="quick30">${S.settings.duration === 30 ? '30분 모드' : '오늘은 30분만'}</button></div></div>`;

    const groups = [];
    for (const it of r.items) { const g = groups[groups.length - 1]; if (g && g.phase === it.phase) g.items.push(it); else groups.push({ phase: it.phase, items: [it] }); }
    for (const g of groups) {
      const gd = g.items.filter((it) => isDone(log, it.ex.id)).length;
      html += `<div class="section-h"><h2>${PHASE[g.phase]}</h2><span class="num">${gd}/${g.items.length}</span></div>`;
      html += g.items.map((it) => exCard(it, isDone(log, it.ex.id))).join('');
    }
    html += `<p class="muted small" style="margin:14px 4px">동그라미를 누르면 그 운동은 했다고 표시되고 위 진행에 반영됩니다. 그림은 옆에서 본 모습(일부는 위에서 본 모습)이고, 짙은 선이 앞쪽 팔다리입니다.</p>`;
    return html;
  }
  function bindToday() {
    const s = $('#start'); if (s) s.addEventListener('click', () => startRunner(buildRoutine(todayDayKey(), S.settings.duration)));
    $('#daychips').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'quick30') { S.settings.duration = S.settings.duration === 30 ? 45 : 30; save(); render(); toast(S.settings.duration === 30 ? '30분 모드' : '45분 모드'); return; }
      const k = b.dataset.day; const d = today();
      if (k === P.WEEK[parse(d).getDay()]) delete S.override[d]; else S.override[d] = k;
      save(); render();
    });
  }

  /* ---------- 러너 ---------- */
  let R = null; // runner state
  let wakeLock = null;
  function beep(n) {
    try {
      const ctx = beep.ctx || (beep.ctx = new (window.AudioContext || window.webkitAudioContext)());
      for (let i = 0; i < (n || 1); i++) {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = i === (n || 1) - 1 ? 1046 : 880;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
        g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + i * 0.22 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.18);
        o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * 0.22); o.stop(ctx.currentTime + i * 0.22 + 0.2);
      }
    } catch (e) { /* 무음 */ }
    try { navigator.vibrate && navigator.vibrate(n > 1 ? [150, 80, 150, 80, 250] : 120); } catch (e) { /* */ }
  }
  async function lockScreen() { try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* */ } }
  function unlockScreen() { try { wakeLock && wakeLock.release(); } catch (e) { /* */ } wakeLock = null; }
  document.addEventListener('visibilitychange', () => { if (R && document.visibilityState === 'visible') lockScreen(); });

  function startRunner(routine) {
    try { beep.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (beep.ctx.state === 'suspended') beep.ctx.resume(); } catch (e) { /* */ }
    /* 이미 체크해 둔 운동은 건너뛰고 첫 남은 것부터 시작합니다. */
    const dl = S.logs[today()];
    let start = 0;
    while (start < routine.items.length && isDone(dl, routine.items[start].ex.id)) start++;
    if (start >= routine.items.length) start = 0;
    R = { r: routine, i: start, set: 0, side: 0, mode: 'work', res: routine.items.map(() => ({ reps: [], holds: [] })), startedAt: Date.now(), timer: null, endAt: 0, remain: 0, frame: 0, anim: null, reps: null };
    lockScreen();
    const el = document.createElement('div'); el.className = 'runner'; el.id = 'runner';
    el.style.setProperty('--day', `var(--${routine.day})`);
    document.body.appendChild(el); document.body.style.overflow = 'hidden';
    renderRunner();
  }
  function closeRunner() {
    clearInterval(R && R.timer); clearInterval(R && R.anim); unlockScreen();
    const el = $('#runner'); if (el) el.remove(); document.body.style.overflow = ''; R = null;
  }
  function curItem() { return R.r.items[R.i]; }
  function lastReps(exId) {
    const days = Object.keys(S.logs).sort().reverse();
    for (const d of days) { const l = S.logs[d]; if (l.sets && l.sets[exId] && l.sets[exId].length) return Math.max.apply(null, l.sets[exId]); }
    return null;
  }

  function renderRunner() {
    const el = $('#runner'); if (!el || !R) return;
    clearInterval(R.anim); R.anim = null;
    const it = curItem(); const ex = it.ex; const t = it.target; const n = R.r.items.length;
    const pct = Math.round(((R.i + (R.set / it.sets)) / n) * 100);
    const frames = POSES[ex.id] || [];
    let stage;
    if (frames.length > 1) {
      stage = `<div class="anim">${frames.map((f, k) => `<div class="fr ${k === 0 ? '' : 'hide'}" data-k="${k}">${FIG.exerciseSvg([f], { labels: [k === 0 ? '시작' : k === frames.length - 1 ? '끝' : String(k + 1)] })}</div>`).join('')}</div>`;
    } else stage = figSvg(ex.id);
    const lvl = it.chain != null ? `<span class="tag lvl">Lv ${it.level + 1}/${CH[it.chain].levels.length}</span>` : '';
    let controls = '';
    const setdots = it.sets > 1 ? `<div class="setdots">${Array.from({ length: it.sets }, (_, k) => `<i class="${k < R.set ? 'done' : ''} ${k === R.set ? 'cur' : ''}"></i>`).join('')}</div>` : '';
    if (R.mode === 'rest') {
      controls = `<div class="timer rest"><div class="t num" id="tval">${fmtSec(R.remain)}</div><div class="lbl">휴식 · 다음: ${R.set < it.sets ? `${R.set + 1}세트` : '다음 운동'}</div></div>${setdots}
        <div class="row"><button class="btn secondary" id="plus15">+15초</button><button class="btn" id="skiprest">휴식 끝</button></div>`;
    } else if (t.kind === 'hold') {
      const sideTxt = t.side ? `<div class="side">${R.side === 0 ? '왼쪽' : '오른쪽'} (${R.side + 1}/2)</div>` : '';
      if (R.mode === 'timer') {
        controls = `${sideTxt}<div class="timer go"><div class="t num" id="tval">${fmtSec(R.remain)}</div><div class="lbl">버티기 · 길게 내쉬기</div></div>${setdots}
          <button class="btn secondary" id="stophold">여기까지만 (버틴 시간만 기록)</button>`;
      } else {
        controls = `${sideTxt}<div class="timer"><div class="t num">${fmtSec(t.sec)}</div><div class="lbl">준비되면 시작</div></div>${setdots}
          <button class="btn primary" id="starthold">타이머 시작</button><button class="btn ghost" id="markhold">타이머 없이 완료로 표시</button>`;
      }
    } else {
      if (R.reps == null) { const lr = lastReps(ex.id); R.reps = lr != null ? Math.min(t.max + 3, Math.max(t.min - 2, lr)) : t.max; if (R.reps < 1) R.reps = t.max; }
      controls = `<div class="stepper"><button id="dec" aria-label="줄이기">−</button><div><div class="v num" id="rv">${R.reps}</div><div class="u">${t.unit}${t.side ? ' · 각 방향' : ''}</div></div><button id="inc" aria-label="늘리기">+</button></div>${setdots}
        <button class="btn primary" id="doneset">${it.sets > 1 ? `${R.set + 1}세트 완료` : '완료'}</button>`;
    }
    el.innerHTML = `<div class="inner">
      <div class="bar"><button id="exit" aria-label="나가기">✕ 나가기</button><div class="prog"><i style="width:${pct}%"></i></div><span class="small num muted">${R.i + 1}/${n}</span></div>
      <div class="phase">${PHASE[it.phase]}</div><h2>${esc(ex.name)}</h2>
      <div class="tgt">${targetText(it)} &nbsp;${lvl}</div>
      <div class="stage">${stage}</div>
      <div class="cues"><ol><li>${esc(ex.cue[0])}</li></ol><details class="cue"><summary>자세 설명 펼치기</summary>${cueBox(ex.id, false)}</details></div>
      <div class="controls">${controls}
        <div class="linkrow"><button id="prev" ${R.i === 0 && R.set === 0 ? 'disabled' : ''}>← 이전</button><button id="skip">이 운동 건너뛰기 →</button></div></div></div>`;

    if (frames.length > 1) {
      R.frame = 0;
      R.anim = setInterval(() => {
        if (!R) return; R.frame = (R.frame + 1) % frames.length;
        $$('#runner .fr').forEach((f) => f.classList.toggle('hide', +f.dataset.k !== R.frame));
      }, frames.length === 2 ? 1300 : 1100);
    }
    $('#exit').onclick = exitRunner;
    $('#skip').onclick = () => { R.set = 0; R.side = 0; R.reps = null; next(); };
    $('#prev').onclick = () => { clearInterval(R.timer); if (R.mode === 'rest') { R.mode = 'work'; } else if (R.set > 0) { R.set--; R.res[R.i].reps.pop(); R.res[R.i].holds.pop(); } else if (R.i > 0) { R.i--; R.set = Math.max(0, R.r.items[R.i].sets - 1); R.res[R.i].reps.pop(); R.res[R.i].holds.pop(); } R.mode = 'work'; R.side = 0; R.reps = null; renderRunner(); };
    const q = (id) => $('#' + id);
    if (q('inc')) { q('inc').onclick = () => { R.reps++; q('rv').textContent = R.reps; }; q('dec').onclick = () => { R.reps = Math.max(0, R.reps - 1); q('rv').textContent = R.reps; }; }
    if (q('doneset')) q('doneset').onclick = () => { R.res[R.i].reps.push(R.reps); finishSet(); };
    if (q('starthold')) q('starthold').onclick = () => startCountdown(t.sec, 'timer', () => { beep(2); R.res[R.i].holds.push(t.sec); afterHoldSide(); });
    if (q('markhold')) q('markhold').onclick = () => { R.res[R.i].holds.push(t.sec); afterHoldSide(); };
    if (q('stophold')) q('stophold').onclick = () => { clearInterval(R.timer); R.res[R.i].holds.push(Math.max(0, t.sec - R.remain)); afterHoldSide(); };
    if (q('skiprest')) q('skiprest').onclick = () => { clearInterval(R.timer); R.mode = 'work'; renderRunner(); };
    if (q('plus15')) q('plus15').onclick = () => { R.endAt += 15000; };
    if (R.mode === 'rest' && !R.timer) startCountdown(R.remain, 'rest', () => { beep(1); R.mode = 'work'; renderRunner(); });
  }
  function fmtSec(s) { s = Math.max(0, Math.ceil(s)); return s >= 60 ? Math.floor(s / 60) + ':' + pad(s % 60) : String(s); }
  function startCountdown(sec, mode, done) {
    clearInterval(R.timer); R.mode = mode; R.remain = sec; R.endAt = Date.now() + sec * 1000;
    if (mode === 'timer') renderRunner();
    R.timer = setInterval(() => {
      if (!R) return;
      R.remain = (R.endAt - Date.now()) / 1000;
      const tv = $('#tval'); if (tv) tv.textContent = fmtSec(R.remain);
      if (R.remain <= 0) { clearInterval(R.timer); R.timer = null; done(); }
    }, 200);
  }
  function afterHoldSide() {
    const it = curItem();
    if (it.target.side && R.side === 0) { R.side = 1; R.mode = 'work'; renderRunner(); return; }
    R.side = 0; finishSet();
  }
  function finishSet() {
    const it = curItem(); R.set++; R.mode = 'work';
    if (R.set < it.sets) {
      if (it.rest > 0) { R.remain = it.rest; R.mode = 'rest'; R.timer = null; renderRunner(); return; }
      renderRunner(); return;
    }
    R.set = 0; R.reps = null; next();
  }
  function next() {
    clearInterval(R.timer); R.timer = null;
    if (R.i + 1 >= R.r.items.length) { finishSession(); return; }
    R.i++; R.mode = 'work'; R.side = 0; R.reps = null; renderRunner();
  }
  function exitRunner() {
    const done = R.res.filter((x) => x.reps.length || x.holds.length).length;
    if (done === 0) { closeRunner(); return; }
    if (confirm('운동을 중단할까요? 지금까지 한 부분은 기록됩니다.')) finishSession(true);
  }

  /* ---------- 세션 마무리 + 진행 판단 ---------- */
  function finishSession(partial) {
    clearInterval(R.timer); clearInterval(R.anim);
    const r = R.r; const mins = Math.max(1, Math.round((Date.now() - R.startedAt) / 60000));
    const d = today(); const prev = S.logs[d];
    const log = { day: r.day, dur: r.duration, t: Date.now(), mins: (prev ? prev.mins : 0) + mins, done: false, sets: prev ? prev.sets || {} : {}, holds: prev ? prev.holds || {} : {}, checked: prev ? prev.checked || {} : {}, setCount: prev ? prev.setCount || 0 : 0, note: prev ? prev.note : '' };
    const suggestions = [];
    r.items.forEach((it, k) => {
      const res = R.res[k]; const arr = it.target.kind === 'hold' ? res.holds : res.reps; if (!arr.length) return;
      (it.target.kind === 'hold' ? log.holds : log.sets)[it.ex.id] = ((it.target.kind === 'hold' ? log.holds : log.sets)[it.ex.id] || []).concat(arr);
      log.setCount += arr.length;
      delete log.checked[it.ex.id]; // 방금 실제로 했으므로 수동 해제 표시를 지웁니다

      if (!it.chain || (it.phase !== 'main' && it.phase !== 'core')) return;
      const full = arr.length >= it.sets;
      let clear = false, fail = false;
      if (it.target.kind === 'hold') { clear = full && arr.every((s) => s >= it.target.sec); fail = arr.some((s) => s < it.target.sec * 0.6); }
      else { clear = full && arr.every((x) => x >= it.target.max); fail = arr.some((x) => x < it.target.min); }
      const pg = S.prog[it.chain] || { clears: 0, fails: 0, lv: it.level };
      if (pg.lv !== it.level) { pg.clears = 0; pg.fails = 0; pg.lv = it.level; }
      if (clear) { pg.clears++; pg.fails = 0; } else if (fail) { pg.fails++; pg.clears = 0; } else { pg.clears = 0; }
      S.prog[it.chain] = pg;
      const c = CH[it.chain];
      if (pg.clears >= 2) {
        let nx = it.level + 1; while (nx < c.levels.length && !P.usable(c.levels[nx], S.settings.eq)) nx++;
        if (nx < c.levels.length) suggestions.push({ chain: it.chain, to: nx, up: true, from: it.ex.name, toName: EX[c.levels[nx]].name });
        else suggestions.push({ chain: it.chain, up: true, maxed: true, from: it.ex.name });
      } else if (pg.fails >= 2 && it.level > 0) {
        let nx = it.level - 1; while (nx >= 0 && !P.usable(c.levels[nx], S.settings.eq)) nx--;
        if (nx >= 0) suggestions.push({ chain: it.chain, to: nx, up: false, from: it.ex.name, toName: EX[c.levels[nx]].name });
      }
    });
    log.done = routineIds(r).every((x) => isDone(log, x));
    S.logs[d] = log; save();
    closeRunner();
    showSummary(log, mins, suggestions, partial);
  }
  function showSummary(log, mins, sug, partial) {
    const el = document.createElement('div'); el.className = 'runner'; el.id = 'runner';
    const st = streak();
    el.innerHTML = `<div class="inner"><div class="top"><h1>${partial ? '기록됨' : '오늘 완료'}</h1><span class="date">${fmtDate(today())}</span></div>
      <div class="card summary" style="--day:var(--${log.day})"><div class="big">${mins}<span style="font-size:20px">분</span></div><p class="muted">${P.DAYS[log.day].name} · ${log.setCount}세트 · 연속 ${st}일</p>
        ${st > 0 && st % 7 === 0 ? `<p style="margin-top:8px;font-weight:700;color:var(--ok)">🎉 ${st}일 연속! 이 주기가 몸을 바꿉니다.</p>` : ''}
      </div>
      ${sug.length ? `<div class="card"><h2>레벨 제안</h2><p class="muted small" style="margin-bottom:10px">2회 연속 목표를 채웠거나(↑) 2회 연속 최소 개수에 못 미쳤습니다(↓).</p>
        ${sug.map((s, k) => `<div class="lvlup" id="sug${k}"><b>${s.up ? '↑' : '↓'} ${esc(s.from)}</b>${s.maxed ? '<span class="small">이 체인의 마지막 단계입니다. 세트를 늘리거나 내려갈 때 3초 템포로 하세요.</span>' : `<span class="small">→ ${esc(s.toName)}</span><div class="row"><button class="btn sm secondary" data-k="${k}" data-act="keep">유지</button><button class="btn sm" data-k="${k}" data-act="apply">${s.up ? '다음 단계로' : '한 단계 낮추기'}</button></div>`}</div>`).join('')}</div>` : ''}
      <div class="card form"><label>메모 (선택)</label><textarea class="note-in" id="note" placeholder="어디가 아팠는지, 어떤 동작이 쉬웠는지">${esc(log.note || '')}</textarea>
        <button class="btn primary" id="close" style="margin-top:12px">닫기</button></div></div>`;
    document.body.appendChild(el); document.body.style.overflow = 'hidden';
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      const s = sug[+b.dataset.k];
      if (b.dataset.act === 'apply') { S.levels[s.chain] = s.to; S.prog[s.chain] = { clears: 0, fails: 0, lv: s.to }; save(); toast(s.up ? '레벨 업!' : '한 단계 낮췄습니다'); }
      else { S.prog[s.chain] = { clears: 0, fails: 0, lv: (S.prog[s.chain] || {}).lv }; save(); }
      $('#sug' + b.dataset.k).innerHTML = `<b>${b.dataset.act === 'apply' ? '✓ 적용됨' : '유지'}</b>`;
    });
    $('#close', el).onclick = () => { const lg = S.logs[today()]; lg.note = $('#note').value.trim(); lg.t = Date.now(); save(); el.remove(); document.body.style.overflow = ''; tab = 'today'; render(); };
  }

  /* ---------- 진행 ---------- */
  function viewProgress() {
    const d = today(); const mon = mondayOf(d); const tt = totals(); const st = streak();
    const week = Array.from({ length: 7 }, (_, k) => { const ds = addDays(mon, k); const l = S.logs[ds]; return `<div><i class="${l ? (l.done ? 'done' : 'skip') : ''} ${ds === d ? 'today' : ''}"></i>${WD[(k + 1) % 7]}</div>`; }).join('');
    const start = addDays(mon, -77);
    let heat = '';
    for (let c = 0; c < 12; c++) { heat += '<div class="col">'; for (let r = 0; r < 7; r++) { const ds = addDays(start, c * 7 + r); const l = S.logs[ds]; heat += `<i class="${l ? (l.done ? 'd2' : 'd1') : ''} ${ds > d ? 'future' : ''}" title="${ds}"></i>`; } heat += '</div>'; }
    const eq = S.settings.eq;
    const activeChains = new Set();
    for (const k of ['push', 'pull', 'legs']) for (const s of P.DAYS[k].main.concat(P.DAYS[k].core)) { const c = P.pickChain(s.slot, eq); if (c) activeChains.add(c); }
    const lvRows = Array.from(activeChains).map((cid) => {
      const c = CH[cid]; const lv = usableLevel(cid, eq); const pg = S.prog[cid] || { clears: 0 };
      return `<tr><td>${esc(c.name)}</td><td><div class="lv"><button data-c="${cid}" data-d="-1" aria-label="낮추기" ${lv <= 0 ? 'disabled' : ''}>−</button><div style="flex:1"><div>${lv >= 0 ? esc(EX[c.levels[lv]].name) : '<span class="muted">장비 없음</span>'} <span class="muted small num">${lv + 1}/${c.levels.length}${pg.clears ? ' · 달성 ' + pg.clears + '/2' : ''}</span></div><div class="bar">${c.levels.map((_, k) => `<i class="${k <= lv ? 'on' : ''}"></i>`).join('')}</div></div><button data-c="${cid}" data-d="1" aria-label="올리기" ${lv >= c.levels.length - 1 ? 'disabled' : ''}>+</button></div></td></tr>`;
    }).join('');
    const testRows = P.TESTS.map((t) => testRow(t, S.tests)).join('');
    const bodyRows = BODY.map((t) => testRow(t, S.body)).join('');
    const lastTest = S.tests.length ? S.tests[S.tests.length - 1].d : null;
    const due = !lastTest || daysBetween(lastTest, d) >= 14;
    return `<div class="top"><h1>진행</h1><span class="date">${weeksIn() + 1}주차</span></div>
      <div class="card"><div class="stats" style="margin-top:0"><div><b>${st}</b><span>연속 일수</span></div><div><b>${tt.sessions}</b><span>총 횟수</span></div><div><b>${Math.round(tt.minutes / 60 * 10) / 10}</b><span>총 시간</span></div></div>
        <div class="week">${week}</div>
        <div class="heat">${heat}</div><p class="muted small" style="margin-top:6px">최근 12주 · 열 하나가 한 주(월~일)</p></div>
      <div class="card"><h2>현재 레벨</h2><p class="muted small" style="margin-bottom:6px">목표 상한을 모든 세트에서 2회 연속 채우면 자동으로 다음 단계를 제안합니다. 직접 조절도 가능.</p><table class="lvltable" id="lvtable">${lvRows}</table></div>
      <div class="card tests"><h2>유연성 측정 ${due ? '<span class="tag" style="background:var(--warnbg);color:var(--warn)">측정할 때</span>' : ''}</h2><p class="muted small">2주마다. 운동 후 몸이 따뜻할 때 같은 조건으로.${lastTest ? ' 마지막: ' + fmtDate(lastTest) : ''}</p>
        ${S.tests.length ? testRows : '<p class="empty">아직 기록이 없어요. 첫 측정을 남겨두면 변화가 보입니다.</p>'}
        <button class="btn secondary" id="addtest" style="margin-top:10px">측정 기록하기</button></div>
      <div class="card tests"><h2>몸 치수</h2><p class="muted small">월 1회면 충분. 어깨 둘레 ↑ 허리 둘레 ↓ 가 옷태의 수치입니다.</p>
        ${S.body.length ? bodyRows : '<p class="empty">아직 기록이 없어요.</p>'}
        <button class="btn secondary" id="addbody" style="margin-top:10px">치수 기록하기</button></div>
      <div class="card"><h2>최근 기록</h2>${recentLogs()}</div>`;
  }
  function testRow(t, arr) {
    const vals = arr.filter((x) => x[t.id] != null && x[t.id] !== '').map((x) => ({ d: x.d, v: +x[t.id] }));
    if (!vals.length) return '';
    const last = vals[vals.length - 1]; const prev = vals.length > 1 ? vals[vals.length - 2] : null;
    let delta = '';
    if (prev) { const df = Math.round((last.v - prev.v) * 10) / 10; if (df !== 0) { const good = t.lowerBetter ? df < 0 : df > 0; delta = `<span class="delta ${good ? 'good' : 'bad'}">${df > 0 ? '+' : ''}${df}</span>`; } }
    return `<div class="t"><div><div class="small muted">${esc(t.name)}</div><div class="v">${last.v}<small>${t.unit}</small>${delta}</div></div>${spark(vals.slice(-8).map((x) => x.v))}</div>`;
  }
  function spark(v) {
    if (v.length < 2) return '<svg class="spark" viewBox="0 0 90 28"></svg>';
    const mn = Math.min.apply(null, v), mx = Math.max.apply(null, v); const rg = mx - mn || 1;
    const pts = v.map((x, i) => [4 + (i * 82) / (v.length - 1), 24 - ((x - mn) / rg) * 20]);
    return `<svg class="spark" viewBox="0 0 90 28"><path d="M${pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L')}"/><circle cx="${pts[pts.length - 1][0].toFixed(1)}" cy="${pts[pts.length - 1][1].toFixed(1)}" r="2.2"/></svg>`;
  }
  function recentLogs() {
    const days = Object.keys(S.logs).sort().reverse().slice(0, 10);
    if (!days.length) return '<p class="empty">아직 없음</p>';
    return `<table class="lvltable">${days.map((d) => { const l = S.logs[d]; return `<tr><td>${fmtDate(d)}</td><td><span class="tag" style="background:var(--${l.day});color:#fff">${P.DAYS[l.day].name}</span> <span class="num">${l.mins}분 · ${l.setCount}세트</span>${l.done ? '' : ' <span class="muted small">(일부)</span>'}${l.note ? `<div class="small muted">${esc(l.note)}</div>` : ''}</td></tr>`; }).join('')}</table>`;
  }
  function bindProgress() {
    $('#lvtable').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-c]'); if (!b) return;
      const cid = b.dataset.c; const c = CH[cid]; let lv = usableLevel(cid, S.settings.eq) + (+b.dataset.d);
      while (lv >= 0 && lv < c.levels.length && !P.usable(c.levels[lv], S.settings.eq)) lv += (+b.dataset.d);
      if (lv < 0 || lv >= c.levels.length) { toast('장비가 필요한 단계입니다'); return; }
      S.levels[cid] = lv; S.prog[cid] = { clears: 0, fails: 0, lv }; save(); render(); toast(EX[c.levels[lv]].name);
    });
    $('#addtest').addEventListener('click', () => openForm('유연성 측정', P.TESTS, S.tests));
    $('#addbody').addEventListener('click', () => openForm('몸 치수', BODY, S.body));
  }
  function openForm(title, fields, arr) {
    const last = arr[arr.length - 1] || {};
    const el = document.createElement('div'); el.className = 'runner'; el.id = 'runner';
    el.innerHTML = `<div class="inner"><div class="top"><h1>${title}</h1><button class="btn ghost sm" id="cancel">닫기</button></div>
      <div class="card form"><label>날짜</label><input type="date" id="f-d" value="${today()}">
      ${fields.map((f) => `<label>${esc(f.name)} (${f.unit})</label><input type="number" step="0.5" inputmode="decimal" id="f-${f.id}" placeholder="${last[f.id] != null ? '지난번 ' + last[f.id] : ''}">${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}`).join('')}
      <button class="btn primary" id="savef" style="margin-top:16px">저장</button><p class="muted small" style="margin-top:8px">비워둔 항목은 기록되지 않습니다.</p></div></div>`;
    document.body.appendChild(el); document.body.style.overflow = 'hidden';
    const close = () => { el.remove(); document.body.style.overflow = ''; };
    $('#cancel', el).onclick = close;
    $('#savef', el).onclick = () => {
      const rec = { d: $('#f-d', el).value || today() }; let any = false;
      for (const f of fields) { const v = $('#f-' + f.id, el).value; if (v !== '') { rec[f.id] = +v; any = true; } }
      if (!any) { toast('값을 하나 이상 입력하세요'); return; }
      arr.push(rec); arr.sort((a, b) => (a.d < b.d ? -1 : 1)); save(); close(); render(); toast('저장됨');
    };
  }

  /* ---------- 운동사전 ---------- */
  let libFilter = 'all', libQ = '';
  function viewLibrary() {
    const eq = S.settings.eq;
    const chips = [['all', '전체']].concat(Object.keys(P.GOALS).map((g) => [g, P.GOALS[g].label]));
    let html = `<div class="top"><h1>운동사전</h1><span class="date">${Object.keys(EX).length}개</span></div>
      <input class="search" id="q" type="search" placeholder="이름으로 찾기" value="${esc(libQ)}">
      <div class="filter" id="filter">${chips.map(([k, l]) => `<button class="chip ${libFilter === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>`;
    const match = (id) => { const ex = EX[id]; if (libFilter !== 'all' && !ex.goals.includes(libFilter)) return false; if (libQ && !(ex.name + ex.en).toLowerCase().includes(libQ.toLowerCase())) return false; return true; };
    const inChain = new Set();
    for (const cid of Object.keys(CH)) {
      const c = CH[cid]; const ids = c.levels.filter(match); c.levels.forEach((id) => inChain.add(id)); if (!ids.length) continue;
      const cur = usableLevel(cid, eq);
      html += `<div class="chain-h"><h3>${esc(c.name)}</h3><span>${c.levels.length}단계 진행</span></div>`;
      html += c.levels.map((id, k) => match(id) ? libCard(id, k, cur === k, c.levels.length) : '').join('');
    }
    const rest = Object.keys(EX).filter((id) => !inChain.has(id) && match(id));
    if (rest.length) { html += `<div class="chain-h"><h3>워밍업 · 스트레칭</h3><span>${rest.length}개</span></div>`; html += rest.map((id) => libCard(id)).join(''); }
    return html;
  }
  function libCard(id, k, cur, total) {
    const ex = EX[id]; const eq = S.settings.eq;
    const need = ex.equip && !P.usable(id, eq) ? `<span class="tag" style="background:var(--nobg);color:var(--no)">${ex.equip.map((e) => P.EQUIP[e].label).join('·')} 필요</span>` : '';
    const lvl = k != null ? `<span class="tag lvl">Lv ${k + 1}/${total}${cur ? ' · 현재' : ''}</span>` : '';
    const tgt = ex.type.startsWith('hold') ? `${ex.target}초${ex.type === 'hold_side' ? ' · 양쪽' : ''}` : `${ex.target[0]}~${ex.target[1]}${ex.unit || '회'}${ex.type === 'reps_side' ? ' · 양쪽' : ''}`;
    return `<div class="ex ${cur ? 'cur' : ''}"><div class="thumb">${figSvg(id)}</div><div><div class="name">${esc(ex.name)} <span class="muted small" style="font-weight:500">${esc(ex.en)}</span></div><div class="target">목표 <b>${tgt}</b></div><div style="margin-top:4px">${lvl}${goalTags(ex)}${need}</div></div>
      <details class="cue"><summary>자세 설명 펼치기</summary>${cueBox(id, true)}</details></div>`;
  }
  function bindLibrary() {
    $('#filter').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; libFilter = b.dataset.f; render(); });
    const q = $('#q'); let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { libQ = q.value.trim(); const y = window.scrollY; render(); window.scrollTo(0, y); $('#q').focus(); }, 250); });
  }

  /* ---------- 설정 ---------- */
  function viewSettings() {
    const s = S.settings;
    return `<div class="top"><h1>설정</h1></div>
      <div class="card"><h2>하루 운동 시간</h2><div class="seg" id="dur" style="margin-top:8px">${[30, 45, 60].map((d) => `<button data-d="${d}" class="${s.duration === d ? 'on' : ''}">${d}분</button>`).join('')}</div><p class="muted small" style="margin-top:8px">30분: 2세트 · 45분: 3세트 · 60분: 4세트 + 긴 스트레칭. 오늘 화면에서 "오늘은 30분만"으로 그날만 바꿀 수도 있습니다.</p></div>
      <div class="card"><h2>장비</h2><div id="eq">${Object.keys(P.EQUIP).map((k) => `<div class="opt"><div class="l"><b>${P.EQUIP[k].label}</b><span>${P.EQUIP[k].hint}</span></div><button class="switch ${s.eq[k] ? 'on' : ''}" data-eq="${k}" role="switch" aria-checked="${!!s.eq[k]}" aria-label="${P.EQUIP[k].label}"></button></div>`).join('')}</div></div>
      <div class="card"><h2>화면</h2><div class="seg" id="theme" style="margin-top:8px">${[['auto', '자동'], ['light', '밝게'], ['dark', '어둡게']].map(([k, l]) => `<button data-t="${k}" class="${(s.theme || 'auto') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="opt" style="margin-top:8px"><div class="l"><b>시작일</b><span>주차 계산과 스트레칭 시간 증가의 기준</span></div><input type="date" id="started" value="${s.started}" style="width:auto"></div></div>
      <div class="card"><h2>홈 화면에 추가</h2><p class="small muted" style="margin-top:4px">iPhone: Safari 공유 버튼 → "홈 화면에 추가". Android: Chrome 메뉴 → "앱 설치" 또는 "홈 화면에 추가". 앱처럼 열리고 오프라인에서도 됩니다.</p></div>
      <div class="card"><details><summary style="font-weight:800;font-size:17px">이 프로그램의 원리 ▾</summary><div style="margin-top:10px">${P.PRINCIPLES.map((p) => `<div class="principle"><b>${esc(p.h)}</b><p>${esc(p.p)}</p></div>`).join('')}</div></details></div>
      <div class="card"><h2>저장과 백업</h2><p class="small muted" id="syncline">${syncText()}</p>
        <p class="small muted" style="margin-top:6px">어느 쪽이든 내보내기로 한 번씩 복사해 두면 안전합니다.</p>
        <div class="row" style="margin-top:10px"><button class="btn secondary sm" id="exp">내보내기</button><button class="btn secondary sm" id="imp">가져오기</button></div>
        <div id="iobox" style="display:none;margin-top:10px"><textarea class="io" id="io"></textarea><div class="row" style="margin-top:8px"><button class="btn sm secondary" id="copy">복사</button><button class="btn sm" id="apply" style="display:none">이 데이터로 덮어쓰기</button></div></div></div>
      <div class="card"><h2>초기화</h2><button class="btn danger" id="reset" style="margin-top:8px">모든 기록 삭제</button></div>
      <p class="muted small" style="text-align:center;margin:10px 0">${memMode ? '이 브라우저는 저장이 막혀 있습니다 · ' : ''}의학적 조언이 아닙니다. 통증이 있으면 멈추세요.</p>`;
  }
  function bindSettings() {
    $('#dur').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; S.settings.duration = +b.dataset.d; save(); render(); });
    $('#theme').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; S.settings.theme = b.dataset.t; save(); render(); });
    $('#eq').addEventListener('click', (e) => { const b = e.target.closest('.switch'); if (!b) return; const k = b.dataset.eq; S.settings.eq[k] = !S.settings.eq[k]; save(); b.classList.toggle('on', S.settings.eq[k]); b.setAttribute('aria-checked', String(S.settings.eq[k])); });
    $('#started').addEventListener('change', (e) => { if (e.target.value) { S.settings.started = e.target.value; save(); toast('저장됨'); } });
    $('#exp').onclick = () => { $('#iobox').style.display = ''; $('#apply').style.display = 'none'; $('#io').value = JSON.stringify(S); };
    $('#imp').onclick = () => { $('#iobox').style.display = ''; $('#apply').style.display = ''; $('#io').value = ''; $('#io').placeholder = '내보낸 데이터를 붙여넣기'; };
    $('#copy').onclick = async () => { try { await navigator.clipboard.writeText($('#io').value); toast('복사됨'); } catch (e) { $('#io').select(); toast('직접 복사하세요'); } };
    $('#apply').onclick = () => { try { const s = JSON.parse($('#io').value); if (!s || !s.settings) throw 0; if (!confirm('현재 기록을 이 데이터로 덮어쓸까요?')) return; S = Object.assign(DEFAULT(), s); save(); render(); toast('가져왔습니다'); } catch (e) { toast('형식이 올바르지 않습니다'); } };
    $('#reset').onclick = async () => {
      if (!confirm('정말 모든 기록을 삭제할까요? 되돌릴 수 없습니다.')) return;
      S = DEFAULT(); localSave(); render();
      if (!DB) return;
      try {
        const q = await DB.collection('logs').get();
        for (const d of q.docs) { await DB.doc('logs/' + d.id).delete(); delete pushed.months[d.id]; }
        await DB.doc('app/state').delete(); pushed.state = null;
        setCloud('ok');
      } catch (e) { setCloud('err', (e && e.code) || 'error'); }
    };
  }

  /* ---------- 시작 ---------- */
  render();
  initCloud();
  /* 서비스 워커는 정적 사이트 빌드(manifest가 있는 index.html)에서만 등록합니다. */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && document.querySelector('link[rel="manifest"]')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
})();
