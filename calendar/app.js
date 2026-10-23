// 우리 달력 — a month view over one JSON file in a private repo, read and
// written through the GitHub contents API with the viewer's own token.
// No framework, no build step; every string from the file goes in through
// textContent, never innerHTML.

(function () {
  'use strict';

  var REPO = 'dehsurc/calendar_private';
  var FILE = 'events.json';
  var API = 'https://api.github.com/repos/' + REPO;
  var KEY = { token: 'cal-token', me: 'cal-me', cache: 'cal-cache', style: 'cal-style' };
  var WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  var DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* private mode */ } }
  };

  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;

  var state = {
    token: store.get(KEY.token),
    me: store.get(KEY.me),
    data: null,
    sha: null,
    year: 0, month: 0,      // month on screen, 0-based
    selected: today(),
    busy: false
  };
  (function () { var p = parts(state.selected); state.year = p.y; state.month = p.m; })();

  /* ------------------------------------------------------------------ *
   * Dates. Everything is a local 'YYYY-MM-DD' string, which sorts and
   * compares as text; arithmetic goes through UTC day numbers so DST
   * never shifts a day.
   * ------------------------------------------------------------------ */

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(y, m, d) {
    var t = new Date(y, m, d);
    return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
  }
  function today() { var t = new Date(); return iso(t.getFullYear(), t.getMonth(), t.getDate()); }
  function parts(s) { var p = s.split('-'); return { y: +p[0], m: +p[1] - 1, d: +p[2] }; }
  function dayNum(s) { var p = parts(s); return Date.UTC(p.y, p.m, p.d) / 864e5; }
  function addDays(s, n) { var p = parts(s); return iso(p.y, p.m, p.d + n); }
  function weekday(s) { var p = parts(s); return new Date(p.y, p.m, p.d).getDay(); }
  function label(s) { var p = parts(s); return (p.m + 1) + '월 ' + p.d + '일 (' + WEEK[weekday(s)] + ')'; }
  function dotted(s) { return s.replace(/-/g, '.'); }
  function cute() { return root.dataset.style === 'cute'; }
  var phone = window.matchMedia('(max-width: 640px)');

  // Does the event fall on day s? Yearly events repeat their whole span
  // every year from the year they were first set.
  function occurs(ev, s) {
    var end = ev.end && ev.end > ev.date ? ev.end : ev.date;
    if (ev.repeat !== 'yearly') return s >= ev.date && s <= end;
    var len = dayNum(end) - dayNum(ev.date);
    var first = parts(ev.date), y = parts(s).y;
    for (var k = y - 1; k <= y; k++) {
      if (k < first.y) continue;
      var start = iso(k, first.m, first.d);
      if (s >= start && s <= addDays(start, len)) return true;
    }
    return false;
  }

  // Counted the Korean way: the first day together is day 1.
  function daysTogether(s) {
    var since = state.data.since;
    return since && s >= since ? dayNum(s) - dayNum(since) + 1 : 0;
  }

  // 100-day marks and anniversaries, derived from `since`, never stored.
  function milestones(s) {
    var n = daysTogether(s), out = [];
    if (!n) return out;
    if (n % 100 === 0) out.push(n + '일');
    var a = parts(state.data.since), b = parts(s);
    if (b.y > a.y && b.m === a.m && b.d === a.d) out.push((b.y - a.y) + '주년');
    return out;
  }

  function eventsOn(s) {
    return state.data.events.filter(function (ev) { return occurs(ev, s); }).sort(byTime);
  }
  function byTime(x, y) {
    var tx = x.time || '', ty = y.time || '';
    return tx < ty ? -1 : tx > ty ? 1 : x.title.localeCompare(y.title, 'ko');
  }

  /* ------------------------------------------------------------------ *
   * GitHub. The file is small, so each write sends the whole thing with
   * the sha it was based on; if the other person saved in between, the
   * API refuses, we pull their version and replay our change on top.
   * ------------------------------------------------------------------ */

  function headers(extra) {
    var h = {
      Authorization: 'Bearer ' + state.token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    for (var k in extra) h[k] = extra[k];
    return h;
  }

  function encode(text) {
    var bytes = new TextEncoder().encode(text), bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }
  function decode(b64) {
    var bin = atob(b64.replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function blank() {
    return { version: 1, people: { a: { name: '나' }, b: { name: '너' } }, since: '', events: [] };
  }
  function normalize(d) {
    var b = blank();
    d = d && typeof d === 'object' ? d : b;
    d.version = d.version || 1;
    d.people = d.people || b.people;
    d.people.a = d.people.a || b.people.a;
    d.people.b = d.people.b || b.people.b;
    d.since = d.since || '';
    d.events = Array.isArray(d.events) ? d.events.filter(function (e) { return e && e.id && e.date; }) : [];
    return d;
  }

  function fail(status, message) { var e = new Error(message); e.status = status; return e; }

  async function apiError(r) {
    var msg = '';
    try { msg = (await r.json()).message || ''; } catch (e) { /* not json */ }
    if (r.status === 401) return fail(401, '토큰이 올바르지 않거나 만료됐어요.');
    if (r.status === 403 && /rate limit/i.test(msg)) return fail(403, '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.');
    if (r.status === 403) return fail(403, '이 토큰에는 쓰기 권한이 없어요. Contents: Read and write가 필요해요.');
    if (r.status === 404) return fail(404, '저장소에 접근할 수 없어요. 토큰 권한이나 저장소 초대를 확인해 주세요.');
    return fail(r.status, 'GitHub 오류 (' + r.status + ') ' + msg);
  }

  async function pull() {
    var r = await fetch(API + '/contents/' + FILE, { headers: headers(), cache: 'no-store' });
    if (r.status === 404) {
      // Either the file is not there yet or the repo is out of reach; ask
      // the repo itself to tell the two apart.
      var repo = await fetch(API, { headers: headers(), cache: 'no-store' });
      if (!repo.ok) throw await apiError(repo);
      state.data = normalize(null);
      state.sha = null;
      return;
    }
    if (!r.ok) throw await apiError(r);
    var j = await r.json();
    state.data = normalize(JSON.parse(decode(j.content)));
    state.sha = j.sha;
    store.set(KEY.cache, JSON.stringify(state.data));
  }

  async function commit(change, message) {
    for (var attempt = 0; attempt < 4; attempt++) {
      var next = JSON.parse(JSON.stringify(state.data));
      change(next);
      var body = { message: message, content: encode(JSON.stringify(next, null, 2) + '\n') };
      if (state.sha) body.sha = state.sha;
      var r = await fetch(API + '/contents/' + FILE, {
        method: 'PUT',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body)
      });
      if (r.ok) {
        var j = await r.json();
        state.data = next;
        state.sha = j.content.sha;
        store.set(KEY.cache, JSON.stringify(state.data));
        return;
      }
      if (r.status !== 409 && r.status !== 422) throw await apiError(r);
      await pull();     // someone else saved first: replay on their version
    }
    throw fail(409, '동시에 수정되고 있어요. 잠시 후 다시 시도해 주세요.');
  }

  /* ------------------------------------------------------------------ *
   * Status line
   * ------------------------------------------------------------------ */

  function status(text, bad, busy) {
    var el = $('status');
    el.textContent = text;
    el.classList.toggle('bad', !!bad);
    el.classList.toggle('busy', !!busy);
  }
  function stamp() {
    var t = new Date();
    status(pad(t.getHours()) + ':' + pad(t.getMinutes()) + ' 동기화');
  }

  async function sync(quiet) {
    if (!state.token || state.busy) return;
    if (!quiet) status('불러오는 중', false, true);
    try {
      await pull();
      render();
      stamp();
    } catch (e) {
      status(e.message, true);
      if (e.status === 401) logout(e.message);
    }
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function nameOf(who) {
    if (who === 'both') return '함께';
    return (state.data.people[who] || {}).name || '';
  }
  function whoClass(who) { return 'who-' + (who === 'a' || who === 'b' ? who : 'both'); }

  function render() {
    if (!state.data) return;
    renderNames();
    renderHero();
    renderGrid();
    renderDay();
    renderUpcoming();
  }

  function marker(who) { return el('i', 'mk ' + whoClass(who)); }

  function renderNames() {
    document.querySelectorAll('[data-name]').forEach(function (n) {
      n.textContent = nameOf(n.dataset.name);
    });
    var a = nameOf('a'), b = nameOf('b');
    $('mark').textContent = a + (cute() ? ' ♥ ' : ' & ') + b;
    $('foot-names').textContent = cute() ? a + ' ♥ ' + b : '© ' + parts(today()).y + ' ' + a + ' & ' + b;

    var lg = $('legend');
    lg.textContent = '';
    ['a', 'b', 'both'].forEach(function (w) {
      var item = el('span', 'legend-item');
      item.appendChild(marker(w));
      item.appendChild(document.createTextNode(nameOf(w)));
      lg.appendChild(item);
    });

    $('cal-label').textContent = cute() ? '이번 달' : 'Calendar';
    $('up-title').textContent = cute() ? '다가오는 일정' : 'Upcoming';
  }

  function renderHero() {
    var y = state.year, m = state.month;
    var prev = (m + 11) % 12, next = (m + 1) % 12;
    if (cute()) {
      $('month-big').textContent = (m + 1) + '월';
      $('month-small').textContent = y + '년';
      $('prev-label').textContent = (prev + 1) + '월';
      $('next-label').textContent = (next + 1) + '월';
    } else {
      $('month-big').textContent = MONTHS[m];
      $('month-small').textContent = y + ' · ' + (m + 1) + '월';
      $('prev-label').textContent = MONTHS[prev];
      $('next-label').textContent = MONTHS[next];
    }

    var n = daysTogether(today()), since = state.data.since;
    $('together').hidden = !n;
    $('count-num').textContent = n ? String(n) : '';
    $('count-unit').textContent = cute() ? '일' : 'days';
    $('count-caption').textContent = !n ? ''
      : cute() ? dotted(since) + '부터 함께'
               : '함께한 날 · since ' + dotted(since);
    $('foot-since').textContent = n ? (cute() ? '함께한 지 ' + n + '일째' : 'Since ' + dotted(since)) : '';
  }

  function renderGrid() {
    var y = state.year, m = state.month;
    var first = iso(y, m, 1);
    var lead = weekday(first);
    var days = new Date(y, m + 1, 0).getDate();
    var cells = Math.ceil((lead + days) / 7) * 7;
    var now = today();
    var limit = phone.matches ? 4 : 3;

    var grid = $('grid');
    grid.textContent = '';
    for (var i = 0; i < cells; i++) {
      var s = addDays(first, i - lead);
      var p = parts(s);
      var cell = el('button', 'cell');
      cell.type = 'button';
      cell.dataset.date = s;
      cell.setAttribute('role', 'gridcell');
      if (p.m !== m) cell.classList.add('out');
      if (s === now) cell.classList.add('today');
      if (s === state.selected) { cell.classList.add('sel'); cell.setAttribute('aria-selected', 'true'); }

      cell.appendChild(el('span', 'num', String(p.d)));

      var list = el('span', 'events');
      var items = eventsOn(s);
      milestones(s).forEach(function (t) {
        var c = el('span', 'ev mile');
        c.appendChild(el('i', 'mk'));
        c.appendChild(el('span', 't', t));
        list.appendChild(c);
      });
      items.slice(0, limit).forEach(function (ev) {
        var c = el('span', 'ev ' + whoClass(ev.who));
        c.appendChild(marker(ev.who));
        c.appendChild(el('span', 't', ev.title));
        list.appendChild(c);
      });
      if (items.length > limit) list.appendChild(el('span', 'more', '+' + (items.length - limit)));
      cell.appendChild(list);

      cell.setAttribute('aria-label', label(s) + (items.length ? ', 일정 ' + items.length + '개' : ''));
      grid.appendChild(cell);
    }
  }

  function whenText(ev, s) {
    if (ev.time) return ev.time;
    if (ev.end && ev.end > ev.date && ev.repeat !== 'yearly') {
      var p = parts(ev.end);
      return s === ev.date ? '~' + (p.m + 1) + '/' + p.d : '계속';
    }
    return '종일';
  }

  // One entry, laid out like a publication on the main page: a short
  // label in the left column, the title, then a line of detail.
  function entry(ev, s, upcoming) {
    var li = el('li');
    var b = el('button', 'entry ' + whoClass(ev.who));
    b.type = 'button';
    b.dataset.id = ev.id;
    var p = parts(s);
    b.appendChild(el('span', 'pid', upcoming ? (p.m + 1) + '/' + p.d + ' ' + WEEK[weekday(s)] : whenText(ev, s)));

    var body = el('div');
    body.appendChild(el('h3', null, ev.title));
    var meta = el('p', 'meta');
    meta.appendChild(marker(ev.who));
    var bits = [nameOf(ev.who)];
    if (upcoming) bits.push(whenText(ev, s));
    else if (ev.time && ev.endTime) bits.push(ev.time + '–' + ev.endTime);
    if (ev.repeat === 'yearly') bits.push('매년');
    meta.appendChild(document.createTextNode(bits.join(' · ')));
    body.appendChild(meta);
    if (ev.note && !upcoming) body.appendChild(el('p', 'note', ev.note));
    b.appendChild(body);
    li.appendChild(b);
    return li;
  }

  function mileEntry(t) {
    var li = el('li');
    var d = el('div', 'entry static who-b');
    d.appendChild(el('span', 'pid', '♥'));
    var body = el('div');
    body.appendChild(el('h3', null, '우리 ' + t));
    d.appendChild(body);
    li.appendChild(d);
    return li;
  }

  function renderDay() {
    var s = state.selected;
    var n = daysTogether(s);
    var p = parts(s);
    $('day-title').textContent = (p.m + 1) + '월 ' + p.d + '일';
    $('day-note').textContent = DAYS[weekday(s)] + (n ? ' · ' + n + '일째' : '');
    var ul = $('day-list');
    ul.textContent = '';
    milestones(s).forEach(function (t) { ul.appendChild(mileEntry(t)); });
    var items = eventsOn(s);
    items.forEach(function (ev) { ul.appendChild(entry(ev, s, false)); });
    if (!ul.children.length) {
      ul.appendChild(el('li', 'empty', cute() ? '아직 비어 있어요. 날짜를 두 번 톡톡 누르면 추가돼요.'
                                             : '일정이 없어요. 날짜를 두 번 누르면 바로 추가할 수 있어요.'));
    }
  }

  // The next eight occurrences over the coming year, each event once.
  function renderUpcoming() {
    var ul = $('up-list'), now = today(), seen = {}, found = 0;
    ul.textContent = '';
    for (var i = 0; i < 366 && found < 8; i++) {
      var s = addDays(now, i);
      var evs = eventsOn(s);
      for (var j = 0; j < evs.length && found < 8; j++) {
        var ev = evs[j];
        if (seen[ev.id]) continue;
        seen[ev.id] = true;
        found++;
        ul.appendChild(entry(ev, s, true));
      }
    }
    if (!found) ul.appendChild(el('li', 'empty', '앞으로 1년 동안 잡힌 일정이 없어요.'));
  }

  /* ------------------------------------------------------------------ *
   * Editor
   * ------------------------------------------------------------------ */

  var editing = null;   // id of the event open in the editor, or null

  function openEditor(ev, date) {
    editing = ev ? ev.id : null;
    $('edit-title').textContent = ev ? '일정 수정' : '일정 추가';
    $('f-title').value = ev ? ev.title : '';
    $('f-date').value = ev ? ev.date : date;
    $('f-end').value = ev && ev.end ? ev.end : '';
    $('f-allday').checked = !(ev && ev.time);
    $('f-time').value = ev && ev.time ? ev.time : '';
    $('f-endtime').value = ev && ev.endTime ? ev.endTime : '';
    $('time-row').hidden = $('f-allday').checked;
    $('f-yearly').checked = !!(ev && ev.repeat === 'yearly');
    $('f-note').value = ev && ev.note ? ev.note : '';
    var who = ev ? ev.who : 'both';
    document.querySelectorAll('#edit-form input[name="who"]').forEach(function (r) { r.checked = r.value === who; });
    $('f-delete').hidden = !ev;
    $('edit-error').hidden = true;
    $('edit-meta').textContent = ev && ev.by
      ? '마지막 저장: ' + nameOf(ev.by) + (ev.updated ? ' · ' + dotted(ev.updated.slice(0, 10)) : '')
      : '';
    $('editor').showModal();
    if (!ev) $('f-title').focus();
  }

  function readForm() {
    var title = $('f-title').value.trim();
    var date = $('f-date').value;
    var end = $('f-end').value;
    var allDay = $('f-allday').checked;
    var time = allDay ? '' : $('f-time').value;
    var endTime = allDay ? '' : $('f-endtime').value;
    if (!title) return '제목을 입력해 주세요.';
    if (!date) return '날짜를 골라 주세요.';
    if (end && end < date) return '끝나는 날이 시작보다 빨라요.';
    if (!allDay && !time) return '시작 시간을 입력하거나 하루 종일을 선택해 주세요.';
    if (endTime && time && endTime < time && !(end && end > date)) return '끝 시간이 시작보다 빨라요.';
    var ev = {
      title: title,
      date: date,
      who: (document.querySelector('#edit-form input[name="who"]:checked') || {}).value || 'both'
    };
    if (end && end > date) ev.end = end;
    if (time) ev.time = time;
    if (endTime) ev.endTime = endTime;
    if ($('f-yearly').checked) ev.repeat = 'yearly';
    var note = $('f-note').value.trim();
    if (note) ev.note = note;
    return ev;
  }

  function newId() {
    return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  }

  async function save(change, message, dialog, errorBox, button) {
    state.busy = true;
    if (button) button.disabled = true;
    status('저장 중', false, true);
    try {
      await commit(change, message);
      dialog.close();
      render();
      stamp();
    } catch (e) {
      errorBox.textContent = e.message;
      errorBox.hidden = false;
      status('저장 실패', true);
      if (e.status === 401) { dialog.close(); logout(e.message); }
    } finally {
      state.busy = false;
      if (button) button.disabled = false;
    }
  }

  function me() { return state.me === 'b' ? 'b' : 'a'; }
  function by() { return nameOf(me()) || me(); }

  $('f-allday').addEventListener('change', function () {
    $('time-row').hidden = this.checked;
    if (!this.checked && !$('f-time').value) $('f-time').value = '19:00';
  });

  $('edit-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var ev = readForm();
    if (typeof ev === 'string') {
      $('edit-error').textContent = ev;
      $('edit-error').hidden = false;
      return;
    }
    ev.by = me();
    ev.updated = new Date().toISOString();
    var id = editing;
    var msg = by() + ': ' + (id ? '수정' : '추가') + ' · ' + ev.date + ' ' + ev.title;
    save(function (d) {
      if (id) {
        var i = d.events.findIndex(function (x) { return x.id === id; });
        if (i < 0) { ev.id = id; d.events.push(ev); return; }   // deleted meanwhile: keep the edit
        ev.id = id;
        d.events[i] = ev;
      } else {
        ev.id = newId();
        d.events.push(ev);
      }
      d.events.sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : byTime(x, y); });
    }, msg, $('editor'), $('edit-error'), $('f-save'));
    state.selected = ev.date;
  });

  $('f-delete').addEventListener('click', function () {
    var id = editing;
    var ev = state.data.events.find(function (x) { return x.id === id; });
    if (!ev || !confirm('“' + ev.title + '” 일정을 삭제할까요?')) return;
    save(function (d) {
      d.events = d.events.filter(function (x) { return x.id !== id; });
    }, by() + ': 삭제 · ' + ev.date + ' ' + ev.title, $('editor'), $('edit-error'), $('f-save'));
  });

  /* ------------------------------------------------------------------ *
   * Settings
   * ------------------------------------------------------------------ */

  function openPrefs() {
    $('p-a').value = state.data.people.a.name;
    $('p-b').value = state.data.people.b.name;
    $('p-since').value = state.data.since || '';
    document.querySelectorAll('#prefs-form input[name="me"]').forEach(function (r) { r.checked = r.value === state.me; });
    document.querySelectorAll('#prefs-form input[name="style"]').forEach(function (r) { r.checked = r.value === root.dataset.style; });
    $('prefs-error').hidden = true;
    $('prefs').showModal();
  }

  $('prefs-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var a = $('p-a').value.trim(), b = $('p-b').value.trim(), since = $('p-since').value;
    var picked = document.querySelector('#prefs-form input[name="me"]:checked');
    if (!picked) {
      $('prefs-error').textContent = '이 기기를 쓰는 사람을 골라 주세요.';
      $('prefs-error').hidden = false;
      return;
    }
    state.me = picked.value;
    store.set(KEY.me, state.me);
    setStyle(document.querySelector('#prefs-form input[name="style"]:checked').value);

    var d = state.data;
    if (a === d.people.a.name && b === d.people.b.name && since === d.since) {
      $('prefs').close();
      render();
      return;
    }
    save(function (x) {
      x.people.a.name = a;
      x.people.b.name = b;
      x.since = since;
    }, by() + ': 설정 변경', $('prefs'), $('prefs-error'), $('p-save'));
  });

  // Show the style the moment it is picked; closing without saving puts
  // back whatever was there.
  var styleBefore = null;
  document.querySelectorAll('#prefs-form input[name="style"]').forEach(function (r) {
    r.addEventListener('change', function () {
      if (styleBefore === null) styleBefore = root.dataset.style;
      applyStyle(r.value);
    });
  });
  $('prefs').addEventListener('close', function () {
    if (styleBefore !== null && store.get(KEY.style) !== root.dataset.style) applyStyle(styleBefore);
    styleBefore = null;
  });

  $('logout').addEventListener('click', function () {
    if (!confirm('이 기기에 저장된 토큰과 일정을 지울까요? 저장소의 일정은 그대로 남아요.')) return;
    $('prefs').close();
    logout();
  });

  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () { b.closest('dialog').close(); });
  });
  // Tapping the backdrop closes a dialog, as it does everywhere else.
  document.querySelectorAll('dialog').forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });

  /* ------------------------------------------------------------------ *
   * Month navigation
   * ------------------------------------------------------------------ */

  function shiftMonth(n) {
    var t = new Date(state.year, state.month + n, 1);
    state.year = t.getFullYear();
    state.month = t.getMonth();
    // Keep the selection inside the month on screen.
    var p = parts(state.selected);
    if (p.y !== state.year || p.m !== state.month) {
      var days = new Date(state.year, state.month + 1, 0).getDate();
      state.selected = iso(state.year, state.month, Math.min(p.d, days));
    }
    render();
  }

  $('prev').addEventListener('click', function () { shiftMonth(-1); });
  $('next').addEventListener('click', function () { shiftMonth(1); });
  $('today').addEventListener('click', function () {
    state.selected = today();
    var p = parts(state.selected);
    state.year = p.y; state.month = p.m;
    render();
  });
  $('add').addEventListener('click', function () { openEditor(null, state.selected); });
  $('status').addEventListener('click', function () { sync(false); });
  $('settings').addEventListener('click', openPrefs);

  var lastTap = { date: null, at: 0 };
  $('grid').addEventListener('click', function (e) {
    var cell = e.target.closest('.cell');
    if (!cell) return;
    var s = cell.dataset.date, now = Date.now();
    // A second tap on the same day opens the editor; the first just selects.
    if (lastTap.date === s && now - lastTap.at < 450) {
      lastTap.date = null;
      openEditor(null, s);
      return;
    }
    lastTap = { date: s, at: now };
    var p = parts(s);
    state.selected = s;
    if (p.y !== state.year || p.m !== state.month) { state.year = p.y; state.month = p.m; }
    render();
  });

  function onItem(e) {
    var b = e.target.closest('.item[data-id]');
    if (!b) return;
    var ev = state.data.events.find(function (x) { return x.id === b.dataset.id; });
    if (ev) openEditor(ev);
  }
  $('day-list').addEventListener('click', onItem);
  $('up-list').addEventListener('click', onItem);

  // Swipe sideways across the grid to change month.
  var touch = null;
  $('grid').addEventListener('touchstart', function (e) {
    var t = e.changedTouches[0];
    touch = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  $('grid').addEventListener('touchend', function (e) {
    if (!touch) return;
    var t = e.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftMonth(dx < 0 ? 1 : -1);
  }, { passive: true });

  phone.addEventListener('change', function () { render(); });

  $('together').addEventListener('click', function () {
    var b = this.querySelector('.bunny');
    b.classList.remove('hop');
    void b.getBoundingClientRect();     // restart the animation
    b.classList.add('hop');
  });

  /* ------------------------------------------------------------------ *
   * Theme — the same switch as the main site, without the wipe.
   * ------------------------------------------------------------------ */

  var toggle = $('theme-toggle');
  function paint(theme) {
    root.dataset.theme = theme;
    toggle.setAttribute('aria-pressed', String(theme === 'dark'));
    toggle.setAttribute('aria-label', (theme === 'dark' ? '밝은' : '어두운') + ' 테마로 전환');
    store.set('kk-theme', theme);
  }
  toggle.addEventListener('click', function () { paint(root.dataset.theme === 'dark' ? 'light' : 'dark'); });
  toggle.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));

  // Style: chic or cute. Applying only repaints; setting also remembers it
  // on this device.
  function applyStyle(style) {
    root.dataset.style = style === 'cute' ? 'cute' : 'chic';
    render();
    sea();
  }
  function setStyle(style) {
    store.set(KEY.style, style === 'cute' ? 'cute' : 'chic');
    applyStyle(style);
  }

  /* ------------------------------------------------------------------ *
   * Water — the main page's surface, behind the chic style only.
   *
   * A height field of five wave trains running down the page, drawn as
   * contours by marching squares. The pointer lifts the water under it.
   * Same constants as main.js, so the two pages read as one sheet.
   * ------------------------------------------------------------------ */

  var canvas = document.querySelector('canvas.deco');
  var seaRunning = false;

  var sea = (function () {
    if (!canvas || !canvas.getContext) return function () {};
    var CELL = 16, LEVELS = 5, SPAN = 1.15, INK = 0.115;
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, st = 0, grid = null, gw = 0, gh = 0;
    var pt = { x: -9999, y: -9999 };
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', function (e) { pt.x = e.clientX; pt.y = e.clientY; }, { passive: true });
    resize();

    function height(x, y) {
      var h = Math.sin((x * 0.0010 + y * 0.0060) - st * 0.81)
            + Math.sin((x * -0.0018 + y * 0.0048) - st * 0.68) * 0.72
            + Math.sin((x * 0.0022 + y * 0.0101) - st * 1.38) * 0.36
            + Math.sin((x * -0.0009 + y * 0.0186) - st * 2.48) * 0.20
            + Math.sin((x * 0.0042 + y * 0.0330) - st * 4.43) * 0.07;
      if (pt.x > -9000) {
        var d = Math.hypot(x - pt.x, y - pt.y);
        if (d < 300) { var f = 1 - d / 300; h += f * f * 1.25; }
      }
      return h;
    }

    function marching(level) {
      for (var j = 0; j < gh - 1; j++) {
        for (var i = 0; i < gw - 1; i++) {
          var a = grid[j * gw + i], b = grid[j * gw + i + 1];
          var c = grid[(j + 1) * gw + i + 1], d = grid[(j + 1) * gw + i];
          var code = (a > level ? 1 : 0) | (b > level ? 2 : 0) | (c > level ? 4 : 0) | (d > level ? 8 : 0);
          if (code === 0 || code === 15) continue;
          var x0 = (i - 1) * CELL, y0 = (j - 1) * CELL;
          var T = [x0 + (level - a) / (b - a) * CELL, y0];
          var R = [x0 + CELL, y0 + (level - b) / (c - b) * CELL];
          var B = [x0 + (level - d) / (c - d) * CELL, y0 + CELL];
          var L = [x0, y0 + (level - a) / (d - a) * CELL];
          switch (code) {
            case 1: case 14: seg(L, T); break;
            case 2: case 13: seg(T, R); break;
            case 3: case 12: seg(L, R); break;
            case 4: case 11: seg(R, B); break;
            case 6: case 9:  seg(T, B); break;
            case 7: case 8:  seg(L, B); break;
            case 5:          seg(L, T); seg(R, B); break;
            case 10:         seg(T, R); seg(L, B); break;
          }
        }
      }
    }
    function seg(p, q) { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }

    function frame() {
      if (cute() || document.hidden) { seaRunning = false; ctx.clearRect(0, 0, W, H); return; }
      if (!reduce) st += 0.0048;
      gw = Math.ceil(W / CELL) + 3;
      gh = Math.ceil(H / CELL) + 3;
      if (!grid || grid.length !== gw * gh) grid = new Float32Array(gw * gh);
      for (var j = 0; j < gh; j++) {
        for (var i = 0; i < gw; i++) grid[j * gw + i] = height((i - 1) * CELL, (j - 1) * CELL);
      }
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      var rgb = root.dataset.theme === 'dark' ? '255, 255, 255' : '17, 17, 18';
      for (var l = 0; l < LEVELS; l++) {
        var level = SPAN * (-1 + 2 * (l + 0.5) / LEVELS);
        var edge = Math.abs(level) / SPAN;
        ctx.strokeStyle = 'rgba(' + rgb + ',' + (INK * (1 - edge * 0.45)) + ')';
        ctx.beginPath();
        marching(level);
        ctx.stroke();
      }
      requestAnimationFrame(frame);
    }

    // Start the loop if it is not already running; it stops itself when
    // the page is hidden or the style turns cute.
    return function () {
      if (seaRunning || cute()) { if (cute()) ctx.clearRect(0, 0, W, H); return; }
      seaRunning = true;
      requestAnimationFrame(frame);
    };
  })();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) sea(); });
  sea();

  /* ------------------------------------------------------------------ *
   * Seoul clock, as in the main page's footer.
   * ------------------------------------------------------------------ */

  (function () {
    var clock = $('clock');
    if (!window.Intl) return;
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Seoul', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    var tick = function () { clock.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 1000);
  })();

  /* ------------------------------------------------------------------ *
   * Sign in and out
   * ------------------------------------------------------------------ */

  function show(signedIn) {
    $('login').hidden = signedIn;
    $('app').hidden = !signedIn;
    $('status').hidden = !signedIn;
    $('settings').hidden = !signedIn;
  }

  function logout(reason) {
    state.token = null;
    state.data = null;
    state.sha = null;
    store.del(KEY.token);
    store.del(KEY.cache);
    show(false);
    status('');
    var err = $('login-error');
    err.hidden = !reason;
    err.textContent = reason || '';
  }

  $('login-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var token = $('token').value.trim();
    if (!token) return;
    var btn = this.querySelector('button');
    btn.disabled = true;
    $('login-error').hidden = true;
    state.token = token;
    try {
      await pull();
      store.set(KEY.token, token);
      $('token').value = '';
      show(true);
      render();
      stamp();
      if (!state.me) openPrefs();    // first time on this device: who is it?
    } catch (err) {
      state.token = null;
      $('login-error').textContent = err.message;
      $('login-error').hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  // Pick up the other person's changes whenever the page comes back into
  // view, and every two minutes while it is open.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') sync(true);
  });
  setInterval(function () {
    if (document.visibilityState === 'visible' && !document.querySelector('dialog[open]')) sync(true);
  }, 120000);

  /* ------------------------------------------------------------------ *
   * Start: paint the last copy at once, then fetch the live one.
   * ------------------------------------------------------------------ */

  if (state.token) {
    show(true);
    try {
      var cached = store.get(KEY.cache);
      if (cached) { state.data = normalize(JSON.parse(cached)); render(); }
    } catch (e) { /* stale or broken cache; the fetch replaces it */ }
    sync(false).then(function () { if (state.data && !state.me) openPrefs(); });
  } else {
    show(false);
  }
})();
