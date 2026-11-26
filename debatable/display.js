// TV display: shows only what the presenter sends — question, QR code, results. No controls.
(function () {
  const { BROKERS, topic, lsGet, lsSet, connect, parse, el, badge } = DP;
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const saved = lsGet('dp-tv', {});
  let room = (params.get('r') || saved.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  let broker = Number(params.get('b') != null ? params.get('b') : (saved.broker || 0)) || 0;
  let client = null, D = null, lastQid = null;

  const showOnly = id => ['join', 'lobby', 'stage', 'end'].forEach(s => $(s).classList.toggle('hidden', s !== id));

  function joinScreen() {
    showOnly('join');
    const sel = $('brokerSel'); sel.innerHTML = '';
    BROKERS.forEach((b, i) => { const o = el('option', null, b.name); o.value = i; if (i === broker) o.selected = true; sel.appendChild(o); });
    $('codeIn').value = room; $('codeIn').focus();
  }
  $('joinBtn').onclick = () => {
    const c = $('codeIn').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length < 4) return;
    room = c; broker = Number($('brokerSel').value) || 0; start();
  };
  $('codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('joinBtn').click(); });
  $('leaveBtn').onclick = () => { if (client) client.end(true); client = null; D = null; joinScreen(); };
  $('fsBtn').onclick = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen(); };
  document.addEventListener('dblclick', () => $('fsBtn').click());

  function voteUrl() { return location.href.split(/[?#]/)[0].replace(/[^/]*$/, '') + 'vote.html?r=' + room + '&b=' + broker; }
  function renderQR() {
    const qr = qrcode(0, 'M'); qr.addData(voteUrl()); qr.make();
    const svg = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
    document.querySelectorAll('.qrSlot').forEach(n => n.innerHTML = svg);
    document.querySelectorAll('.roomOut').forEach(n => n.textContent = room);
  }

  function start() {
    lsSet('dp-tv', { room, broker });
    history.replaceState(null, '', location.pathname);
    renderQR(); showOnly('lobby');
    if (client) client.end(true);
    client = connect(broker, s => badge($('conn'), s));
    client.on('connect', () => client.subscribe(topic(room, 'display'), { qos: 1 }));
    client.on('message', (t, buf) => { if (t === topic(room, 'display')) { const m = parse(buf); if (m) { D = m; render(); } } });
  }

  const PHASE_TEXT = { ready: 'Debate!', open: 'Voting is open', reveal: 'The results' };
  function render() {
    if (!D || D.screen === 'lobby') return showOnly('lobby');
    if (D.screen === 'end') return showOnly('end');
    showOnly('stage');
    $('qrBox').classList.toggle('hidden', !D.showQR);
    $('stageBody').classList.toggle('noqr', !D.showQR);
    $('qNum').textContent = 'Question ' + D.n + ' of ' + D.total;
    $('phaseTag').textContent = PHASE_TEXT[D.phase] || '';
    $('phaseTag').className = 'phase-tag ' + D.phase;
    $('prompt').textContent = D.prompt;
    document.body.dataset.phase = D.phase;

    const showBars = Array.isArray(D.counts) && (D.phase === 'reveal' || (D.live && D.phase === 'open'));
    const counts = showBars ? D.counts : [];
    const total = counts.reduce((a, b) => a + b, 0);
    const max = Math.max(...counts, 0);
    const box = $('options');
    const fresh = lastQid !== D.qid || box.children.length !== (D.options || []).length;
    lastQid = D.qid;
    if (fresh) box.innerHTML = '';
    box.classList.toggle('bars', showBars);
    (D.options || []).forEach((label, i) => {
      let row = box.children[i];
      if (!row) {
        row = el('div', 'opt c' + (i % 6));
        row.append(el('div', 'fill'), el('div', 'oname'), el('div', 'ostat'));
        box.appendChild(row);
      }
      const pct = total ? Math.round(100 * counts[i] / total) : 0;
      row.classList.toggle('winner', D.phase === 'reveal' && total > 0 && counts[i] === max);
      row.children[1].textContent = label;
      row.children[0].style.width = showBars ? pct + '%' : '0%';
      const stat = row.children[2]; stat.textContent = showBars ? pct + '%' : '';
      if (showBars) stat.appendChild(el('span', 'ocount', ' · ' + counts[i]));
    });
    const vc = $('voteCount');
    vc.textContent = D.phase === 'ready' ? '' : D.votes + (D.votes === 1 ? ' vote' : ' votes') + (D.phase === 'open' ? ' in' : '');
    if (D.phase === 'open' && D.votes > lastVotes && !fresh) FX.bump(vc);
    lastVotes = D.votes || 0;

    // celebrate the reveal once per question
    if (D.phase === 'reveal' && revealedQid !== D.qid) {
      revealedQid = D.qid;
      if (total > 0) setTimeout(() => box.querySelectorAll('.opt.winner').forEach(w => { FX.burstAt(w, 40); FX.bump(w); }), 900);
    }
    if (D.phase !== 'reveal' && revealedQid === D.qid) revealedQid = null;
  }
  let lastVotes = 0, revealedQid = null;

  if (room) start(); else joinScreen();
})();
