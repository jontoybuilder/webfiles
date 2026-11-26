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

  function bunting() {
    const host = document.createElement('div'); host.className = 'fx-bunting'; host.setAttribute('aria-hidden', 'true');
    document.body.prepend(host);
    const draw = () => {
      const W = window.innerWidth, n = Math.max(8, Math.round(W / 70)), step = W / n, sag = Math.min(26, W / 40);
      let flags = '';
      for (let i = 0; i < n; i++) {
        const x = i * step, t = (i + 0.5) / n, y = 4 + sag * 4 * t * (1 - t);
        const w = step * 0.8, h = step * 0.85;
        flags += '<g class="flag" style="--d:' + (i % 5) * 0.3 + 's;transform-origin:' + (x + step / 2) + 'px ' + y + 'px">' +
          '<path d="M' + (x + step * 0.1) + ' ' + y + ' L' + (x + step * 0.1 + w) + ' ' + y + ' L' + (x + step / 2) + ' ' + (y + h) + ' Z" fill="' + COLORS[i % COLORS.length] + '"/>' +
          '<path d="M' + (x + step * 0.1) + ' ' + y + ' L' + (x + step * 0.1 + w) + ' ' + y + ' L' + (x + step / 2) + ' ' + (y + h * 0.28) + ' Z" fill="#ffffff22"/></g>';
      }
      host.innerHTML = '<svg width="' + W + '" height="' + (step + sag + 10) + '"><path d="M0 4 Q' + W / 2 + ' ' + (4 + sag * 2) + ' ' + W + ' 4" stroke="#f3dcc0" stroke-width="2" fill="none"/>' + flags + '</svg>';
    };
    draw(); let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 150); });
  }

  function leaves(count, scale) {
    scale = scale || 1;
    if (reduce || !count) return;
    const layer = document.createElement('div'); layer.className = 'fx-leaves'; layer.setAttribute('aria-hidden', 'true');
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
      const isLeaf = i % 3 !== 0, c = COLORS[(Math.random() * COLORS.length) | 0];
      p.innerHTML = isLeaf ? leafSVG(c, 14 + Math.random() * 16) : '';
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
      '<path d="M48 106 v8 M44 114 h8 M72 106 v8 M68 114 h8" stroke="#f2a541" stroke-width="3" stroke-linecap="round"/></svg>';
  }

  function bump(elm) { if (!elm || reduce) return; elm.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' }); }

  return { bunting, leaves, burst, burstAt, turkey, bump, leafSVG };
})();
