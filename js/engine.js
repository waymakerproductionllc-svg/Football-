/*
 * Shared engine for the telestrator-style field animations.
 *
 * Everything on screen is a pure function of time `t` (seconds): RT.run()
 * rebuilds the active segment when it changes and then only updates
 * attributes. That keeps playback, scrubbing and frame-by-frame video export
 * (tools/record.mjs) identical.
 *
 * Field coordinates: X = yards across (0 = middle, + = offense's right),
 * D = yards downfield from the line of scrimmage.
 */
window.RT = (() => {
  'use strict';

  const SVGNS = 'http://www.w3.org/2000/svg';
  const query = new URLSearchParams(location.search);
  const RECORD = query.has('record');
  const VERTICAL = query.get('format') === 'vertical';
  if (RECORD) document.body.classList.add('record');
  if (VERTICAL) document.body.classList.add('vertical');
  const STAGE = VERTICAL ? { w: 1080, h: 1920 } : { w: 1920, h: 1080 };

  // ---------- small helpers ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const span = (t, a, b) => clamp((t - a) / (b - a));
  const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const easeOut = (u) => 1 - Math.pow(1 - u, 3);
  const easeBack = (u) => 1 + 2.70158 * Math.pow(u - 1, 3) + 1.70158 * Math.pow(u - 1, 2);
  const f1 = (n) => n.toFixed(1);

  function svg(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(parent, str, attrs) {
    const n = svg('text', attrs, parent);
    n.textContent = str;
    return n;
  }
  const $ = (id) => document.getElementById(id);

  // ---------- camera / projection (field yards -> stage pixels) ----------
  // X: yards across (0 = middle of the field, + = offense's right)
  // D: yards downfield from the line of scrimmage
  const HALF = 160 / 6;
  const D_MIN = -8;
  const LANE_X = 19.5;
  const BOX = VERTICAL ? { x: 30, y: 290, w: 1020, h: 860 } : { x: 36, y: 150, w: 1228, h: 822 };
  const CAM = { h: 56, back: 6, pitch: (43 * Math.PI) / 180 };
  const SP = Math.sin(CAM.pitch);
  const CP = Math.cos(CAM.pitch);

  function rawProject(X, D) {
    const z = D + CAM.back;
    const zc = CAM.h * SP + z * CP;
    const yc = -CAM.h * CP + z * SP;
    return [X / zc, -yc / zc, zc];
  }
  // Sidelines at the LOS span the box width; the far edge (D_MAX) is chosen so
  // that ~7 yards of backfield stay visible at the bottom of the box.
  const fitFor = (dMax) => {
    const s = BOX.w / ((2 * (VERTICAL ? 23.5 : 28.4)) / rawProject(0, 0)[2]);
    return { s, ox: BOX.x + BOX.w / 2, oy: BOX.y + 14 - s * rawProject(0, dMax)[1] };
  };
  let D_MAX = 32;
  for (let dm = 30, best = Infinity; dm <= 60; dm += 0.5) {
    const f = fitFor(dm);
    const err = Math.abs(f.oy + f.s * rawProject(0, -7)[1] - (BOX.y + BOX.h));
    if (err < best) { best = err; D_MAX = dm; }
  }
  const FIT = fitFor(D_MAX);
  function P(X, D) {
    const r = rawProject(X, D);
    return { x: FIT.ox + FIT.s * r[0], y: FIT.oy + FIT.s * r[1], k: FIT.s / r[2] };
  }
  const K0 = P(0, 0).k;
  const poly = (pts) => pts.map(([X, D]) => { const q = P(X, D); return `${f1(q.x)},${f1(q.y)}`; }).join(' ');
  const quad = (x0, d0, x1, d1) => poly([[x0, d0], [x1, d0], [x1, d1], [x0, d1]]);
  const foreshorten = (X, D) => (P(X, D - 0.5).y - P(X, D + 0.5).y) / P(X, D).k;

  // ---------- route shapes, in [outward yards, depth yards] relative to alignment ----------
  function curve(p0, c, p1, n = 14) {
    const out = [];
    for (let i = 1; i <= n; i++) {
      const u = i / n, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, d = u * u;
      out.push([a * p0[0] + b * c[0] + d * p1[0], a * p0[1] + b * c[1] + d * p1[1]]);
    }
    return out;
  }
  const ROUTES = {
    GO: (d) => [[0, 0], [0, 5], ...curve([0, 5], [0.2, d * 0.65], [1.8, d])],
    FADE: (d) => [[0, 0], [0, 1.5], ...curve([0, 1.5], [0.4, d * 0.55], [3.0, d])],
    OUT: (d, t) => [[0, 0], [0, d - 0.4], [0.5, d], [t.oob ? 8.2 : 6.6, d - 0.3]],
    CURL: (d) => [[0, 0], [0, d + 1.4], ...curve([0, d + 1.4], [-0.2, d + 2.4], [-1.7, d])],
    HITCH: (d) => [[0, 0], [0, d + 1], [-0.6, d]],
    COMEBACK: (d) => [[0, 0], [0, d + 3], [2.4, d]],
    SLANT: (d) => [[0, 0], [0, 1.5], [-(d - 1.5) * 0.9, d]],
    DIG: (d) => [[0, 0], [0, d - 0.3], [-0.7, d], [-13, d]],
    POST: (d) => [[0, 0], [0, 11], [-(d - 11) * 0.65, d]],
    CORNER: (d) => [[0, 0], [0, 9], [(d - 9) * 0.6, d]],
  };

  function makeRoute(t) {
    const out = t.side === 'L' ? -1 : 1;
    const x0 = out * LANE_X;
    const rel = (ROUTES[t.route] || ROUTES.GO)(t.depth, t);
    const pts = [];
    rel.forEach(([o, d], i) => {
      if (i > 0) {
        const [po, pd] = rel[i - 1];
        const steps = Math.max(1, Math.ceil(Math.hypot(o - po, d - pd) / 1.5));
        for (let s = 1; s < steps; s++) pts.push(P(x0 + out * lerp(po, o, s / steps), lerp(pd, d, s / steps)));
      }
      pts.push(P(x0 + out * o, d));
    });
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const [eo, ed] = rel[rel.length - 1];
    const miss = t.miss || [0, 0];
    return {
      pts, cum, L: cum[cum.length - 1], out, x0,
      d: 'M' + pts.map((p) => `${f1(p.x)} ${f1(p.y)}`).join(' L'),
      end: pts[pts.length - 1],
      endField: [x0 + out * eo, ed],
      ballField: [x0 + out * (eo + miss[0]), ed + miss[1]],
    };
  }
  function pointAt(r, s) {
    s = clamp(s, 0, r.L);
    let i = 1;
    while (i < r.cum.length - 1 && r.cum[i] < s) i++;
    const a = r.pts[i - 1], b = r.pts[i];
    const segLen = r.cum[i] - r.cum[i - 1] || 1;
    const u = (s - r.cum[i - 1]) / segLen;
    return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), k: lerp(a.k, b.k, u), ang: Math.atan2(b.y - a.y, b.x - a.x) };
  }
  function dashArray(L, p, dashed) {
    const drawn = Math.max(0.001, L * p);
    if (!dashed) return `${f1(drawn)} ${f1(L + 20)}`;
    const arr = [];
    let s = 0;
    while (s + 16 < drawn) { arr.push(16, 11); s += 27; }
    arr.push(Math.max(0.001, Math.min(16, drawn - s)), L + 60);
    return arr.map(f1).join(' ');
  }

  // ---------- SVG scaffolding ----------
  const root = $('field');
  root.setAttribute('width', STAGE.w);
  root.setAttribute('height', STAGE.h);
  root.setAttribute('viewBox', `0 0 ${STAGE.w} ${STAGE.h}`);
  const defs = svg('defs', null, root);
  defs.innerHTML = `
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="bigglow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="10"/>
    </filter>
    <radialGradient id="vignette" cx="50%" cy="58%" r="70%">
      <stop offset="55%" stop-color="#07061a" stop-opacity="0"/>
      <stop offset="100%" stop-color="#07061a" stop-opacity="0.9"/>
    </radialGradient>
    <linearGradient id="horizon" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#07061a" stop-opacity="1"/>
      <stop offset="0.16" stop-color="#07061a" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="lights" cx="50%" cy="45%" r="60%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.10"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="laneFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5a44e0"/><stop offset="1" stop-color="#241773"/>
    </linearGradient>
    <clipPath id="clipField"><rect x="${BOX.x}" y="${BOX.y}" width="${BOX.w}" height="${BOX.h}" rx="22"/></clipPath>`;
  const world = svg('g', { 'clip-path': 'url(#clipField)' }, root);
  svg('rect', { x: BOX.x, y: BOX.y, width: BOX.w, height: BOX.h, rx: 22, fill: 'none', stroke: 'rgba(255,199,44,0.35)', 'stroke-width': 2 }, root);
  const labels = svg('g', null, root);
  const screen = svg('g', null, root);

  // ---------- field drawing ----------
  const GREEN_A = '#2f8a3a';
  const GREEN_B = '#287a33';

  function drawField(parent, G, ez, turfOnly = false) {
    const g = svg('g', null, parent);
    const known = G != null;
    const off = known ? ((G % 5) + 5) % 5 : 0;
    const lo = D_MIN - 4, hi = D_MAX + 8;
    const start = Math.floor((lo - off) / 5) * 5 + off;
    svg('polygon', { points: quad(-44, lo, 44, hi), fill: '#1b5524' }, g);
    for (let a = start; a < hi; a += 5) {
      const n = known ? G - (a + 2.5) : 50;
      const band = ((Math.round((a - off) / 5) % 2) + 2) % 2;
      let fill = band ? GREEN_B : GREEN_A;
      if (n < -10 || n > 110) fill = '#173f1d';
      else if (n < 0 || n > 100) fill = ez;
      svg('polygon', { points: quad(-HALF, a, HALF, a + 5), fill }, g);
    }
    if (turfOnly) return g;
    // yard lines + goal / end lines
    for (let d = start; d <= hi; d += 5) {
      const n = known ? G - d : 50;
      const edge = n === 0 || n === 100 || n === -10 || n === 110;
      if (!edge && (n < 0 || n > 100)) continue;
      const w = n === 0 || n === 100 ? 0.34 : 0.15;
      svg('polygon', { points: quad(-HALF, d - w / 2, HALF, d + w / 2), fill: '#fff', opacity: edge ? 0.95 : 0.62 }, g);
    }
    // sidelines
    const dLo = known ? Math.max(lo, G - 110) : lo;
    const dHi = known ? Math.min(hi, G + 10) : hi;
    if (dHi > dLo) {
      svg('polygon', { points: quad(-HALF - 0.4, dLo, -HALF, dHi), fill: '#fff', opacity: 0.9 }, g);
      svg('polygon', { points: quad(HALF, dLo, HALF + 0.4, dHi), fill: '#fff', opacity: 0.9 }, g);
    }
    // hash marks and sideline ticks
    for (let d = Math.ceil(lo); d <= hi; d++) {
      const n = known ? G - d : 50 - d;
      if (((n % 5) + 5) % 5 === 0 || n <= 0 || n >= 100) continue;
      [-1, 1].forEach((sg) => {
        svg('polygon', { points: quad(sg * 3.08 - 0.33, d - 0.07, sg * 3.08 + 0.33, d + 0.07), fill: '#fff', opacity: 0.55 }, g);
        svg('polygon', { points: quad(sg * (HALF - 1.0), d - 0.07, sg * (HALF - 0.35), d + 0.07), fill: '#fff', opacity: 0.45 }, g);
      });
    }
    // yard numbers
    if (known) {
      for (let d = start; d <= hi; d += 5) {
        const n = G - d;
        if (n <= 0 || n >= 100 || n % 10 !== 0) continue;
        const label = String(n <= 50 ? n : 100 - n);
        [-1, 1].forEach((sg) => {
          const X = sg * (HALF - 12.5);
          const q = P(X, d);
          const fs = 2.6 * q.k;
          text(g, label, {
            transform: `translate(${f1(q.x)},${f1(q.y)}) scale(1,${foreshorten(X, d).toFixed(3)}) rotate(${sg < 0 ? 90 : -90})`,
            'font-size': f1(fs), 'font-weight': 600, fill: '#fff', opacity: 0.8,
            'text-anchor': 'middle', 'dominant-baseline': 'central', 'letter-spacing': f1(fs * 0.12),
          });
        });
      }
    }
    return g;
  }

  function drawFieldOverlays(parent) {
    svg('rect', { x: BOX.x, y: BOX.y, width: BOX.w, height: BOX.h, fill: 'url(#lights)' }, parent);
    svg('rect', { x: BOX.x, y: BOX.y, width: BOX.w, height: BOX.h, fill: 'url(#vignette)' }, parent);
    svg('rect', { x: BOX.x, y: BOX.y, width: BOX.w, height: BOX.h, fill: 'url(#horizon)' }, parent);
  }

  function drawDepthMarks(parent) {
    const g = svg('g', { opacity: 0.75 }, parent);
    for (let d = 5; d <= D_MAX - 2; d += 5) {
      const q = P(HALF + 0.9, d);
      text(g, `+${d}`, { x: f1(q.x), y: f1(q.y), 'font-size': f1(Math.max(13, q.k * 0.85)), 'font-weight': 500, fill: '#d8f5dc', 'dominant-baseline': 'central' });
    }
    return g;
  }

  // ---------- players ----------
  const OFFENSE = [[-4.4, -1], [-2.2, -1], [0, -1], [2.2, -1], [4.4, -1], [0, -5], [2, -5.3], [6.8, -1.2], [-12.5, -1]];
  const DEFENSE = [[-LANE_X, 2], [LANE_X, 2], [-9, 13], [9, 13], [-4.5, 5], [0.5, 5.5], [5, 5]];

  function drawFormation(parent, opts = {}) {
    const g = svg('g', null, parent);
    const los = svg('g', null, g);
    svg('polygon', { points: quad(-HALF, -0.16, HALF, 0.16), fill: '#2f9bff', filter: 'url(#glow)' }, los);
    if (!opts.noDefense) {
      DEFENSE.forEach(([X, D]) => {
        const q = P(X, D), s = 0.62 * q.k;
        svg('path', { d: `M${f1(q.x - s)} ${f1(q.y - s * 0.7)} L${f1(q.x + s)} ${f1(q.y + s * 0.7)} M${f1(q.x + s)} ${f1(q.y - s * 0.7)} L${f1(q.x - s)} ${f1(q.y + s * 0.7)}`, stroke: '#ff9aa8', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.4 }, g);
      });
    }
    OFFENSE.forEach(([X, D]) => {
      const q = P(X, D);
      svg('ellipse', { cx: f1(q.x), cy: f1(q.y), rx: f1(0.78 * q.k), ry: f1(0.78 * q.k * 0.8), fill: 'rgba(255,255,255,0.16)', stroke: 'rgba(255,255,255,0.7)', 'stroke-width': 2 }, g);
    });
    const wide = {};
    ['L', 'R'].forEach((side) => {
      const q = P((side === 'L' ? -1 : 1) * LANE_X, -0.8);
      wide[side] = svg('ellipse', { cx: f1(q.x), cy: f1(q.y), rx: f1(0.78 * q.k), ry: f1(0.78 * q.k * 0.8), fill: 'rgba(255,255,255,0.16)', stroke: 'rgba(255,255,255,0.7)', 'stroke-width': 2 }, g);
    });
    const ball = P(0, 0);
    svg('ellipse', { cx: f1(ball.x), cy: f1(ball.y), rx: 7, ry: 4.5, fill: '#8a4a1c', stroke: '#2b1406', 'stroke-width': 1.5 }, g);
    return { g, wide };
  }

  function makeLaneIcon(parent, label) {
    const g = svg('g', null, parent);
    svg('circle', { r: 30, fill: '#ffc72c', opacity: 0.35, filter: 'url(#bigglow)' }, g);
    svg('ellipse', { rx: 22, ry: 19, cy: 3, fill: '#000', opacity: 0.35 }, g);
    svg('circle', { r: 21, fill: 'url(#laneFill)', stroke: '#ffc72c', 'stroke-width': 3.5 }, g);
    text(g, String(label), { y: 1, 'font-size': 27, 'font-weight': 700, fill: '#fff', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    return g;
  }
  function placeLane(icon, x, y, k, scale = 1, opacity = 1) {
    icon.setAttribute('transform', `translate(${f1(x)},${f1(y)}) scale(${(scale * k / K0).toFixed(3)})`);
    icon.setAttribute('opacity', opacity.toFixed(3));
  }

  function makeBall(parent) {
    const g = svg('g', { opacity: 0 }, parent);
    const shadow = svg('ellipse', { rx: 8, ry: 3.5, fill: '#000', opacity: 0.4 }, g);
    const body = svg('g', null, g);
    svg('ellipse', { rx: 11, ry: 6.5, fill: '#8a4a1c', stroke: '#2b1406', 'stroke-width': 1.5 }, body);
    svg('path', { d: 'M-4 0 L4 0 M-2 -2 L-2 2 M0 -2 L0 2 M2 -2 L2 2', stroke: '#fff', 'stroke-width': 1.3 }, body);
    return { g, shadow, body };
  }

  // ---------- telestrator fx ----------
  function scribblePath(cx, cy, rx, ry, seed) {
    const pts = [];
    const N = 80;
    const a0 = -2.4 + seed * 0.9;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const a = a0 + u * 1.3 * 2 * Math.PI;
      const j = 1 + 0.07 * Math.sin(u * 19 + seed * 3) + 0.14 * u;
      const x = Math.cos(a) * rx * j, y = Math.sin(a) * ry * j;
      pts.push([cx + x + 0.18 * y, cy + y]);
    }
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return { d: 'M' + pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join(' L'), L };
  }
  function burstPoints(R, r, n, seed) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 ? r : R * (0.85 + 0.15 * Math.sin(i * 2.3 + seed));
      pts.push(`${f1(Math.cos(a) * rad)},${f1(Math.sin(a) * rad)}`);
    }
    return pts.join(' ');
  }
  const INK = '#07061a';
  function outlined(attrs, w = 7) {
    return Object.assign({ stroke: INK, 'stroke-width': w, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, attrs);
  }

  function makeChip(parent, str, color) {
    const g = svg('g', { opacity: 0 }, parent);
    const w = str.length * 10.5 + 18;
    svg('rect', { x: -w / 2, y: -15, width: w, height: 30, rx: 4, fill: 'rgba(7,6,26,0.86)', stroke: color, 'stroke-width': 2 }, g);
    text(g, str, { y: 1, 'font-size': 19, 'font-weight': 600, fill: '#fff', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'letter-spacing': 0.5 });
    return g;
  }

  function setRoute(tgt, p, opacity) {
    tgt.g.setAttribute('opacity', opacity.toFixed(3));
    const da = dashArray(tgt.r.L, p, tgt.dashed);
    tgt.line.setAttribute('stroke-dasharray', da);
    tgt.under.setAttribute('stroke-dasharray', dashArray(tgt.r.L, p, false));
    const tip = pointAt(tgt.r, tgt.r.L * p);
    tgt.arrow.setAttribute('transform', `translate(${f1(tip.x)},${f1(tip.y)}) rotate(${f1((tip.ang * 180) / Math.PI)}) scale(${(tip.k / K0).toFixed(3)})`);
    const showBall = tgt.ballAtEnd && p >= 1;
    tgt.arrow.setAttribute('opacity', p > 0.01 && !showBall ? 1 : 0);
    tgt.endBall.setAttribute('opacity', showBall ? 1 : 0);
    return tip;
  }

  // Glowing route line with an arrow tip (and optional ball marker at the end).
  function routeLine(parent, r, { color, dashed = false, ballAtEnd = false, width = 6 }) {
    const g = svg('g', { opacity: 0 }, parent);
    const under = svg('path', { d: r.d, fill: 'none', stroke: INK, 'stroke-width': width + 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.45 }, g);
    const line = svg('path', { d: r.d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', filter: 'url(#glow)' }, g);
    const arrow = svg('path', { d: 'M8 0 L-8 -8 L-4 0 L-8 8 Z', fill: color, stroke: INK, 'stroke-width': 1.5 }, g);
    const endBall = svg('g', { opacity: 0 }, g);
    svg('ellipse', { rx: 9, ry: 5.5, fill: '#8a4a1c', stroke: INK, 'stroke-width': 1.5, transform: 'rotate(-25)' }, endBall);
    endBall.setAttribute('transform', `translate(${f1(r.end.x)},${f1(r.end.y)})`);
    return { r, g, under, line, arrow, endBall, dashed, color, ballAtEnd };
  }

  function placeBall(ball, from, to, u) {
    if (u <= 0 || u >= 1) { ball.g.setAttribute('opacity', 0); return; }
    const X = lerp(from[0], to[0], u), Dd = lerp(from[1], to[1], u);
    const ground = P(X, Dd);
    const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const h = Math.sin(Math.PI * u) * (2.5 + dist * 0.28) * ground.k;
    ball.g.setAttribute('opacity', 1);
    ball.shadow.setAttribute('transform', `translate(${f1(ground.x)},${f1(ground.y)}) scale(${(ground.k / K0).toFixed(3)})`);
    const a = P(from[0], from[1]), b = P(to[0], to[1]);
    const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    ball.body.setAttribute('transform', `translate(${f1(ground.x)},${f1(ground.y - h)}) rotate(${f1(ang)}) scale(${(ground.k / K0).toFixed(3)})`);
  }

  // ---------- per-segment layers ----------
  const panel = $('panel');
  const overlay = $('overlay');

  function clearAll() {
    world.innerHTML = '';
    labels.innerHTML = '';
    screen.innerHTML = '';
    overlay.innerHTML = '';
    panel.innerHTML = '';
  }

  function layerSet() {
    const fields = svg('g', null, world);
    const over = svg('g', null, world);
    drawFieldOverlays(over);
    const marks = drawDepthMarks(world);
    const formation = svg('g', null, world);
    const routes = svg('g', null, world);
    const fx = svg('g', null, world);
    const actors = svg('g', null, world);
    return { fields, marks, formation, routes, fx, actors };
  }

  function fieldTitle(str, sub) {
    const g = svg('g', { opacity: 0 }, labels);
    const w = Math.max(str.length, (sub || '').length * 0.6) * 21 + 60;
    svg('rect', { x: -w / 2, y: -30, width: w, height: sub ? 86 : 60, fill: 'rgba(7,6,26,0.88)', stroke: '#ffc72c', 'stroke-width': 2.5, transform: 'skewX(-10)' }, g);
    text(g, str, { y: 0, 'font-size': 36, 'font-weight': 700, fill: '#fff', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'letter-spacing': 3 });
    if (sub) text(g, sub, { y: 38, 'font-size': 19, 'font-weight': 500, fill: '#ffc72c', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'letter-spacing': 3 });
    g.setAttribute('transform', `translate(${BOX.x + BOX.w / 2},${BOX.y + 58})`);
    return g;
  }

  function playBug() {
    const g = svg('g', { opacity: 0 }, labels);
    svg('rect', { x: 0, y: 0, width: 270, height: 74, fill: 'rgba(7,6,26,0.88)', stroke: 'rgba(255,199,44,0.6)', 'stroke-width': 2, transform: 'skewX(-10)' }, g);
    svg('rect', { x: 0, y: 0, width: 8, height: 74, fill: '#ffc72c', transform: 'skewX(-10)' }, g);
    const a = text(g, '', { x: 22, y: 26, 'font-size': 24, 'font-weight': 700, fill: '#fff', 'letter-spacing': 2, 'dominant-baseline': 'central' });
    const b = text(g, '', { x: 22, y: 54, 'font-size': 18, 'font-weight': 500, fill: '#ffc72c', 'letter-spacing': 2, 'dominant-baseline': 'central' });
    g.setAttribute('transform', `translate(${BOX.x + 30},${BOX.y + 22})`);
    return { g, a, b };
  }

  // Full-width swoosh banner used at the start of a segment.
  function banner(big, title, sub, color = '#241773') {
    const grp = svg('g', { opacity: 0 }, screen);
    const cy = BOX.y + BOX.h * 0.46;
    const x0 = BOX.x - 96, x1 = BOX.x + BOX.w + 76;
    const wx = BOX.x + (VERTICAL ? 40 : 194), ox = wx + 330;
    svg('polygon', { points: `${x0 + 40},${cy - 70} ${x1 + 40},${cy - 70} ${x1},${cy + 70} ${x0},${cy + 70}`, fill: color, opacity: 0.94 }, grp);
    svg('polygon', { points: `${x0 + 40},${cy + 62} ${x1 + 40},${cy + 62} ${x1 + 36},${cy + 72} ${x0 + 36},${cy + 72}`, fill: '#ffc72c' }, grp);
    text(grp, big, { x: wx, y: cy, 'font-size': 92, 'font-weight': 700, fill: '#ffc72c', 'dominant-baseline': 'central', 'letter-spacing': 2 });
    text(grp, title, { x: ox, y: cy - 16, 'font-size': 54, 'font-weight': 700, fill: '#fff', 'dominant-baseline': 'central', 'letter-spacing': 2 });
    text(grp, sub, { x: ox + 2, y: cy + 34, 'font-size': VERTICAL ? 22 : 26, 'font-weight': 500, fill: '#c8c3f0', 'dominant-baseline': 'central', 'letter-spacing': VERTICAL ? 2 : 3 });
    return grp;
  }
  function slideBanner(grp, lt, outAt = 1.25) {
    const bIn = easeOut(span(lt, 0.1, 0.5)), bOut = easeInOut(span(lt, outAt, outAt + 0.35));
    grp.setAttribute('opacity', lt < outAt + 0.35 ? 1 : 0);
    grp.setAttribute('transform', `translate(${f1(lerp(-STAGE.w * 0.75, 0, bIn) + lerp(0, STAGE.w * 0.8, bOut))},0)`);
  }

  // ---------- playback ----------
  // segments: [{ kind, tab, dur, build(seg), update(seg, lt), intro? }]
  // tabs:     [{ id, label, cls? }]
  function run({ segments, tabs }) {
    const SEGS = [];
    let total = 0;
    segments.forEach((s) => { SEGS.push(Object.assign(s, { start: total })); total += s.dur; });
    const DURATION = total;

    const bgSweep = document.createElement('div');
    bgSweep.style.cssText = 'position:absolute;top:-200px;width:420px;height:1500px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.045),transparent);transform-origin:center;pointer-events:none';
    $('bg').appendChild(bgSweep);

    const tabsEl = $('tabs');
    tabs.forEach((tb) => {
      const el = document.createElement('div');
      el.className = 'tab' + (tb.cls ? ` ${tb.cls}` : '');
      el.innerHTML = `<div class="prog"></div><span>${tb.label}</span>`;
      el.addEventListener('click', () => seek(SEGS.find((s) => s.tab === tb.id).start + 0.01));
      tabsEl.appendChild(el);
      tb.el = el;
      tb.prog = el.firstElementChild;
    });

    let current = null;
    function segAt(t) {
      for (let i = SEGS.length - 1; i >= 0; i--) if (t >= SEGS[i].start) return SEGS[i];
      return SEGS[0];
    }
    function render(t) {
      t = clamp(t, 0, DURATION - 0.001);
      const seg = segAt(t);
      const lt = t - seg.start;
      if (current !== seg) {
        clearAll();
        seg.build(seg);
        current = seg;
      }
      seg.update(seg, lt);
      if (!seg.intro) {
        $('header').style.opacity = 1;
        tabsEl.style.opacity = 1;
      }
      // segment cross-fade
      const isLast = seg === SEGS[SEGS.length - 1];
      const fade = Math.min(easeOut(span(lt, 0, 0.35)), isLast ? 1 : 1 - span(lt, seg.dur - 0.3, seg.dur));
      world.setAttribute('opacity', fade.toFixed(3));
      labels.setAttribute('opacity', fade.toFixed(3));
      screen.setAttribute('opacity', fade.toFixed(3));
      overlay.style.opacity = seg.intro ? 1 : fade;
      const pIn = easeOut(span(lt, 0, 0.45));
      panel.style.opacity = seg.intro ? 0 : fade;
      panel.style.transform = `translateX(${f1((1 - pIn) * 60)}px)`;
      tabs.forEach((tb) => {
        const on = tb.id === seg.tab;
        tb.el.classList.toggle('active', on);
        tb.prog.style.width = on ? `${f1((lt / seg.dur) * 100)}%` : '0%';
      });
      bgSweep.style.transform = `translateX(${f1(((t * 140) % 3200) - 800)}px) rotate(18deg)`;
      if (!scrubbing) scrub.value = Math.round((t / DURATION) * 1000);
    }

    // stage scaling
    const stage = $('stage');
    function fitStage() {
      const s = RECORD ? 1 : Math.min(innerWidth / STAGE.w, innerHeight / STAGE.h);
      stage.style.transform = `scale(${s})`;
    }
    addEventListener('resize', fitStage);
    fitStage();

    let time = Number(query.get('t')) || 0;
    const startSeg = query.get('seg');
    if (startSeg) {
      const s = SEGS.find((x) => x.tab === startSeg);
      if (s) time = s.start + 0.01;
    }
    let playing = !RECORD && !query.has('paused');
    let speed = 1;
    let last = null;
    let scrubbing = false;
    const scrub = $('scrub');
    const btnPlay = $('btn-play');

    function seek(t) {
      time = clamp(t, 0, DURATION - 0.001);
      render(time);
    }
    function setPlaying(p) {
      playing = p;
      btnPlay.textContent = p ? '❚❚' : '▶';
      last = null;
    }
    function tick(now) {
      if (playing) {
        if (last != null) time += ((now - last) / 1000) * speed;
        last = now;
        if (time >= DURATION) time = 0; // loop
        render(time);
      }
      requestAnimationFrame(tick);
    }

    btnPlay.addEventListener('click', () => setPlaying(!playing));
    $('btn-restart').addEventListener('click', () => { seek(0); setPlaying(true); });
    $('btn-speed').addEventListener('click', (e) => {
      speed = speed === 1 ? 0.5 : speed === 0.5 ? 2 : 1;
      e.target.textContent = `${speed}×`;
    });
    scrub.addEventListener('input', () => { scrubbing = true; seek((scrub.value / 1000) * DURATION); });
    scrub.addEventListener('change', () => { scrubbing = false; });
    addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
      if (e.key === 'r' || e.key === 'R') { seek(0); setPlaying(true); }
      const idx = SEGS.indexOf(segAt(time));
      if (e.key === 'ArrowRight' && idx < SEGS.length - 1) seek(SEGS[idx + 1].start + 0.01);
      if (e.key === 'ArrowLeft') seek(SEGS[Math.max(0, idx - (time - SEGS[idx].start < 1 ? 1 : 0))].start + 0.01);
    });

    // hooks for tools/record.mjs and tools/snap.mjs
    window.__duration = DURATION;
    window.__seek = (t) => { time = t; render(t); };
    window.__segments = SEGS.map((s) => ({ kind: s.kind, tab: s.tab, start: s.start, dur: s.dur }));

    setPlaying(playing);
    document.fonts.ready.then(() => {
      render(time);
      window.__ready = true;
      requestAnimationFrame(tick);
    });
  }

  return {
    query, RECORD, VERTICAL, STAGE,
    clamp, lerp, span, easeInOut, easeOut, easeBack, f1, svg, text, $,
    HALF, D_MIN, D_MAX, LANE_X, BOX, P, K0, poly, quad, foreshorten,
    curve, ROUTES, makeRoute, pointAt, dashArray,
    root, world, labels, screen, panel, overlay,
    drawField, drawFieldOverlays, drawDepthMarks,
    OFFENSE, DEFENSE, drawFormation, makeLaneIcon, placeLane, makeBall, placeBall,
    scribblePath, burstPoints, INK, outlined, makeChip,
    routeLine, setRoute,
    clearAll, layerSet, fieldTitle, playBug, banner, slideBanner,
    run,
  };
})();
