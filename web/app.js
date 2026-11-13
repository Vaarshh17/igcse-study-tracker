/* IGCSE Study Tracker: Pomodoro timer + tracker + nightly review.
   Plain JS, no build step. Data lives in localStorage on each device and,
   when connected, in the Google Sheet via the Apps Script connector. */
(() => {
  'use strict';

  // ------------------------------------------------------------------ helpers
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = n => String(n).padStart(2, '0');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => iso(new Date());
  const parseIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseIso(s); d.setDate(d.getDate() + n); return iso(d); };
  const fmtHM = mins => `${Math.floor(mins / 60)}h ${pad(Math.floor(mins % 60))}m`;
  const fmtH = mins => (mins / 60).toFixed(1);
  const fmtDay = s => parseIso(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const uid = () => Math.random().toString(36).slice(2, 10);

  const store = {
    get(k, d) { try { const v = localStorage.getItem('st.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('st.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  const PLAN = window.PLAN || { start: today(), end: today(), days: {} };
  const SUBJECTS = ['Physics', 'Chemistry', 'Biology', 'Add Maths', 'Maths', 'English', 'Global Perspectives', 'Other'];

  // ------------------------------------------------------------------ settings
  const DEFAULTS = {
    pomodoro: 30, short: 5, long: 15, autoBreaks: false, autoPomos: false, longInterval: 4,
    alarm: 'bell', volume: 60, tick: false, notify: false, theme: 'auto',
    minHours: 5, fullHours: 6, sheetUrl: '', scriptUrl: '', key: '', role: '',
  };
  let settings = { ...DEFAULTS, ...store.get('settings', {}) };
  const saveSettings = () => store.set('settings', settings);
  const minTarget = () => settings.minHours * 60;
  const fullTarget = () => settings.fullHours * 60;

  // ------------------------------------------------------------------ data
  let log = store.get('log', []);          // {ts,date,subject,topic,minutes,pomodoro}
  let tasks = store.get('tasks', []);      // {id,date,subject,topic,title,activity,planned,est,act,done,notes,score,outOf}
  let activeId = store.get('activeId', null);
  let doneKeys = store.get('doneKeys', {}); // "date|subject" -> true (local fallback for coverage)
  let outbox = store.get('outbox', []);
  let rowsCache = store.get('rows', null);  // {at, rows}
  const visits = new Set(store.get('visits', []));
  visits.add(today()); store.set('visits', [...visits]);

  const saveLog = () => store.set('log', log);
  const saveTasks = () => { store.set('tasks', tasks); store.set('activeId', activeId); };
  const connected = () => !!(settings.scriptUrl && settings.key);

  // ------------------------------------------------------------------ sheet API
  async function api(payload) {
    if (!connected()) throw new Error('Not connected');
    const res = await fetch(settings.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, key: settings.key }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function queue(item) {
    if (!connected()) return;
    outbox.push(item); store.set('outbox', outbox);
    flush();
  }
  let flushing = false;
  async function flush() {
    if (flushing || !connected() || !outbox.length) return;
    flushing = true;
    try {
      while (outbox.length) {
        await api(outbox[0]);
        outbox.shift(); store.set('outbox', outbox);
      }
    } catch (e) {
      if (/wrong key|no row|required/i.test(e.message)) { outbox.shift(); store.set('outbox', outbox); toast('Sheet: ' + e.message); }
    } finally { flushing = false; }
  }
  setInterval(flush, 60000);
  addEventListener('online', flush);

  async function fetchRows() {
    const data = await api({ action: 'rows' });
    if (data.role) { settings.role = data.role; saveSettings(); }
    rowsCache = { at: Date.now(), rows: data.rows };
    store.set('rows', rowsCache);
    return data.rows;
  }

  // ------------------------------------------------------------------ audio
  let actx;
  function ac() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, start, dur, type = 'sine', gain = 1) {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    const v = Math.max((settings.volume / 100) * 0.5 * gain, 0.0002);
    const t = c.currentTime + start;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function playAlarm(kind = settings.alarm) {
    if (kind === 'none' || !settings.volume) return;
    if (kind === 'bell') {
      for (let i = 0; i < 3; i++) { tone(880, i * 0.9, 1.6); tone(1320, i * 0.9, 1.0, 'sine', 0.4); tone(2200, i * 0.9, 0.4, 'sine', 0.15); }
    } else if (kind === 'digital') {
      for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) tone(1000, r * 0.8 + i * 0.12, 0.08, 'square', 0.3);
    } else {
      tone(523, 0, 0.6); tone(659, 0.25, 0.6); tone(784, 0.5, 1.0);
    }
  }
  const tick = () => tone(1800, 0, 0.02, 'square', 0.12);

  function notify(title, body) {
    if (!settings.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
    try { new Notification(title, { body }); } catch { /* not supported */ }
  }

  // ------------------------------------------------------------------ theme
  function applyTheme() {
    const sys = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const base = settings.theme === 'auto' ? sys : settings.theme;
    const invert = timer.mode !== 'pomodoro'; // breaks flip black <-> white
    const eff = invert ? (base === 'dark' ? 'light' : 'dark') : base;
    document.documentElement.dataset.theme = eff;
    $('meta[name="theme-color"]').content = eff === 'dark' ? '#000000' : '#ffffff';
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());

  // ------------------------------------------------------------------ timer
  const MODE_MSG = { pomodoro: 'Time to focus!', short: 'Time for a break!', long: 'Time for a long break!' };
  const dur = m => Math.round(settings[m] * 60);
  const timer = Object.assign(
    { mode: 'pomodoro', running: false, endAt: 0, total: dur('pomodoro'), remaining: dur('pomodoro'), round: 1, sinceLong: 0, day: today() },
    store.get('timer', {}));
  const saveTimer = () => store.set('timer', timer);
  if (timer.day !== today() && !timer.running) { timer.round = 1; timer.sinceLong = 0; timer.day = today(); saveTimer(); }

  function setMode(mode, autostart = false) {
    timer.mode = mode; timer.running = false; timer.endAt = 0;
    timer.total = dur(mode); timer.remaining = timer.total;
    saveTimer(); applyTheme(); renderTimer();
    if (autostart) start();
  }
  function start() {
    ac();
    if (timer.remaining <= 0) timer.remaining = timer.total;
    timer.running = true;
    timer.endAt = Date.now() + timer.remaining * 1000;
    timer.day = today();
    saveTimer(); renderTimer();
  }
  function pause() {
    timer.remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
    timer.running = false; saveTimer(); renderTimer();
  }
  function complete(natural, quiet = false) {
    const was = timer.mode;
    timer.running = false;
    let next, auto;
    if (was === 'pomodoro') {
      const mins = natural ? timer.total / 60 : Math.floor((timer.total - timer.remaining) / 60);
      if (mins > 0) creditFocus(mins, natural);
      if (natural) { timer.round++; timer.sinceLong++; }
      next = natural && timer.sinceLong % settings.longInterval === 0 ? 'long' : 'short';
      auto = settings.autoBreaks;
      if (natural && !quiet) notify('Pomodoro done', next === 'long' ? 'Take a long break.' : 'Take a short break.');
    } else {
      next = 'pomodoro'; auto = settings.autoPomos;
      if (natural && !quiet) notify('Break over', 'Back to work!');
    }
    if (natural && !quiet) playAlarm();
    setMode(next, auto);
  }

  function creditFocus(mins, fullPomo) {
    const t = tasks.find(x => x.id === activeId && !x.done) || null;
    const date = today();
    const subject = t ? t.subject : 'Other';
    log.push({ ts: Date.now(), date, subject, topic: t ? t.topic : '', minutes: mins, pomodoro: fullPomo });
    saveLog();
    if (t && fullPomo) { t.act++; saveTasks(); }
    if (t && subject !== 'Other') {
      queue({ action: 'log', date, subject, topic: t.topic, objective: t.title, minutes: mins, pomodoro: fullPomo });
    }
    renderTasks(); renderGoal();
    toast(`${mins} min logged${t ? ' to ' + subject : ''}`);
  }

  // resume after reload
  if (timer.running && timer.endAt <= Date.now()) complete(true, Date.now() - timer.endAt > 60000);

  setInterval(() => {
    if (!timer.running) return;
    const rem = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
    if (rem !== timer.remaining) {
      timer.remaining = rem;
      if (settings.tick && timer.mode === 'pomodoro' && rem > 0 && !document.hidden) tick();
      if (rem <= 0) { complete(true); return; }
      renderClock();
      if (timer.mode === 'pomodoro' && rem % 30 === 0) renderGoal();
    }
  }, 250);

  function renderClock() {
    const m = Math.floor(timer.remaining / 60), s = timer.remaining % 60;
    const txt = `${pad(m)}:${pad(s)}`;
    $('#clock').textContent = txt;
    $('#strip-fill').style.width = `${(1 - timer.remaining / timer.total) * 100}%`;
    const t = activeTask();
    const label = timer.mode === 'pomodoro' ? (t ? t.subject : MODE_MSG.pomodoro) : 'Break';
    document.title = `${txt} – ${label}`;
  }
  function renderTimer() {
    $$('.modes button').forEach(b => b.classList.toggle('active', b.dataset.mode === timer.mode));
    const btn = $('#btn-start');
    btn.textContent = timer.running ? 'PAUSE' : 'START';
    btn.classList.toggle('running', timer.running);
    $('#btn-skip').hidden = !timer.running;
    $('#round-no').textContent = `#${timer.round}`;
    $('#round-msg').textContent = MODE_MSG[timer.mode];
    renderClock();
  }

  $('#btn-start').addEventListener('click', () => {
    if (settings.notify && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    timer.running ? pause() : start();
  });
  $('#btn-skip').addEventListener('click', () => {
    if (timer.mode === 'pomodoro' && !confirm('Finish this pomodoro early? Minutes so far will still be logged.')) return;
    timer.remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
    complete(false);
  });
  $$('.modes button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.mode === timer.mode) return;
    if (timer.running && !confirm('The timer is running. Switch anyway?')) return;
    setMode(b.dataset.mode);
  }));
  document.addEventListener('keydown', e => {
    if (e.code !== 'Space' || location.hash.replace('#', '') && location.hash !== '#timer') return;
    if (e.target.closest('input, textarea, select, button, dialog[open]') || $('dialog[open]')) return;
    e.preventDefault();
    timer.running ? pause() : start();
  });

  // ------------------------------------------------------------------ daily goal
  function minutesOn(date) {
    let m = log.filter(l => l.date === date).reduce((a, l) => a + l.minutes, 0);
    if (date === today() && timer.mode === 'pomodoro' && (timer.running || timer.remaining < timer.total)) {
      m += Math.floor((timer.total - timer.remaining) / 60);
    }
    return m;
  }
  function renderGoal() {
    const d = today();
    const mins = minutesOn(d);
    const full = fullTarget(), min = minTarget();
    $('#goal-text').textContent = `${fmtHM(mins)} / ${settings.minHours}h min`;
    $('#goal-fill').style.width = `${Math.min(mins / full, 1) * 100}%`;
    $('#goal-mark-min').style.left = `${(min / full) * 100}%`;
    $('#goal-mark-min span').textContent = `${settings.minHours}h`;
    $('.goal-mark.end span').textContent = `${settings.fullHours}h`;
    const bySub = {};
    log.filter(l => l.date === d).forEach(l => { bySub[l.subject] = (bySub[l.subject] || 0) + l.minutes; });
    const parts = Object.entries(bySub).map(([s, m]) => `<span>${esc(s)} <b>${fmtHM(m)}</b></span>`);
    $('#goal-subjects').innerHTML = parts.length ? parts.join('') : '<span>No focus time logged yet today.</span>';
  }

  // ------------------------------------------------------------------ tasks
  const activeTask = () => tasks.find(t => t.id === activeId) || null;
  let editingId = null; // id, or 'new'

  function setDone(t, done) {
    t.done = done;
    const key = `${t.date}|${t.subject}`;
    if (t.date) { if (done) doneKeys[key] = true; else delete doneKeys[key]; store.set('doneKeys', doneKeys); }
    if (t.date && t.subject !== 'Other') queue({ action: 'update', date: t.date, subject: t.subject, fields: { status: done ? 'Done' : 'Not started' } });
    if (done && activeId === t.id) {
      const nxt = tasks.find(x => !x.done);
      activeId = nxt ? nxt.id : null;
    }
    saveTasks(); renderTasks(); renderClock();
  }

  function loadPlan(date, silent = false) {
    const items = PLAN.days[date];
    if (!items) { if (!silent) toast('No plan for that date (plan runs ' + fmtDay(PLAN.start) + ' – ' + fmtDay(PLAN.end) + ')'); return 0; }
    let added = 0;
    items.forEach(e => {
      if (tasks.some(t => t.date === date && t.subject === e.subject && t.title === e.objective)) return;
      tasks.push({
        id: uid(), date, subject: e.subject, topic: e.topic, title: e.objective, activity: e.activity,
        planned: e.planned, est: Math.max(1, Math.round(e.planned / settings.pomodoro)), act: 0,
        done: !!doneKeys[`${date}|${e.subject}`], notes: '', score: '', outOf: '',
      });
      added++;
    });
    if (!activeTask() || activeTask().done) { const n = tasks.find(t => !t.done); activeId = n ? n.id : null; }
    saveTasks(); renderTasks(); renderClock();
    if (!silent) toast(added ? `Loaded ${added} objectives for ${fmtDay(date)}` : 'Already loaded');
    return added;
  }

  function taskHTML(t) {
    const from = t.date && t.date !== today() ? ` · ${fmtDay(t.date)}` : '';
    return `<li class="task${t.done ? ' done' : ''}${t.id === activeId ? ' active' : ''}" data-id="${t.id}">
      <button class="check" data-act="check" aria-label="${t.done ? 'Mark not done' : 'Mark done'}"><svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg></button>
      <div>
        <div class="t-subject">${esc(t.subject)}${t.topic ? ` <span class="muted">· ${esc(t.topic)}</span>` : ''}</div>
        <div class="t-title">${esc(t.title || '(untitled)')}</div>
        <div class="t-meta">${esc(t.activity || '')}${from}${t.score !== '' && t.outOf ? ` · ${esc(t.score)}/${esc(t.outOf)}` : ''}</div>
      </div>
      <div class="t-count"><b>${t.act}</b>/${t.est}</div>
      <button class="icon-btn edit" data-act="edit" aria-label="Edit task"><svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg></button>
    </li>`;
  }

  function formHTML(t) {
    const isNew = !t.id;
    return `<div class="tf-body">
        <div class="tf-row">
          <label>Subject<select name="subject">${SUBJECTS.map(s => `<option${s === t.subject ? ' selected' : ''}>${s}</option>`).join('')}</select></label>
          <label>Topic<input type="text" name="topic" value="${esc(t.topic)}" placeholder="e.g. 3 Stoichiometry"></label>
        </div>
        <label>What are you working on?<input type="text" name="title" value="${esc(t.title)}" placeholder="e.g. 3.3 Reacting masses" required></label>
        <div class="tf-row">
          <label>Est. pomodoros<span class="stepper"><button type="button" data-step="-1">−</button><input type="number" name="est" min="1" max="20" value="${t.est || 1}"><button type="button" data-step="1">+</button></span></label>
          <label>Score (from SME)<span class="stepper"><input type="number" name="score" min="0" value="${esc(t.score)}" placeholder="got"> / <input type="number" name="outOf" min="0" value="${esc(t.outOf)}" placeholder="out of"></span></label>
        </div>
        <label>Notes / mistakes<textarea name="notes" placeholder="What went wrong? (optional)">${esc(t.notes)}</textarea></label>
      </div>
      <div class="tf-foot">
        ${isNew ? '' : '<button type="button" class="btn ghost" data-form="delete">Delete</button>'}
        <span class="spacer"></span>
        <button type="button" class="btn ghost" data-form="cancel">Cancel</button>
        <button type="submit" class="btn primary">Save</button>
      </div>`;
  }

  function bindForm(form, t) {
    form.addEventListener('click', e => {
      const step = e.target.closest('[data-step]');
      if (step) { const i = form.elements.est; i.value = Math.max(1, (+i.value || 1) + +step.dataset.step); }
      const act = e.target.closest('[data-form]');
      if (act?.dataset.form === 'cancel') { editingId = null; renderTasks(); }
      if (act?.dataset.form === 'delete') {
        tasks = tasks.filter(x => x.id !== t.id);
        if (activeId === t.id) activeId = tasks.find(x => !x.done)?.id || null;
        editingId = null; saveTasks(); renderTasks(); renderClock();
      }
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = form.elements;
      const before = { score: t.score, outOf: t.outOf, notes: t.notes };
      Object.assign(t, {
        subject: f.subject.value, topic: f.topic.value.trim(), title: f.title.value.trim(),
        est: Math.max(1, +f.est.value || 1), score: f.score.value, outOf: f.outOf.value, notes: f.notes.value.trim(),
      });
      if (!t.id) {
        t.id = uid(); t.act = 0; t.done = false; t.date = today(); t.activity = '';
        tasks.push(t);
        if (!activeTask()) activeId = t.id;
      }
      if (t.date && t.subject !== 'Other' && PLAN.days[t.date]?.some(p => p.subject === t.subject)
          && (before.score !== t.score || before.outOf !== t.outOf || before.notes !== t.notes)) {
        queue({ action: 'update', date: t.date, subject: t.subject, fields: { score: t.score === '' ? null : +t.score, outOf: t.outOf === '' ? null : +t.outOf, notes: t.notes } });
      }
      editingId = null; saveTasks(); renderTasks(); renderClock();
    });
    form.querySelector('[name="title"]').focus();
  }

  function renderTasks() {
    const ul = $('#tasks');
    ul.innerHTML = tasks.map(t => t.id === editingId
      ? `<li><form class="task-form" data-edit="${t.id}">${formHTML(t)}</form></li>` : taskHTML(t)).join('');
    const editForm = ul.querySelector('form[data-edit]');
    if (editForm) bindForm(editForm, tasks.find(t => t.id === editingId));

    const newForm = $('#task-form');
    newForm.hidden = editingId !== 'new';
    $('#btn-add-task').hidden = editingId === 'new';
    if (editingId === 'new' && !newForm.dataset.bound) {
      const t = { subject: activeTask()?.subject || 'Physics', topic: '', title: '', est: 1, score: '', outOf: '', notes: '' };
      newForm.innerHTML = formHTML(t);
      newForm.dataset.bound = '1';
      bindForm(newForm, t);
    }
    if (editingId !== 'new') { newForm.innerHTML = ''; delete newForm.dataset.bound; }

    const t = activeTask();
    $('#working-on').innerHTML = t && !t.done ? `Working on: <b>${esc(t.subject)}</b> – ${esc(t.title)}` : (tasks.length ? 'Tap a task to work on it' : '');

    // footer: pomodoros + finish time
    const open = tasks.filter(x => !x.done);
    const est = tasks.reduce((a, x) => a + x.est, 0), act = tasks.reduce((a, x) => a + x.act, 0);
    const left = open.reduce((a, x) => a + Math.max(x.est - x.act, 0), 0);
    if (!tasks.length) { $('#tasks-foot').innerHTML = ''; } else {
      const longs = left > 0 ? Math.floor(((timer.sinceLong % settings.longInterval) + left - 1) / settings.longInterval) : 0;
      const mins = left * settings.pomodoro + Math.max(left - 1, 0) * settings.short + longs * (settings.long - settings.short);
      const fin = new Date(Date.now() + mins * 60000);
      $('#tasks-foot').innerHTML = `<span>Pomos: <b>${act}/${est}</b></span>` +
        (left ? `<span>Finish at: <b>${pad(fin.getHours())}:${pad(fin.getMinutes())}</b> (${fmtH(mins)}h)</span>` : '<span>All planned pomodoros done</span>');
    }
  }

  $('#tasks').addEventListener('click', e => {
    const li = e.target.closest('.task'); if (!li) return;
    const t = tasks.find(x => x.id === li.dataset.id); if (!t) return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'check') return setDone(t, !t.done);
    if (act === 'edit') { editingId = t.id; return renderTasks(); }
    if (!t.done) { activeId = t.id; saveTasks(); renderTasks(); renderClock(); }
  });
  $('#btn-add-task').addEventListener('click', () => { editingId = 'new'; renderTasks(); });

  const planDate = $('#plan-date');
  planDate.value = today() < PLAN.start ? PLAN.start : today() > PLAN.end ? PLAN.end : today();
  planDate.min = PLAN.start; planDate.max = PLAN.end;
  function renderPlanNote() {
    const d = today();
    $('#plan-note').textContent = d < PLAN.start
      ? `The month plan starts ${fmtDay(PLAN.start)}. Pick a date above and use ⋮ → Load plan to preview it.`
      : d > PLAN.end ? `This month's plan ended ${fmtDay(PLAN.end)}. Generate next month's plan to continue.` : '';
  }

  const menu = $('#task-menu');
  $('#btn-task-menu').addEventListener('click', e => { e.stopPropagation(); menu.hidden = !menu.hidden; });
  document.addEventListener('click', () => { menu.hidden = true; });
  menu.addEventListener('click', e => {
    const a = e.target.closest('[data-menu]')?.dataset.menu;
    if (a === 'load') loadPlan(planDate.value);
    if (a === 'clear-done') { tasks = tasks.filter(t => !t.done); saveTasks(); renderTasks(); }
    if (a === 'clear-all' && confirm('Remove all tasks? (Logged time is kept.)')) { tasks = []; activeId = null; saveTasks(); renderTasks(); renderClock(); }
  });

  // new day: drop finished tasks from earlier days, auto-load today's plan
  function dayRollover() {
    const d = today();
    const before = tasks.length;
    tasks = tasks.filter(t => !(t.done && t.date && t.date < d));
    if (tasks.length !== before) saveTasks();
    if (store.get('autoLoaded') !== d && PLAN.days[d]) { loadPlan(d, true); store.set('autoLoaded', d); }
  }

  // ------------------------------------------------------------------ dataset (sheet or local)
  function sheetRows() { return connected() && rowsCache?.rows ? rowsCache.rows : null; }
  function dataset() {
    const rows = sheetRows();
    if (rows) {
      return { source: 'sheet', rows: rows.map(r => ({
        date: r.date, subject: r.subject, topic: r.topic, objective: r.objective,
        planned: +r.planned || 0, actual: +r.actual || 0, status: r.status || '', verified: r.verified || '',
        score: r.score, outOf: r.outOf, pomodoros: r.pomodoros, notes: r.notes, comment: r.comment, row: r.row,
      })) };
    }
    const mins = {};
    log.forEach(l => { const k = `${l.date}|${l.subject}`; mins[k] = (mins[k] || 0) + l.minutes; });
    const out = [];
    Object.entries(PLAN.days).forEach(([date, items]) => items.forEach(e => {
      const k = `${date}|${e.subject}`;
      out.push({ date, subject: e.subject, topic: e.topic, objective: e.objective, planned: e.planned,
        actual: mins[k] || 0, status: doneKeys[k] ? 'Done' : '', verified: '' });
      delete mins[k];
    }));
    Object.entries(mins).forEach(([k, m]) => {
      const [date, subject] = k.split('|');
      out.push({ date, subject, topic: '', objective: 'Extra study', planned: 0, actual: m, status: '', verified: '' });
    });
    return { source: 'local', rows: out };
  }
  function perDay(rows) {
    const m = {};
    rows.forEach(r => {
      m[r.date] = m[r.date] || { mins: 0, verified: 0, done: 0 };
      m[r.date].mins += r.actual;
      if (r.verified === 'Verified') m[r.date].verified++;
      if (r.status === 'Done') m[r.date].done++;
    });
    return m;
  }
  function streak(days) {
    let d = today(), n = 0;
    if (!(days[d]?.mins >= minTarget())) d = addDays(d, -1); // today still in progress
    while (days[d]?.mins >= minTarget()) { n++; d = addDays(d, -1); }
    return n;
  }

  // ------------------------------------------------------------------ router
  const views = ['timer', 'tracker', 'review', 'progress'];
  function route() {
    const v = views.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'timer';
    $$('.view').forEach(s => { s.hidden = s.dataset.view !== v; });
    $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.nav === v));
    if (v === 'tracker') renderTracker();
    if (v === 'review') renderReview();
    if (v === 'progress') renderProgress();
    if (v === 'timer') { renderGoal(); renderTasks(); }
  }
  addEventListener('hashchange', route);

  // ------------------------------------------------------------------ tracker
  function setupSteps() {
    return `<ol>
      <li>Upload <b>IGCSE_Tracker_16Nov-16Dec.xlsx</b> to Google Drive and open it with Google Sheets.</li>
      <li>Copy the sheet's link and paste it into <b>Settings → Google Sheet → Sheet link</b>.</li>
      <li>Optional, for auto-logging and the Review page: add the connector (see <b>SETUP.md</b>) and paste its URL and your key.</li>
    </ol>`;
  }
  function renderTracker() {
    const body = $('#tracker-body');
    const link = $('#open-sheet');
    link.hidden = !settings.sheetUrl;
    link.href = settings.sheetUrl || '#';
    if (!settings.sheetUrl) {
      body.innerHTML = `<div class="empty"><h3>Connect the Google Sheet</h3>${setupSteps()}
        <p style="margin-top:12px"><button class="btn primary" data-open-settings>Open Settings</button></p></div>
        <h2 class="sec">Plan for ${fmtDay(planDate.value)}</h2>${planTable(planDate.value)}`;
      return;
    }
    if (!body.querySelector('iframe') || body.querySelector('iframe').dataset.src !== settings.sheetUrl) {
      body.innerHTML = `<iframe class="sheet-frame" title="Study tracker sheet" src="${esc(settings.sheetUrl)}" data-src="${esc(settings.sheetUrl)}"></iframe>
        <p class="muted" style="font-size:13px">Sheet not showing or not editable? Make sure you're signed in to Google in this browser, or use “Open in Google Sheets”.</p>`;
    }
  }
  function planTable(date) {
    const items = PLAN.days[date] || [];
    if (!items.length) return '<p class="muted">No plan for this date.</p>';
    return `<div class="rv-list">${items.map(e => `<div class="rv-item"><div class="rv-top"><b>${esc(e.subject)}</b><span class="muted">${e.planned} min</span></div>
      <div>${esc(e.objective)}</div><div class="rv-facts"><span>${esc(e.topic)}</span><span>${esc(e.activity)}</span></div></div>`).join('')}</div>`;
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-open-settings]')) openSettings(); });

  // ------------------------------------------------------------------ review
  const reviewDate = $('#review-date');
  reviewDate.value = today();
  reviewDate.addEventListener('change', () => renderReview());
  $('#review-refresh').addEventListener('click', () => renderReview(true));

  async function renderReview(force = false) {
    const body = $('#review-body');
    if (!connected()) {
      body.innerHTML = `<div class="empty"><h3>Connect the sheet to review here</h3>
        <p>The Review page reads what he logged from the Google Sheet, so it works on your phone too.</p>${setupSteps()}
        <p>Until then, you can tick <b>Verified by Varsha</b> (column Q) directly in the sheet.</p>
        <p class="row-gap" style="margin-top:12px"><button class="btn primary" data-open-settings>Open Settings</button>
        ${settings.sheetUrl ? `<a class="btn" href="${esc(settings.sheetUrl)}" target="_blank" rel="noopener">Open sheet ↗</a>` : ''}</p></div>`;
      return;
    }
    if (force || !rowsCache || Date.now() - rowsCache.at > 60000) {
      body.innerHTML = '<p class="muted">Loading from the sheet…</p>';
      try { await fetchRows(); } catch (e) { body.innerHTML = `<div class="empty"><h3>Couldn't load the sheet</h3><p>${esc(e.message)}</p></div>`; return; }
    }
    const date = reviewDate.value;
    const rows = rowsCache.rows.filter(r => r.date === date);
    const isVarsha = settings.role === 'varsha';
    const mins = rows.reduce((a, r) => a + (+r.actual || 0), 0);
    const result = mins >= fullTarget() ? 'Full day' : mins >= minTarget() ? 'Pass' : 'Below minimum';
    const done = rows.filter(r => r.status === 'Done').length;
    const ver = rows.filter(r => r.verified === 'Verified').length;
    body.innerHTML = `
      <div class="rv-summary">
        <span>Logged <b>${fmtHM(mins)}</b></span>
        <span><span class="pill ${result === 'Full day' ? 'solid' : result === 'Pass' ? '' : 'grey'}">${result}</span></span>
        <span>Done <b>${done}/${rows.length}</b></span>
        <span>Verified <b>${ver}/${rows.length}</b></span>
      </div>
      ${isVarsha && rows.length ? '<p class="row-gap"><button class="btn" id="verify-all">Mark all “Done” as verified</button></p>' : ''}
      ${!isVarsha ? '<p class="muted" style="font-size:13px">Read-only: only Varsha\'s key can verify.</p>' : ''}
      <div class="rv-list">${rows.length ? rows.map(r => reviewItem(r, isVarsha)).join('') : '<p class="muted">Nothing planned or logged for this date.</p>'}</div>`;
    if (isVarsha) bindReview(body, rows);
  }
  function reviewItem(r, editable) {
    const pct = r.score !== '' && +r.outOf ? Math.round(r.score / r.outOf * 100) + '%' : '';
    const v = r.verified || '';
    return `<div class="rv-item${v === 'Verified' ? ' verified' : ''}" data-subject="${esc(r.subject)}">
      <div class="rv-top"><b>${esc(r.subject)}</b><span class="pill ${r.status === 'Done' ? 'solid' : r.status === 'Partial' ? '' : 'grey'}">${esc(r.status || 'Not started')}</span></div>
      <div>${esc(r.objective)}</div>
      <div class="rv-facts">
        <span>Planned <b>${+r.planned || 0}m</b></span><span>Actual <b>${+r.actual || 0}m</b></span>
        <span>Pomodoros <b>${+r.pomodoros || 0}</b></span>${pct ? `<span>Score <b>${esc(r.score)}/${esc(r.outOf)} (${pct})</b></span>` : ''}
      </div>
      ${r.notes ? `<div class="rv-notes">${esc(r.notes)}</div>` : ''}
      ${editable ? `<div class="rv-actions">
        <div class="seg" role="group" aria-label="Verification">${['Verified', 'Partial', 'Not verified'].map(o => `<button type="button" data-v="${o}" class="${v === o ? 'on' : ''}">${o}</button>`).join('')}</div>
        <input type="text" data-comment placeholder="Comment (optional)" value="${esc(r.comment)}">
      </div>` : (v ? `<div class="rv-facts"><span>Varsha: <b>${esc(v)}</b></span>${r.comment ? `<span>${esc(r.comment)}</span>` : ''}</div>` : '')}
    </div>`;
  }
  function bindReview(body, rows) {
    const date = reviewDate.value;
    const save = async (r, fields, el) => {
      Object.assign(r, fields);
      try { await api({ action: 'update', date, subject: r.subject, fields }); toast('Saved'); }
      catch (e) { toast('Not saved: ' + e.message); }
      store.set('rows', rowsCache);
      if (el) el.classList.toggle('verified', r.verified === 'Verified');
    };
    body.querySelectorAll('.rv-item').forEach(el => {
      const r = rows.find(x => x.subject === el.dataset.subject);
      el.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => {
        el.querySelectorAll('[data-v]').forEach(x => x.classList.toggle('on', x === b));
        save(r, { verified: b.dataset.v }, el);
      }));
      const c = el.querySelector('[data-comment]');
      c?.addEventListener('change', () => save(r, { comment: c.value.trim() }));
    });
    $('#verify-all')?.addEventListener('click', async () => {
      const todo = rows.filter(r => r.status === 'Done' && r.verified !== 'Verified');
      for (const r of todo) await save(r, { verified: 'Verified' });
      renderReview();
    });
  }

  // ------------------------------------------------------------------ progress
  $('#progress-refresh').addEventListener('click', () => renderProgress(true));
  async function renderProgress(force = false) {
    if (connected() && (force || !rowsCache || Date.now() - rowsCache.at > 5 * 60000)) {
      $('#progress-source').textContent = 'Loading from the sheet…';
      try { await fetchRows(); } catch (e) { toast('Sheet: ' + e.message); }
    }
    const { source, rows } = dataset();
    $('#progress-source').textContent = source === 'sheet'
      ? `From the Google Sheet · updated ${new Date(rowsCache.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'From this device only. Connect the sheet in Settings to combine everything.';
    const days = perDay(rows);
    const d = today();
    const weekStart = addDays(d, -((parseIso(d).getDay() + 6) % 7));
    const sumRange = (a, b) => Object.entries(days).filter(([k]) => k >= a && k <= b).reduce((s, [, v]) => s + v.mins, 0);
    const monthMins = sumRange(PLAN.start, PLAN.end);
    const monthPlanned = rows.filter(r => r.date >= PLAN.start && r.date <= PLAN.end).reduce((s, r) => s + r.planned, 0);
    const lastDay = d < PLAN.end ? (d < PLAN.start ? null : d) : PLAN.end;
    let elapsed = 0, passDays = 0;
    if (lastDay) for (let x = PLAN.start; x <= lastDay; x = addDays(x, 1)) { elapsed++; if (days[x]?.mins >= minTarget()) passDays++; }
    const doneN = rows.filter(r => r.status === 'Done').length;
    const verN = rows.filter(r => r.verified === 'Verified').length;
    const tile = (k, v, s) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
    $('#tiles').innerHTML = [
      tile('Today', fmtH(days[d]?.mins || 0) + 'h', `min ${settings.minHours}h · full ${settings.fullHours}h`),
      tile('This week', fmtH(sumRange(weekStart, d)) + 'h', `since ${fmtDay(weekStart)}`),
      tile('Month', fmtH(monthMins) + 'h', `of ${fmtH(monthPlanned)}h planned`),
      tile(`Days ≥ ${settings.minHours}h`, `${passDays}/${elapsed}`, 'days so far'),
      tile('Streak', streak(days), `days ≥ ${settings.minHours}h in a row`),
      source === 'sheet' ? tile('Verified', `${verN}`, `of ${doneN} done objectives`) : tile('Objectives done', doneN, `of ${rows.filter(r => r.planned > 0).length}`),
    ].join('');

    // heatmap
    const start = PLAN.start, end = PLAN.end;
    const firstMon = addDays(start, -((parseIso(start).getDay() + 6) % 7));
    let cells = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(x => `<div class="dow">${x}</div>`).join('');
    for (let x = firstMon; x <= end || (parseIso(x).getDay() + 6) % 7 !== 0; x = addDays(x, 1)) {
      if (x < start || x > end) { cells += '<div class="cell blank"></div>'; continue; }
      const m = days[x]?.mins || 0;
      const lv = m >= fullTarget() ? 3 : m >= minTarget() ? 2 : m > 0 ? 1 : 0;
      cells += `<div class="cell${lv ? ' l' + lv : ''}${x === d ? ' today' : ''}${days[x]?.verified ? ' ver' : ''}" title="${fmtDay(x)}: ${fmtHM(m)}${days[x]?.verified ? ' · verified' : ''}">${parseIso(x).getDate()}</div>`;
    }
    $('#heatmap').innerHTML = `<div class="heat">${cells}</div>
      <div class="legend"><span><i></i>None</span><span><i class="l1"></i>&lt; ${settings.minHours}h</span><span><i class="l2"></i>${settings.minHours}h pass</span><span><i class="l3"></i>${settings.fullHours}h full</span><span>• verified</span></div>`;

    // subject bars
    const subj = {};
    rows.filter(r => r.date >= start && r.date <= end).forEach(r => {
      subj[r.subject] = subj[r.subject] || { a: 0, p: 0 };
      subj[r.subject].a += r.actual; subj[r.subject].p += r.planned;
    });
    $('#subject-bars').innerHTML = `<div class="bars">${SUBJECTS.filter(s => subj[s]).map(s => {
      const { a, p } = subj[s];
      return `<div class="bar-row"><span>${esc(s)}</span><div class="bar-track"><div class="bar-fill" style="width:${p ? Math.min(a / p, 1) * 100 : 100}%"></div></div><span class="n">${fmtH(a)} / ${fmtH(p)}h</span></div>`;
    }).join('')}</div>`;

    // topic coverage
    const cov = {};
    rows.filter(r => r.topic && r.topic !== 'Review' && r.planned > 0).forEach(r => {
      cov[r.subject] = cov[r.subject] || {};
      const t = cov[r.subject][r.topic] = cov[r.subject][r.topic] || { n: 0, done: 0 };
      t.n++; if (r.status === 'Done') t.done++;
    });
    $('#coverage').innerHTML = SUBJECTS.filter(s => cov[s]).map(s => `<div class="cov-subject"><h3>${esc(s)}</h3>${
      Object.entries(cov[s]).map(([topic, { n, done }]) => `<div class="cov-row"><span>${esc(topic)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${done / n * 100}%"></div></div><span class="n">${done}/${n}</span></div>`).join('')
    }</div>`).join('');
  }

  // ------------------------------------------------------------------ report (pomofocus-style)
  function openReport() {
    const days = {};
    log.forEach(l => { days[l.date] = (days[l.date] || 0) + l.minutes; });
    const total = Object.values(days).reduce((a, b) => a + b, 0);
    let st = 0, x = today();
    if (!(days[x] >= minTarget())) x = addDays(x, -1);
    while (days[x] >= minTarget()) { st++; x = addDays(x, -1); }
    const last7 = [...Array(7)].map((_, i) => addDays(today(), i - 6));
    const max = Math.max(fullTarget(), ...last7.map(k => days[k] || 0));
    const W = 320, H = 150, bw = 30, gap = (W - 7 * bw) / 7;
    const yMin = H - 20 - (minTarget() / max) * (H - 40);
    const bars = last7.map((k, i) => {
      const h = ((days[k] || 0) / max) * (H - 40);
      const xx = gap / 2 + i * (bw + gap);
      return `<rect class="b" x="${xx}" y="${H - 20 - h}" width="${bw}" height="${Math.max(h, 0)}" rx="3"><title>${fmtDay(k)}: ${fmtHM(days[k] || 0)}</title></rect>
        <text x="${xx + bw / 2}" y="${H - 5}" text-anchor="middle">${parseIso(k).toLocaleDateString('en-GB', { weekday: 'short' })}</text>`;
    }).join('');
    const weekStart = addDays(today(), -6);
    const bySub = {};
    log.filter(l => l.date >= weekStart).forEach(l => { bySub[l.subject] = (bySub[l.subject] || 0) + l.minutes; });
    const subMax = Math.max(1, ...Object.values(bySub));
    $('#report-body').innerHTML = `
      <div class="rep-tiles">
        <div class="tile"><div class="k">Hours focused</div><div class="v">${fmtH(total)}</div></div>
        <div class="tile"><div class="k">Days accessed</div><div class="v">${visits.size}</div></div>
        <div class="tile"><div class="k">Day streak</div><div class="v">${st}</div></div>
      </div>
      <h3>Last 7 days (hours)</h3>
      <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Focus hours for the last 7 days">
        <line class="axis" x1="0" x2="${W}" y1="${H - 20}" y2="${H - 20}"/>
        <line class="axis" x1="0" x2="${W}" y1="${yMin}" y2="${yMin}" stroke-dasharray="4 4"/>
        <text x="${W}" y="${yMin - 4}" text-anchor="end">${settings.minHours}h</text>
        ${bars}
      </svg>
      <h3>By subject (last 7 days)</h3>
      <div class="bars">${Object.keys(bySub).length ? Object.entries(bySub).sort((a, b) => b[1] - a[1]).map(([s, m]) =>
        `<div class="bar-row"><span>${esc(s)}</span><div class="bar-track"><div class="bar-fill" style="width:${m / subMax * 100}%"></div></div><span class="n">${fmtHM(m)}</span></div>`).join('')
        : '<p class="muted">No focus time yet. Start a pomodoro!</p>'}</div>
      <p class="muted" style="font-size:12px;margin:0">Report uses timer data on this device.</p>`;
    $('#dlg-report').showModal();
  }
  $('#btn-report').addEventListener('click', openReport);
  $('#dlg-report').addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target.id === 'dlg-report') e.currentTarget.close(); });

  // ------------------------------------------------------------------ settings dialog
  const dlg = $('#dlg-settings'), sf = $('#settings-form');
  function openSettings() {
    Object.entries(settings).forEach(([k, v]) => {
      const el = sf.elements[k]; if (!el) return;
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
    });
    $('#conn-status').textContent = settings.role ? `Connected as ${settings.role === 'varsha' ? 'Varsha' : 'student'}` : '';
    dlg.showModal();
  }
  function readForm() {
    const out = {};
    Object.keys(DEFAULTS).forEach(k => {
      const el = sf.elements[k]; if (!el) return;
      if (el.type === 'checkbox') out[k] = el.checked;
      else if (el.type === 'number' || el.type === 'range') out[k] = +el.value > 0 || k === 'volume' ? +el.value : DEFAULTS[k];
      else out[k] = el.value.trim();
    });
    if (out.fullHours < out.minHours) out.fullHours = out.minHours;
    return out;
  }
  $('#btn-settings').addEventListener('click', openSettings);
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'save') return;
    const old = { ...settings };
    settings = { ...settings, ...readForm() };
    if (old.scriptUrl !== settings.scriptUrl || old.key !== settings.key) { settings.role = ''; rowsCache = null; store.set('rows', null); }
    saveSettings();
    if (settings.notify && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    if (!timer.running && ['pomodoro', 'short', 'long'].some(k => old[k] !== settings[k])) setMode(timer.mode);
    applyTheme(); route(); flush();
    toast('Settings saved');
  });
  $('#btn-test-conn').addEventListener('click', async () => {
    const f = readForm();
    const st = $('#conn-status');
    if (!f.scriptUrl || !f.key) { st.textContent = 'Add the connector URL and key first.'; return; }
    st.textContent = 'Testing…';
    const keep = { scriptUrl: settings.scriptUrl, key: settings.key };
    Object.assign(settings, { scriptUrl: f.scriptUrl, key: f.key });
    try {
      const r = await api({ action: 'ping' });
      settings.role = r.role;
      st.textContent = `✓ Connected as ${r.role === 'varsha' ? 'Varsha (can verify)' : 'student'}`;
    } catch (e) {
      Object.assign(settings, keep);
      st.textContent = '✕ ' + (e.message === 'Failed to fetch' ? 'Could not reach the connector. Check the URL and that it is deployed to “Anyone”.' : e.message);
    }
  });
  $('[name="alarm"]', sf).addEventListener('change', e => { ac(); playAlarm(e.target.value); });

  // ------------------------------------------------------------------ boot
  dayRollover();
  setInterval(() => { if (timer.day !== today() && !timer.running) { timer.round = 1; timer.sinceLong = 0; timer.day = today(); saveTimer(); renderTimer(); } dayRollover(); }, 60000);
  applyTheme();
  renderPlanNote();
  renderTimer();
  renderTasks();
  renderGoal();
  route();
  flush();
})();
