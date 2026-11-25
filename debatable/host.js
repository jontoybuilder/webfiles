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
  const save = () => lsSet(KEY, S);

  // ---------- helpers ----------
  const $ = id => document.getElementById(id);
  const cur = () => S.questions[S.idx];
  const optsFor = q => (q && q.options && q.options.filter(o => o.trim()).length >= 2) ? q.options.filter(o => o.trim()) : S.defaults;
  const voteUrl = () => location.origin + location.pathname.replace(/index\.html$/, '').replace(/\/?$/, '/') + 'vote.html?r=' + S.room + '&b=' + S.broker;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 2200); }

  function tally(q) {
    const opts = optsFor(q);
    const counts = opts.map(() => 0);
    const v = (S.votes[q.id] || {});
    Object.values(v).forEach(c => { if (c >= 0 && c < counts.length) counts[c]++; });
    return { counts, total: counts.reduce((a, b) => a + b, 0), voters: Object.keys(v) };
  }

  // ---------- relay ----------
  let client = null;
  function setStatus(s) { badge($('connBadge1'), s); badge($('connBadge2'), s); if (s === 'online') { publishState(); publishTally(); } }
  function startRelay() {
    if (client) { try { client.end(true); } catch (e) {} }
    client = connect(S.broker, setStatus);
    client.on('connect', () => client.subscribe(topic(S.room, 'vote'), { qos: 1 }));
    client.on('message', (t, buf) => {
      if (t !== topic(S.room, 'vote')) return;
      const m = parse(buf);
      if (!m || typeof m.device !== 'string' || typeof m.qid !== 'string') return;
      const q = cur();
      if (!q || m.qid !== q.id || S.phase !== 'open' || S.screen !== 'stage') { publishTally(); return; }
      const c = Number(m.choice);
      if (!Number.isInteger(c) || c < 0 || c >= optsFor(q).length) return;
      S.votes[q.id] = S.votes[q.id] || {};
      if (S.votes[q.id][m.device.slice(0, 40)] !== c) {
        S.votes[q.id][m.device.slice(0, 40)] = c;
        save(); renderStage();
      }
      publishTallySoon();
    });
  }

  function publishState() {
    if (!client || !client.connected) return;
    const q = cur();
    let msg;
    if (S.screen === 'stage' && q) {
      msg = { phase: S.phase, qid: q.id, n: S.idx + 1, total: S.questions.length, prompt: q.prompt, options: optsFor(q), ts: Date.now() };
      if (S.phase === 'reveal') msg.results = tally(q).counts;
    } else if (S.screen === 'end') {
      msg = { phase: 'end', ts: Date.now() };
    } else {
      msg = { phase: 'lobby', ts: Date.now() };
    }
    client.publish(topic(S.room, 'state'), JSON.stringify(msg), { qos: 1, retain: true });
  }
  let tallyTimer = null;
  function publishTallySoon() { if (!tallyTimer) tallyTimer = setTimeout(() => { tallyTimer = null; publishTally(); }, 250); }
  function publishTally() {
    if (!client || !client.connected) return;
    const q = cur(); if (!q) return;
    const t = tally(q);
    client.publish(topic(S.room, 'tally'), JSON.stringify({ qid: q.id, total: t.total, voters: t.voters }), { qos: 0 });
  }
  setInterval(() => { if (S.screen === 'stage' && S.phase === 'open') publishTally(); }, 4000);

  // ---------- setup screen ----------
  function renderSetup() {
    $('roomCode').textContent = S.room;
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
      p.addEventListener('input', () => { q.prompt = p.value; save(); });
      const o = el('input'); o.type = 'text'; o.value = (q.options || []).join(' | '); o.className = 'qopts';
      o.placeholder = 'Choices, e.g. Yes | No   (blank = defaults: ' + S.defaults.join(' | ') + ')';
      o.addEventListener('input', () => { q.options = o.value.split('|').map(s => s.trim()).filter(Boolean).slice(0, 6); save(); });
      body.append(p, o);
      const tools = el('div', 'qtools');
      const up = el('button', 'icon', '↑'); up.title = 'Move up'; up.disabled = i === 0;
      up.onclick = () => { S.questions.splice(i - 1, 0, S.questions.splice(i, 1)[0]); save(); renderSetup(); };
      const dn = el('button', 'icon', '↓'); dn.title = 'Move down'; dn.disabled = i === S.questions.length - 1;
      dn.onclick = () => { S.questions.splice(i + 1, 0, S.questions.splice(i, 1)[0]); save(); renderSetup(); };
      const del = el('button', 'icon danger', '✕'); del.title = 'Delete';
      del.onclick = () => { if (confirmDel(q)) { S.questions.splice(i, 1); if (S.idx >= S.questions.length) S.idx = Math.max(0, S.questions.length - 1); save(); renderSetup(); } };
      tools.append(up, dn, del);
      li.append(num, body, tools);
      list.appendChild(li);
    });
  }
  function confirmDel(q) { return !q.prompt.trim() || window.confirm('Delete "' + q.prompt + '"?'); }

  $('addQ').onclick = () => {
    S.questions.push({ id: rid(8), prompt: '', options: [] }); save(); renderSetup();
    const inputs = document.querySelectorAll('.qprompt'); inputs[inputs.length - 1].focus();
  };
  $('bulkAdd').onclick = () => {
    const lines = $('bulk').value.split('\n').map(s => s.trim()).filter(Boolean);
    lines.forEach(line => {
      const parts = line.split('|').map(s => s.trim());
      S.questions.push({ id: rid(8), prompt: parts[0], options: parts.slice(1).filter(Boolean).slice(0, 6) });
    });
    $('bulk').value = ''; save(); renderSetup(); toast('Added ' + lines.length + ' question' + (lines.length === 1 ? '' : 's'));
  };
  $('defaults').addEventListener('input', e => {
    const d = e.target.value.split('|').map(s => s.trim()).filter(Boolean);
    if (d.length >= 2) { S.defaults = d.slice(0, 6); save(); }
  });
  $('defaults').addEventListener('change', () => renderSetup());
  $('brokerSel').onchange = e => { S.broker = Number(e.target.value); save(); startRelay(); };
  $('newRoom').onclick = () => {
    if (!confirm('Make a new room? Anyone who already scanned will need to scan the new code.')) return;
    S.room = rid(5); S.votes = {}; save(); renderSetup(); startRelay();
  };
  $('exportBtn').onclick = async () => {
    const data = JSON.stringify({ defaults: S.defaults, questions: S.questions.map(q => ({ prompt: q.prompt, options: q.options })) });
    try { await navigator.clipboard.writeText(data); toast('Questions copied — paste them on the TV browser'); }
    catch (e) { window.prompt('Copy this:', data); }
  };
  $('importBtn').onclick = () => {
    const raw = window.prompt('Paste the copied questions here:');
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (!Array.isArray(d.questions)) throw 0;
      if (!confirm('Replace the ' + S.questions.length + ' current questions with ' + d.questions.length + ' pasted ones?')) return;
      S.questions = d.questions.map(q => ({ id: rid(8), prompt: String(q.prompt || ''), options: Array.isArray(q.options) ? q.options.map(String).slice(0, 6) : [] }));
      if (Array.isArray(d.defaults) && d.defaults.length >= 2) S.defaults = d.defaults.map(String);
      S.idx = 0; S.votes = {}; save(); renderSetup(); toast('Imported ' + S.questions.length + ' questions');
    } catch (e) { alert("That didn't look like copied questions."); }
  };
  $('startBtn').onclick = () => {
    S.questions = S.questions.filter(q => q.prompt.trim());
    if (!S.questions.length) { toast('Add at least one question first'); renderSetup(); return; }
    if (S.idx >= S.questions.length) S.idx = 0;
    show('stage');
  };

  // ---------- stage ----------
  function show(screen) {
    S.screen = screen; save();
    ['setup', 'stage', 'end'].forEach(s => $(s).classList.toggle('hidden', s !== screen));
    if (screen === 'setup') renderSetup();
    if (screen === 'stage') { renderQR(); renderStage(); }
    publishState(); publishTally();
  }

  function renderQR() {
    const qr = qrcode(0, 'M'); qr.addData(voteUrl()); qr.make();
    $('qr').innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
    $('roomCode2').textContent = S.room;
  }

  const PHASE_TEXT = { ready: 'Debate!', open: 'Voting is open', reveal: 'The results' };
  const MAIN_TEXT = { ready: 'Open voting', open: 'Close & reveal', reveal: 'Next question ▶' };

  function renderStage() {
    const q = cur(); if (!q) return;
    const opts = optsFor(q);
    const t = tally(q);
    $('qNum').textContent = 'Question ' + (S.idx + 1) + ' of ' + S.questions.length;
    $('phaseTag').textContent = PHASE_TEXT[S.phase];
    $('phaseTag').className = 'phase-tag ' + S.phase;
    $('prompt').textContent = q.prompt;
    $('mainBtn').textContent = S.phase === 'reveal' && S.idx === S.questions.length - 1 ? 'Finish ▶' : MAIN_TEXT[S.phase];
    $('liveToggle').checked = !!S.live;
    $('prevBtn').disabled = S.idx === 0;
    document.body.dataset.phase = S.phase;

    const showBars = S.phase === 'reveal' || (S.live && S.phase === 'open');
    const max = Math.max(...t.counts, 0);
    const box = $('options'); box.innerHTML = '';
    box.classList.toggle('bars', showBars);
    opts.forEach((label, i) => {
      const row = el('div', 'opt c' + (i % 6));
      const pct = t.total ? Math.round(100 * t.counts[i] / t.total) : 0;
      if (S.phase === 'reveal' && t.total && t.counts[i] === max) row.classList.add('winner');
      const fill = el('div', 'fill'); fill.style.width = showBars ? pct + '%' : '0%';
      const name = el('div', 'oname', label);
      if (S.phase === 'ready') {
        name.contentEditable = 'true'; name.spellcheck = false; name.title = 'Click to rename this choice';
        name.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); name.blur(); } e.stopPropagation(); });
        name.addEventListener('blur', () => {
          const v = name.textContent.trim(); if (!v) { name.textContent = label; return; }
          const o = optsFor(q).slice(); o[i] = v; q.options = o; save(); publishState();
        });
      }
      const stat = el('div', 'ostat', showBars ? pct + '%' : '');
      if (showBars) stat.appendChild(el('span', 'ocount', ' · ' + t.counts[i]));
      row.append(fill, name, stat);
      box.appendChild(row);
    });
    if (S.phase === 'ready') $('voteCount').textContent = 'Tip: click a choice to rename it before voting opens';
    else $('voteCount').textContent = t.total + (t.total === 1 ? ' vote' : ' votes') + (S.phase === 'open' ? ' in' : '');
  }

  function step() {
    if (S.phase === 'ready') S.phase = 'open';
    else if (S.phase === 'open') S.phase = 'reveal';
    else return next();
    save(); renderStage(); publishState(); publishTally();
  }
  function next() {
    if (S.idx >= S.questions.length - 1) { if (S.phase === 'reveal') show('end'); return; }
    S.idx++; S.phase = (S.votes[cur().id] && Object.keys(S.votes[cur().id]).length) ? 'reveal' : 'ready';
    save(); renderStage(); publishState(); publishTally();
  }
  function prev() {
    if (S.idx === 0) return;
    S.idx--; S.phase = (S.votes[cur().id] && Object.keys(S.votes[cur().id]).length) ? 'reveal' : 'ready';
    save(); renderStage(); publishState(); publishTally();
  }
  function resetVotes() {
    if (!confirm('Clear the votes for this question?')) return;
    delete S.votes[cur().id]; S.phase = 'ready'; save(); renderStage(); publishState(); publishTally();
  }
  function fullscreen() { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen(); }

  $('mainBtn').onclick = step;
  $('nextBtn').onclick = next;
  $('prevBtn').onclick = prev;
  $('resetBtn').onclick = resetVotes;
  $('fsBtn').onclick = fullscreen;
  $('editBtn').onclick = () => show('setup');
  $('editBtn2').onclick = () => show('setup');
  $('backBtn').onclick = () => show('stage');
  $('liveToggle').onchange = e => { S.live = e.target.checked; save(); renderStage(); };

  document.addEventListener('keydown', e => {
    if (S.screen !== 'stage' || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); step(); }
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'r' || e.key === 'R') resetVotes();
    else if (e.key === 'f' || e.key === 'F') fullscreen();
    else if (e.key === 'e' || e.key === 'E') show('setup');
  });

  // ---------- boot ----------
  startRelay();
  show(S.screen === 'stage' && S.questions.length ? 'stage' : S.screen === 'end' ? 'end' : 'setup');
  // keep the retained state fresh so late joiners always see the current question
  setInterval(publishState, 15000);
})();
