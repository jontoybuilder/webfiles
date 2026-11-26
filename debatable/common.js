// Shared between host (TV) and voter (phone) pages.
// Votes travel over a public MQTT-over-WebSocket relay, so the site needs no backend
// and guests need no login. Each room has its own random topic.
window.DP = (function () {
  const BROKERS = [
    { name: 'HiveMQ (default)', url: 'wss://broker.hivemq.com:8884/mqtt' },
    { name: 'EMQX (backup)', url: 'wss://broker.emqx.io:8084/mqtt' },
  ];
  const PREFIX = 'debatable-tg-2026/';

  function topic(room, kind) { return PREFIX + room + '/' + kind; }

  function rid(n) {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    const buf = new Uint32Array(n);
    crypto.getRandomValues(buf);
    for (let i = 0; i < n; i++) s += a[buf[i] % a.length];
    return s;
  }

  function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function connect(brokerIdx, onStatus) {
    const b = BROKERS[brokerIdx] || BROKERS[0];
    const client = mqtt.connect(b.url, {
      clientId: 'dp_' + rid(10),
      clean: true,
      reconnectPeriod: 1500,
      connectTimeout: 8000,
      keepalive: 30,
    });
    client.on('connect', () => onStatus && onStatus('online'));
    client.on('reconnect', () => onStatus && onStatus('connecting'));
    client.on('offline', () => onStatus && onStatus('offline'));
    client.on('close', () => onStatus && onStatus('offline'));
    client.on('error', () => onStatus && onStatus('offline'));
    return client;
  }

  function parse(buf) { try { return JSON.parse(new TextDecoder().decode(buf)); } catch (e) { return null; } }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function badge(node, status) {
    if (!node) return;
    node.className = 'conn ' + status;
    node.textContent = status === 'online' ? 'live' : status === 'connecting' ? 'connecting…' : 'offline';
  }

  // where this copy of the app lives; the TV and phones follow the presenter's copy
  const BASE = location.href.split(/[?#]/)[0].replace(/[^/]*$/, '');
  function followHost(hostBase, page) {
    try {
      const u = new URL(hostBase);
      if (u.origin !== location.origin || hostBase === BASE || !/\/debatable\/$/.test(u.pathname)) return false;
      location.replace(hostBase + page);
      return true;
    } catch (e) { return false; }
  }

  return { BROKERS, topic, rid, lsGet, lsSet, connect, parse, el, badge, BASE, followHost };
})();
