// Presenter: owns the game, counts the votes, and drives the TV display + phones over the relay.
(function () {
  const { BROKERS, topic, rid, lsGet, lsSet, connect, parse, el, badge } = DP;
  const KEY = 'debatable-host-v1';

  const SAMPLE = [
    { prompt: 'Is a hot dog a sandwich?', options: ['Yes', 'No'] },
    { prompt: 'Best Thanksgiving pie?', options: ['Pumpkin', 'Pecan', 'Apple'] },
    { prompt: 'Stuffing or mashed potatoes?', options: ['Stuffing', 'Mashed potatoes'] },
  ];

  let S = lsGet(KEY, null);
  if (!S) {
    S = {
      room: rid(5), broker: 0, defaults: ['Yes', 'No'],
      questions: SAMPLE.map(q => ({ id: rid(8), prompt: q.prompt, options: q.options.slice() })),
      idx: 0, phase: 'ready', votes: {}, live: false, screen: 'setup',
    };
  }
  if (S.showQR === undefined) S.showQR = true;
  const save = () => { lsSet(KEY, S); };

  const $ = id => document.getElementById(id);
  const cur = () => S.questions[S.idx];
  const optsFor = q => (q && q.options && q.options.filter(o => o.trim()).length >= 2) ? q.options.filter(o => o.trim()) : S.defaults;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 2400); }
  function ask(text) {
    return new Promise(res => {
      $('modalText').textContent = text; $('modal').classList.remove('hidden');
      const done = v => { $('modal').classList.add('hidden'); $('modalYes').onclick = $('modalNo').onclick = null; res(v); };
      $('modalYes').onclick = () => done(true); $('modalNo').onclick = () => done(false);
    });
  }

  function tally(q) {
    const counts = optsFor(q).map(() => 0);
    const v = (S.votes[q.id] || {});
    Object.values(v).forEach(c => { if (c >= 0 && c < counts.length) counts[c]++; });
    return { counts, total: counts.reduce((a, b) => a + b, 0), voters: Object.keys(v) };
  }

  // ---------- relay ----------
  let client = null;
  function setStatus(s) { badge($('connBadge1'), s); badge($('connBadge2'), s); if (s === 'online') publishAll(); }
  function startRelay() {
    if (client) { try { client.end(true); } catch (e) {} }
    client = connect(S.broker, setStatus);
    client.on('connect', () => client.subscribe(topic(S.room, 'vote'), { qos: 1 }));
    client.on('message', (t, buf) => {
      if (t === topic(S.room, 'vote')) return onVote(parse(buf));
      if (pulling && t === topic(pulling, 'questions')) return onPulled(parse(buf));
    });
  }
  function onVote(m) {
    if (!m || typeof m.device !== 'string' || typeof m.qid !== 'string') return;
    const q = cur();
    if (!q || m.qid !== q.id || S.phase !== 'open' || S.screen !== 'stage') { publishTally(); return; }
    const c = Number(m.choice);
    if (!Number.isInteger(c) || c < 0 || c >= optsFor(q).length) return;
    const dev = m.device.slice(0, 40);
    S.votes[q.id] = S.votes[q.id] || {};
    if (S.votes[q.id][dev] !== c) { S.votes[q.id][dev] = c; save(); renderStage(); publishDisplaySoon(); }
    publishTallySoon();
  }

  const pub = (kind, obj, retain) => { if (client && client.connected) client.publish(topic(S.room, kind), JSON.stringify(obj), { qos: 1, retain: !!retain }); };

  // what phones see (no counts until reveal)
  function publishState() {
    const q = cur();
    let msg;
    if (S.screen === 'stage' && q) {
      msg = { phase: S.phase, qid: q.id, n: S.idx + 1, total: S.questions.length, prompt: q.prompt, options: optsFor(q), ts: Date.now() };
      if (S.phase === 'reveal') msg.results = tally(q).counts;
    } else msg = { phase: S.screen === 'end' ? 'end' : 'lobby', ts: Date.now() };
    pub('state', msg, true);
  }
  // what the TV shows
  function publishDisplay() {
    const q = cur();
    const msg = { screen: S.screen === 'stage' && q ? 'stage' : S.screen === 'end' ? 'end' : 'lobby', showQR: !!S.showQR, live: !!S.live, ts: Date.now() };
    if (msg.screen === 'stage') {
      const t = tally(q);
      Object.assign(msg, { phase: S.phase, qid: q.id, n: S.idx + 1, total: S.questions.length, prompt: q.prompt, options: optsFor(q), votes: t.total });
      if (S.phase === 'reveal' || S.live) msg.counts = t.counts;
    }
    pub('display', msg, true);
  }
  function publishTally() {
    const q = cur(); if (!q) return;
    const t = tally(q);
    pub('tally', { qid: q.id, total: t.total, voters: t.voters }, false);
  }
  function publishQuestions() { pub('questions', { defaults: S.defaults, questions: S.questions.map(q => ({ prompt: q.prompt, options: q.options })) }, true); }
  function publishAll() { publishState(); publishDisplay(); publishTally(); publishQuestions(); }

  let dT = null, tT = null, qT = null;
  function publishDisplaySoon() { if (!dT) dT = setTimeout(() => { dT = null; publishDisplay(); }, 300); }
  function publishTallySoon() { if (!tT) tT = setTimeout(() => { tT = null; publishTally(); }, 250); }
  function saveQuestions() { save(); clearTimeout(qT); qT = setTimeout(publishQuestions, 800); }
  setInterval(() => { if (S.screen === 'stage' && S.phase === 'open') publishTally(); }, 4000);
  setInterval(() => { publishState(); publishDisplay(); }, 15000);

  // ---------- copy questions from another device ----------
  let pulling = null, pullTimer = null;
  $('pullBtn').onclick = () => {
    const code = $('pullCode').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) return toast('Type the other device\'s room code');
    if (code === S.room) return toast('That\'s this device\'s own code');
    if (!client || !client.connected) return toast('Not connected yet — try again in a second');
    pulling = code;
    client.subscribe(topic(code, 'questions'), { qos: 1 });
    toast('Looking for room ' + code + '…');
    clearTimeout(pullTimer);
    pullTimer = setTimeout(() => { if (pulling) { stopPull(); toast('Couldn\'t find it. Open the link on the other device first, then try again.'); } }, 8000);
  };
  function stopPull() { if (pulling && client) client.unsubscribe(topic(pulling, 'questions')); pulling = null; clearTimeout(pullTimer); }
  async function onPulled(d) {
    const code = pulling; stopPull();
    if (!d || !Array.isArray(d.questions) || !d.questions.length) return toast('Room ' + code + ' has no questions');
    const ok = await ask('Replace the ' + S.questions.length + ' questions here with the ' + d.questions.length + ' from room ' + code + '?');
    if (!ok) return;
    S.questions = d.questions.map(q => ({ id: rid(8), prompt: String(q.prompt || ''), options: Array.isArray(q.options) ? q.options.map(String).slice(0, 6) : [] }));
    if (Array.isArray(d.defaults) && d.defaults.length >= 2) S.defaults = d.defaults.map(String);
    S.idx = 0; S.phase = 'ready'; S.votes = {}; saveQuestions(); renderSetup(); $('pullCode').value = '';
    toast('Copied ' + S.questions.length + ' questions');
  }

  // ---------- setup screen ----------
  function renderRoom() { document.querySelectorAll('.roomCodeOut').forEach(n => n.textContent = S.room); }
  function renderSetup() {
    renderRoom();
    $('defaults').value = S.defaults.join(' | ');
    const sel = $('brokerSel'); sel.innerHTML = '';
    BROKERS.forEach((b, i) => { const o = el('option', null, b.name); o.value = i; if (i === S.broker) o.selected = true; sel.appendChild(o); });
    $('qCount').textContent = '(' + S.questions.length + ')';
    const list = $('qList'); list.innerHTML = '';
    S.questions.forEach((q, i) => {
      const li = el('li', 'qitem');
      const num = el('div', 'qnum', String(i + 1));
      const body = el('div', 'qbody');
      const p = el('input'); p.type = 'text'; p.value = q.prompt; p.placeholder = 'Question'; p.className = 'qprompt';
      p.addEventListener('input', () => { q.prompt = p.value; saveQuestions(); });
      const o = el('input'); o.type = 'text'; o.value = (q.options || []).join(' | '); o.className = 'qopts';
      o.placeholder = 'Choices, e.g. Yes | No   (blank = ' + S.defaults.join(' | ') + ')';
      o.addEventListener('input', () => { q.options = o.value.split('|').map(s => s.trim()).filter(Boolean).slice(0, 6); saveQuestions(); });
      body.append(p, o);
      const tools = el('div', 'qtools');
      const up = el('button', 'icon', '↑'); up.title = 'Move up'; up.disabled = i === 0;
      up.onclick = () => { S.questions.splice(i - 1, 0, S.questions.splice(i, 1)[0]); saveQuestions(); renderSetup(); };
      const dn = el('button', 'icon', '↓'); dn.title = 'Move down'; dn.disabled = i === S.questions.length - 1;
      dn.onclick = () => { S.questions.splice(i + 1, 0, S.questions.splice(i, 1)[0]); saveQuestions(); renderSetup(); };
      const del = el('button', 'icon danger', '✕'); del.title = 'Delete';
      del.onclick = async () => {
        if (q.prompt.trim() && !(await ask('Delete "' + q.prompt + '"?'))) return;
        S.questions.splice(i, 1); if (S.idx >= S.questions.length) S.idx = Math.max(0, S.questions.length - 1); saveQuestions(); renderSetup();
      };
      tools.append(up, dn, del);
      li.append(num, body, tools);
      list.appendChild(li);
    });
  }

  $('addQ').onclick = () => {
    S.questions.push({ id: rid(8), prompt: '', options: [] }); saveQuestions(); renderSetup();
    const inputs = document.querySelectorAll('.qprompt'); inputs[inputs.length - 1].focus();
  };
  $('bulkAdd').onclick = () => {
    const lines = $('bulk').value.split('\n').map(s => s.trim()).filter(Boolean);
    lines.forEach(line => {
      const parts = line.split('|').map(s => s.trim());
      S.questions.push({ id: rid(8), prompt: parts[0], options: parts.slice(1).filter(Boolean).slice(0, 6) });
    });
    $('bulk').value = ''; saveQuestions(); renderSetup(); toast('Added ' + lines.length + ' question' + (lines.length === 1 ? '' : 's'));
  };
  $('defaults').addEventListener('input', e => {
    const d = e.target.value.split('|').map(s => s.trim()).filter(Boolean);
    if (d.length >= 2) { S.defaults = d.slice(0, 6); saveQuestions(); }
  });
  $('defaults').addEventListener('change', () => renderSetup());
  $('brokerSel').onchange = e => { S.broker = Number(e.target.value); save(); startRelay(); };
  $('newRoom').onclick = async () => {
    if (!(await ask('Make a new room code? The TV and anyone who already scanned will need the new code.'))) return;
    S.room = rid(5); S.votes = {}; save(); renderSetup(); startRelay();
  };
  $('startBtn').onclick = () => {
    S.questions = S.questions.filter(q => q.prompt.trim());
    if (!S.questions.length) { toast('Add at least one question first'); renderSetup(); return; }
    if (S.idx >= S.questions.length) S.idx = 0;
    saveQuestions(); show('stage');
  };

  // ---------- presenter screen ----------
  function show(screen) {
    S.screen = screen; save();
    ['setup', 'stage', 'end'].forEach(s => $(s).classList.toggle('hidden', s !== screen));
    if (screen === 'setup') renderSetup();
    if (screen === 'stage') { renderRoom(); renderStage(); keepAwake(); }
    publishState(); publishDisplay(); publishTally();
  }

  const PHASE_TEXT = { ready: 'Debating — voting closed', open: 'Voting is open', reveal: 'Results on the TV' };
  const MAIN_TEXT = { ready: 'Open voting', open: 'Close voting & reveal', reveal: 'Next question ▶' };

  function renderStage() {
    const q = cur(); if (!q) return;
    const opts = optsFor(q), t = tally(q);
    $('qNum').textContent = 'Question ' + (S.idx + 1) + ' of ' + S.questions.length;
    $('phaseTag').textContent = PHASE_TEXT[S.phase];
    $('phaseTag').className = 'phase-tag ' + S.phase;
    $('prompt').textContent = q.prompt;
    $('mainBtn').textContent = S.phase === 'reveal' && S.idx === S.questions.length - 1 ? 'Finish ▶' : MAIN_TEXT[S.phase];
    $('liveToggle').checked = !!S.live;
    $('qrToggle').checked = !!S.showQR;
    $('prevBtn').disabled = S.idx === 0;
    $('nextBtn').disabled = S.idx === S.questions.length - 1;

    const box = $('options'); box.innerHTML = '';
    const max = Math.max(...t.counts, 0);
    opts.forEach((label, i) => {
      const row = el('div', 'p-opt c' + (i % 6));
      const pct = t.total ? Math.round(100 * t.counts[i] / t.total) : 0;
      if (t.total && t.counts[i] === max && S.phase !== 'ready') row.classList.add('lead');
      const fill = el('div', 'fill'); fill.style.width = pct + '%';
      const name = el('div', 'oname', label);
      if (S.phase === 'ready') {
        name.contentEditable = 'true'; name.spellcheck = false; name.title = 'Tap to rename';
        name.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); name.blur(); } e.stopPropagation(); });
        name.addEventListener('blur', () => {
          const v = name.textContent.trim(); if (!v) { name.textContent = label; return; }
          const o = optsFor(q).slice(); o[i] = v; q.options = o; saveQuestions(); publishState(); publishDisplay();
        });
      }
      const stat = el('div', 'ostat', S.phase === 'ready' ? '' : t.counts[i] + ' · ' + pct + '%');
      row.append(fill, name, stat);
      box.appendChild(row);
    });
    $('voteCount').textContent = S.phase === 'ready' ? 'Tap a choice to rename it (e.g. the debaters\' names) before opening the vote.'
      : t.total + (t.total === 1 ? ' vote' : ' votes') + (S.phase === 'open' ? ' so far' : '');
  }

  const refresh = () => { save(); renderStage(); publishState(); publishDisplay(); publishTally(); };
  function step() {
    if (S.phase === 'ready') S.phase = 'open';
    else if (S.phase === 'open') S.phase = 'reveal';
    else return next(true);
    refresh();
  }
  const phaseFor = q => (S.votes[q.id] && Object.keys(S.votes[q.id]).length) ? 'reveal' : 'ready';
  function next(fromMain) {
    if (S.idx >= S.questions.length - 1) { if (fromMain === true && S.phase === 'reveal') show('end'); return; }
    S.idx++; S.phase = phaseFor(cur()); refresh();
  }
  function prev() { if (S.idx === 0) return; S.idx--; S.phase = phaseFor(cur()); refresh(); }
  async function resetVotes() {
    if (!(await ask('Clear the votes for this question?'))) return;
    // a fresh id means phones forget their old pick for this question too
    const q = cur(); delete S.votes[q.id]; q.id = rid(8); S.phase = 'ready'; save(); refresh();
  }
  async function resetAll() {
    if (!(await ask('Clear the votes for ALL ' + S.questions.length + ' questions and go back to question 1? This can\'t be undone.'))) return;
    S.votes = {}; S.questions.forEach(q => { q.id = rid(8); });
    S.idx = 0; S.phase = 'ready';
    if (S.screen === 'end') show('stage'); else if (S.screen === 'stage') refresh(); else { save(); publishState(); publishDisplay(); publishTally(); }
    toast('All votes cleared');
  }

  let lock = null;
  async function keepAwake() { try { if (!lock && navigator.wakeLock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } } catch (e) {} }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.screen === 'stage') keepAwake(); });

  $('mainBtn').onclick = step;
  $('nextBtn').onclick = () => next(false);
  $('prevBtn').onclick = prev;
  $('resetBtn').onclick = resetVotes;
  $('resetAllBtn').onclick = resetAll;
  $('resetAllBtn2').onclick = resetAll;
  $('resetAllBtn3').onclick = resetAll;
  $('editBtn').onclick = () => show('setup');
  $('editBtn2').onclick = () => show('setup');
  $('backBtn').onclick = () => show('stage');
  $('liveToggle').onchange = e => { S.live = e.target.checked; save(); publishDisplay(); };
  $('qrToggle').onchange = e => { S.showQR = e.target.checked; save(); publishDisplay(); };

  document.addEventListener('keydown', e => {
    if (S.screen !== 'stage' || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); step(); }
    else if (e.key === 'ArrowRight') next(false);
    else if (e.key === 'ArrowLeft') prev();
  });

  // ---------- boot ----------
  startRelay();
  show(S.screen === 'stage' && S.questions.length ? 'stage' : S.screen === 'end' ? 'end' : 'setup');
})();
