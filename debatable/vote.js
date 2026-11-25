(function () {
  const { topic, rid, lsGet, lsSet, connect, parse, el, badge } = DP;
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  let room = (params.get('r') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  const broker = Number(params.get('b') || 0) || 0;

  let device = lsGet('dp-device', null);
  if (!device) { device = rid(12); lsSet('dp-device', device); }
  const myVotes = lsGet('dp-votes', {}); // qid -> choice

  let state = null, acked = {}, client = null;

  function showOnly(id) { ['join', 'wait', 'ask'].forEach(s => $(s).classList.toggle('hidden', s !== id)); }

  if (!room) { showOnly('join'); }
  else start();

  $('joinBtn').onclick = () => {
    const c = $('codeIn').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length < 4) return;
    room = c; history.replaceState(null, '', '?r=' + room + '&b=' + broker); start();
  };
  $('codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('joinBtn').click(); });

  function start() {
    showOnly('wait');
    client = connect(broker, s => { badge($('conn'), s); if (s === 'online') resend(); });
    client.on('connect', () => client.subscribe([topic(room, 'state'), topic(room, 'tally')], { qos: 1 }));
    client.on('message', (t, buf) => {
      const m = parse(buf); if (!m) return;
      if (t === topic(room, 'state')) { state = m; render(); resend(); }
      else if (t === topic(room, 'tally')) {
        if (Array.isArray(m.voters) && typeof m.qid === 'string') {
          acked[m.qid] = m.voters.includes(device);
          if (state && state.qid === m.qid) renderStatus();
        }
      }
    });
    setInterval(resend, 3000);
  }

  function vote(i) {
    if (!state || state.phase !== 'open') return;
    myVotes[state.qid] = i; lsSet('dp-votes', myVotes);
    acked[state.qid] = false;
    if (navigator.vibrate) navigator.vibrate(30);
    send(); render();
  }
  function send() {
    if (!client || !client.connected || !state || state.phase !== 'open') return;
    const c = myVotes[state.qid]; if (c == null) return;
    client.publish(topic(room, 'vote'), JSON.stringify({ qid: state.qid, device, choice: c }), { qos: 1 });
  }
  // keep re-sending until the TV confirms, so a hiccup never loses a vote
  function resend() { if (state && state.phase === 'open' && myVotes[state.qid] != null && !acked[state.qid]) send(); }

  function render() {
    const s = state;
    if (!s || s.phase === 'lobby') {
      showOnly('wait'); $('waitTitle').textContent = "You're in!";
      $('waitText').textContent = 'Hang tight — the first question is coming up.'; return;
    }
    if (s.phase === 'end') {
      showOnly('wait'); $('waitTitle').textContent = 'Happy Thanksgiving! 🦃';
      $('waitText').textContent = "That's the last question. Thanks for voting!"; return;
    }
    showOnly('ask');
    $('qmeta').textContent = 'Question ' + s.n + ' of ' + s.total;
    $('qprompt').textContent = s.prompt;
    const mine = myVotes[s.qid];
    const msg = { ready: 'Listen to the debate… voting opens soon.', open: mine == null ? 'Tap your pick:' : 'You can change your vote until it closes.', reveal: 'Voting is closed — look at the TV!' }[s.phase] || '';
    $('phaseMsg').textContent = msg;
    const box = $('choices'); box.innerHTML = '';
    const total = s.results ? s.results.reduce((a, b) => a + b, 0) : 0;
    (s.options || []).forEach((label, i) => {
      const b = el('button', 'choice c' + (i % 6));
      if (mine === i) b.classList.add('picked');
      b.disabled = s.phase !== 'open';
      b.appendChild(el('span', 'clabel', label));
      if (s.phase === 'reveal' && s.results) {
        const pct = total ? Math.round(100 * s.results[i] / total) : 0;
        b.appendChild(el('span', 'cpct', pct + '%'));
      } else if (mine === i) b.appendChild(el('span', 'cpct', '✓'));
      b.onclick = () => vote(i);
      box.appendChild(b);
    });
    renderStatus();
  }

  function renderStatus() {
    const s = state; const st = $('status');
    if (!s || s.phase === 'ready') { st.textContent = ''; return; }
    const mine = myVotes[s.qid];
    if (mine == null) { st.textContent = s.phase === 'open' ? '' : "You didn't vote on this one."; st.className = 'vstatus'; return; }
    if (acked[s.qid]) { st.textContent = '✓ Vote counted'; st.className = 'vstatus ok'; }
    else if (s.phase === 'open') { st.textContent = 'Sending…'; st.className = 'vstatus'; }
    else { st.textContent = ''; }
  }
})();
