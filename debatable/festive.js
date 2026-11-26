// Festive layer: autumn bunting, drifting leaves, a turkey mascot and leaf bursts.
window.FX = (function () {
  const COLORS = ['#e0703a', '#d9a62e', '#c8423b', '#8a9a3b', '#b5562a', '#f2a541'];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';

  function leafSVG(color, size) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" aria-hidden="true">' +
      '<path d="M12 1.5l2.2 4.6 3.6-1.6-.9 4.3 4.6.6-3.4 3 2.4 2.2-4.4.9.6 3.6-4.7-2.4-4.7 2.4.6-3.6-4.4-.9 2.4-2.2-3.4-3 4.6-.6-.9-4.3 3.6 1.6z" fill="' + color + '"/>' +
      '<path d="M12 6v16.5" stroke="#00000040" stroke-width="1.1" fill="none" stroke-linecap="round"/></svg>';
  }

  function bunting(palette, cls) {
    const PAL = palette || COLORS;
    const host = document.createElement('div'); host.className = 'fx-bunting ' + (cls || 'fall'); host.setAttribute('aria-hidden', 'true');
    document.body.prepend(host);
    const draw = () => {
      const W = window.innerWidth, n = Math.max(8, Math.round(W / 70)), step = W / n, sag = Math.min(26, W / 40);
      let flags = '';
      for (let i = 0; i < n; i++) {
        const x = i * step, t = (i + 0.5) / n, y = 4 + sag * 4 * t * (1 - t);
        const w = step * 0.8, h = step * 0.85;
        flags += '<g class="flag" style="--d:' + (i % 5) * 0.3 + 's;transform-origin:' + (x + step / 2) + 'px ' + y + 'px">' +
          '<path d="M' + (x + step * 0.1) + ' ' + y + ' L' + (x + step * 0.1 + w) + ' ' + y + ' L' + (x + step / 2) + ' ' + (y + h) + ' Z" fill="' + PAL[i % PAL.length] + '"/>' +
          '<path d="M' + (x + step * 0.1) + ' ' + y + ' L' + (x + step * 0.1 + w) + ' ' + y + ' L' + (x + step / 2) + ' ' + (y + h * 0.28) + ' Z" fill="#ffffff22"/></g>';
      }
      host.innerHTML = '<svg width="' + W + '" height="' + (step + sag + 10) + '"><path d="M0 4 Q' + W / 2 + ' ' + (4 + sag * 2) + ' ' + W + ' 4" stroke="#f3dcc0" stroke-width="2" fill="none"/>' + flags + lights(host, W, sag, n) + '</svg>';
    };
    draw(); let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 150); });
  }

  function leaves(count, scale) {
    scale = scale || 1;
    if (reduce || !count) return;
    const layer = document.createElement('div'); layer.className = 'fx-leaves fall'; layer.setAttribute('aria-hidden', 'true');
    document.body.prepend(layer);
    for (let i = 0; i < count; i++) {
      const l = document.createElement('div'); l.className = 'fx-leaf';
      const size = (16 + Math.random() * 26) * scale;
      l.style.left = (Math.random() * 100) + 'vw';
      l.style.animationDuration = (11 + Math.random() * 12) + 's';
      l.style.animationDelay = (-Math.random() * 20) + 's';
      l.style.opacity = (0.35 + Math.random() * 0.4).toFixed(2);
      l.innerHTML = '<div class="fx-sway" style="animation-duration:' + (2.5 + Math.random() * 3) + 's">' + leafSVG(COLORS[i % COLORS.length], size) + '</div>';
      layer.appendChild(l);
    }
  }

  // leaves + confetti flying out from a point
  function burst(x, y, n) {
    if (reduce) return;
    n = n || 26;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div'); p.className = 'fx-bit';
      const X = document.body.classList.contains('xmas'), PAL = X ? XCOLORS : COLORS;
      const isLeaf = i % 3 !== 0, c = PAL[(Math.random() * PAL.length) | 0];
      p.innerHTML = isLeaf ? (X ? flakeSVG(i % 2 ? '#ffffff' : c, 14 + Math.random() * 16) : leafSVG(c, 14 + Math.random() * 16)) : '';
      if (!isLeaf) { p.style.background = c; p.style.width = '10px'; p.style.height = '14px'; p.style.borderRadius = '3px'; }
      p.style.left = x + 'px'; p.style.top = y + 'px';
      document.body.appendChild(p);
      const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 260;
      const dx = Math.cos(a) * d, dy = Math.sin(a) * d - 120;
      p.animate([
        { transform: 'translate(-50%,-50%) rotate(0deg) scale(.6)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) rotate(' + (Math.random() * 540 - 270) + 'deg) scale(1)', opacity: 1, offset: 0.55 },
        { transform: 'translate(calc(-50% + ' + dx * 1.15 + 'px), calc(-50% + ' + (dy + 260) + 'px)) rotate(' + (Math.random() * 720) + 'deg) scale(.9)', opacity: 0 },
      ], { duration: 1600 + Math.random() * 900, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => p.remove();
    }
  }
  function burstAt(elm, n) { if (!elm) return; const r = elm.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, n); }

  // original cartoon turkey
  function turkey(size) {
    const feathers = [-70, -47, -24, 0, 24, 47, 70].map((deg, i) =>
      '<ellipse cx="60" cy="38" rx="13" ry="34" fill="' + COLORS[i % COLORS.length] + '" transform="rotate(' + deg + ' 60 72)"/>').join('');
    return '<svg class="fx-turkey" viewBox="0 0 120 120" width="' + size + '" height="' + size + '" aria-hidden="true">' +
      '<g class="tail">' + feathers + '</g>' +
      '<ellipse cx="60" cy="80" rx="30" ry="28" fill="#7a4a2a"/>' +
      '<ellipse cx="60" cy="86" rx="20" ry="17" fill="#9b6238"/>' +
      '<circle cx="60" cy="54" r="17" fill="#8b5530"/>' +
      '<circle cx="53" cy="51" r="5" fill="#fff"/><circle cx="67" cy="51" r="5" fill="#fff"/>' +
      '<circle cx="54" cy="52" r="2.6" fill="#2a1407"/><circle cx="66" cy="52" r="2.6" fill="#2a1407"/>' +
      '<path d="M55 58 L65 58 L60 66 Z" fill="#f2a541"/>' +
      '<path d="M63 62 q6 4 2 12 q-5 -2 -4 -10z" fill="#c8423b"/>' +
      '<path d="M48 106 v8 M44 114 h8 M72 106 v8 M68 114 h8" stroke="#f2a541" stroke-width="3" stroke-linecap="round"/>' +
      '<g class="hat"><path d="M44 42 Q50 18 74 22 Q86 26 88 40 Q76 32 70 38 Z" fill="#d62839"/><rect x="42" y="38" width="36" height="8" rx="4" fill="#fff"/><circle cx="88" cy="41" r="5" fill="#fff"/></g></svg>';
  }

  // string lights draped along the bunting line
  function lights(host, W, sag, n) {
    let s = '';
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * W, t = i / n, y = 4 + sag * 4 * t * (1 - t) + 3;
      s += '<g class="bulb" style="--d:' + ((i * 0.37) % 2).toFixed(2) + 's"><rect x="' + (x - 2.5) + '" y="' + (y - 2) + '" width="5" height="4" rx="1" fill="#5a3a2c"/>' +
        '<ellipse cx="' + x + '" cy="' + (y + 7) + '" rx="4.5" ry="6.5" fill="' + ['#ffd36b', '#ff8a4c', '#ffe9a8', '#ff6b5b'][i % 4] + '"/></g>';
    }
    return s;
  }

  // pumpkins, gourds, corn and wheat along the bottom edge
  function harvest(H) {
    const host = document.createElement('div'); host.className = 'fx-harvest fall'; host.setAttribute('aria-hidden', 'true');
    document.body.appendChild(host);
    const pumpkin = (x, s, c) => {
      const y = H - 6;
      return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
        '<ellipse cx="0" cy="-26" rx="34" ry="27" fill="' + c + '"/>' +
        '<ellipse cx="-14" cy="-26" rx="17" ry="26" fill="#00000018"/><ellipse cx="14" cy="-26" rx="17" ry="26" fill="#00000018"/>' +
        '<ellipse cx="0" cy="-26" rx="11" ry="27" fill="#ffffff1c"/>' +
        '<path d="M-2 -50 q2 -12 9 -14 l2 4 q-6 3 -6 11z" fill="#5d7a2e"/>' +
        '<path d="M5 -58 q14 -6 18 4 q-10 -4 -16 0z" fill="#8a9a3b"/></g>';
    };
    const corn = (x, s) => '<g transform="translate(' + x + ' ' + (H - 6) + ') scale(' + s + ') rotate(-12)">' +
      '<ellipse cx="0" cy="-34" rx="11" ry="32" fill="#f2c14e"/>' +
      Array.from({ length: 5 }, (_, r) => Array.from({ length: 3 }, (_, k) => '<circle cx="' + (-5 + k * 5) + '" cy="' + (-56 + r * 10) + '" r="2.2" fill="#d99a26"/>').join('')).join('') +
      '<path d="M-2 0 q-22 -20 -12 -58 q4 30 14 52z" fill="#7c8f35"/><path d="M2 0 q22 -22 10 -56 q-2 30 -12 50z" fill="#93a744"/></g>';
    const wheat = (x, s) => '<g transform="translate(' + x + ' ' + (H - 6) + ') scale(' + s + ')" stroke="#d9a62e" stroke-width="2" fill="#e8b84a">' +
      [-14, 0, 14].map(a => '<g transform="rotate(' + a + ')"><line x1="0" y1="0" x2="0" y2="-70" />' +
        Array.from({ length: 6 }, (_, k) => '<ellipse cx="-3.5" cy="' + (-70 + k * 6) + '" rx="2.6" ry="5" transform="rotate(-25 -3.5 ' + (-70 + k * 6) + ')" stroke="none"/><ellipse cx="3.5" cy="' + (-70 + k * 6) + '" rx="2.6" ry="5" transform="rotate(25 3.5 ' + (-70 + k * 6) + ')" stroke="none"/>').join('') + '</g>').join('') + '</g>';
    const gourd = (x, s) => '<g transform="translate(' + x + ' ' + (H - 6) + ') scale(' + s + ')"><ellipse cx="0" cy="-14" rx="16" ry="14" fill="#d9a62e"/><ellipse cx="6" cy="-30" rx="8" ry="11" fill="#8a9a3b"/><path d="M8 -40 l3 -7" stroke="#5d4a2a" stroke-width="3" stroke-linecap="round"/></g>';
    const draw = () => {
      const W = window.innerWidth; let x = 10, i = 0, items = '';
      const pc = ['#e0703a', '#d9662c', '#f08a2c', '#e8a34a'];
      while (x < W + 40) {
        const k = i % 6, sc = (H / 150) * (0.75 + ((i * 37) % 10) / 25);
        if (k === 0 || k === 3) items += pumpkin(x, sc * 1.1, pc[i % pc.length]);
        else if (k === 1) items += wheat(x, sc);
        else if (k === 2) items += gourd(x, sc);
        else if (k === 4) items += corn(x, sc);
        else items += pumpkin(x, sc * 0.75, '#efe3c8');
        x += (k === 1 ? 46 : 70) * (H / 150) + ((i * 13) % 20); i++;
      }
      host.innerHTML = '<svg width="' + W + '" height="' + H + '"><defs><linearGradient id="hay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5a2a"/><stop offset="1" stop-color="#4a2a14"/></linearGradient></defs>' +
        items + '<rect x="0" y="' + (H - 8) + '" width="' + W + '" height="8" fill="url(#hay)"/></svg>';
    };
    draw(); let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 150); });
  }

  // "And the winner is… 3 2 1" overlay; resolves when done
  function drumroll() {
    return new Promise(res => {
      if (reduce) return res();
      const o = document.createElement('div'); o.className = 'fx-drum';
      o.innerHTML = '<div class="fx-drum-inner"><div class="fx-drum-title">And the winner is…</div><div class="fx-drum-num"></div></div>';
      document.body.appendChild(o);
      const num = o.querySelector('.fx-drum-num');
      let n = 3;
      const tick = () => {
        if (n === 0) { o.classList.add('out'); setTimeout(() => { o.remove(); res(); }, 250); return; }
        num.textContent = n; num.classList.remove('pop'); void num.offsetWidth; num.classList.add('pop'); n--; setTimeout(tick, 650);
      };
      setTimeout(tick, 350);
    });
  }

  function hop(elm) { if (!elm || reduce) return; elm.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-38px) rotate(-6deg)' }, { transform: 'translateY(0)' }, { transform: 'translateY(-22px) rotate(5deg)' }, { transform: 'translateY(0)' }], { duration: 1100, easing: 'ease-out' }); }

  const XCOLORS = ['#d62839', '#2f7d4a', '#e8c15a', '#ffffff', '#b3122a', '#1f5c36'];
  const XMAS_THEMES = ['xmas-red', 'evergreen', 'snowy', 'candycane', 'gingerbread'];

  function flakeSVG(color, size) {
    const arm = a => '<g transform="rotate(' + a + ' 12 12)"><line x1="12" y1="12" x2="12" y2="2" /><line x1="12" y1="5" x2="9.5" y2="3"/><line x1="12" y1="5" x2="14.5" y2="3"/></g>';
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" aria-hidden="true"><g stroke="' + color + '" stroke-width="1.6" stroke-linecap="round" fill="none">' +
      [0, 60, 120, 180, 240, 300].map(arm).join('') + '</g></svg>';
  }

  function snow(count, scale) {
    if (reduce || !count) return;
    scale = scale || 1;
    const layer = document.createElement('div'); layer.className = 'fx-leaves xmas'; layer.setAttribute('aria-hidden', 'true');
    document.body.prepend(layer);
    for (let i = 0; i < count; i++) {
      const l = document.createElement('div'); l.className = 'fx-leaf';
      const big = i % 4 === 0, size = (big ? 22 + Math.random() * 18 : 6 + Math.random() * 8) * scale;
      l.style.left = (Math.random() * 100) + 'vw';
      l.style.animationDuration = (9 + Math.random() * 12) + 's';
      l.style.animationDelay = (-Math.random() * 20) + 's';
      l.style.opacity = (0.5 + Math.random() * 0.45).toFixed(2);
      l.innerHTML = '<div class="fx-sway" style="animation-duration:' + (3 + Math.random() * 3) + 's">' +
        (big ? flakeSVG('#ffffff', size) : '<div class="dot" style="width:' + size + 'px;height:' + size + 'px"></div>') + '</div>';
      layer.appendChild(l);
    }
  }

  // presents, trees and candy canes along the bottom
  function presents(H) {
    const host = document.createElement('div'); host.className = 'fx-harvest xmas'; host.setAttribute('aria-hidden', 'true');
    document.body.appendChild(host);
    const tree = (x, s) => '<g transform="translate(' + x + ' ' + (H - 6) + ') scale(' + s + ')">' +
      '<rect x="-6" y="-14" width="12" height="14" fill="#6b3f22"/>' +
      '<path d="M0 -112 L34 -54 L18 -54 L42 -14 L-42 -14 L-18 -54 L-34 -54 Z" fill="#1f6b3c"/>' +
      '<path d="M0 -112 L34 -54 L18 -54 L28 -36 L0 -36 Z" fill="#ffffff14"/>' +
      '<circle cx="-14" cy="-30" r="4" fill="#d62839"/><circle cx="16" cy="-26" r="4" fill="#e8c15a"/><circle cx="6" cy="-62" r="3.5" fill="#d62839"/><circle cx="-8" cy="-74" r="3.5" fill="#e8c15a"/>' +
      '<path d="M0 -124 l3.5 7 7.5 1 -5.5 5.5 1.5 7.5 -7 -3.5 -7 3.5 1.5 -7.5 -5.5 -5.5 7.5 -1z" fill="#ffd36b"/></g>';
    const gift = (x, s, c, r) => '<g transform="translate(' + x + ' ' + (H - 6) + ') scale(' + s + ')">' +
      '<rect x="-26" y="-44" width="52" height="44" rx="3" fill="' + c + '"/><rect x="-28" y="-52" width="56" height="12" rx="3" fill="' + c + '"/><rect x="-28" y="-52" width="56" height="12" rx="3" fill="#ffffff1f"/>' +
      '<rect x="-5" y="-52" width="10" height="52" fill="' + r + '"/>' +
      '<path d="M0 -52 q-20 -18 -22 -4 q4 8 22 4z M0 -52 q20 -18 22 -4 q-4 8 -22 4z" fill="' + r + '"/></g>';
    const cane = (x, s) => '<g transform="translate(' + x + ' ' + (H - 6) + ') scale(' + s + ')"><path d="M0 0 V-62 a12 12 0 0 1 24 0 v6" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round"/>' +
      '<path d="M0 0 V-62 a12 12 0 0 1 24 0 v6" stroke="#d62839" stroke-width="9" fill="none" stroke-linecap="round" stroke-dasharray="7 7"/></g>';
    const draw = () => {
      const W = window.innerWidth; let x = 30, i = 0, items = '';
      const gc = [['#d62839', '#e8c15a'], ['#2f7d4a', '#ffffff'], ['#e8c15a', '#d62839'], ['#ffffff', '#2f7d4a'], ['#7a2ab0', '#e8c15a']];
      while (x < W + 40) {
        const k = i % 5, sc = (H / 150) * (0.75 + ((i * 37) % 10) / 25);
        if (k === 1 || k === 4) items += tree(x, sc);
        else if (k === 3) items += cane(x, sc);
        else { const g = gc[i % gc.length]; items += gift(x, sc, g[0], g[1]); }
        x += (k === 3 ? 44 : 78) * (H / 150) + ((i * 13) % 18); i++;
      }
      host.innerHTML = '<svg width="' + W + '" height="' + H + '">' + items + '<rect x="0" y="' + (H - 8) + '" width="' + W + '" height="8" fill="#f4f7ff"/></svg>';
    };
    draw(); let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 150); });
  }

  // everything a page needs, in both seasons; switch with setTheme()
  function decorate(o) {
    bunting(); bunting(['#d62839', '#2f7d4a', '#e8c15a', '#ffffff'], 'xmas');
    leaves(o.leaves, o.scale); snow(o.snow || o.leaves * 2, o.scale);
    if (o.ground) { harvest(o.ground); presents(o.ground); }
  }
  function setTheme(t) {
    t = t || 'harvest';
    document.body.dataset.theme = t;
    document.body.classList.toggle('xmas', XMAS_THEMES.includes(t));
  }

  function bump(elm) { if (!elm || reduce) return; elm.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' }); }

  return { bunting, leaves, burst, burstAt, turkey, bump, leafSVG, harvest, drumroll, hop, snow, presents, decorate, setTheme, XMAS_THEMES };
})();
