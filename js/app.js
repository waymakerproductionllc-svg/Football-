/*
 * Ja'Kobi Lane route-tree animation.
 *
 * Everything on screen is a pure function of time `t` (seconds): render(t)
 * rebuilds the active segment when it changes and then only updates
 * attributes. That keeps playback, scrubbing and frame-by-frame video export
 * (tools/record.mjs) identical.
 */
(() => {
  'use strict';

  const DATA = window.LANE_DATA;
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

  // ---------- data helpers ----------
  const yardsToGoal = (los) => (los ? (los.opp != null ? los.opp : 100 - los.own) : null);
  function losText(game, t) {
    if (!t.los) return null;
    if (t.losEst) return 'RED ZONE';
    if (t.los.opp != null) return t.los.opp === 50 ? 'MIDFIELD' : `${game.opp} ${t.los.opp}`;
    return t.los.own === 50 ? 'MIDFIELD' : `BAL ${t.los.own}`;
  }
  function statsOf(targets, upto = Infinity) {
    const s = { tgt: 0, rec: 0, yds: 0, lng: 0, td: 0 };
    targets.forEach((t, i) => {
      if (i >= upto || t.result === 'noplay') return;
      s.tgt++;
      if (t.result === 'catch') {
        s.rec++;
        s.yds += t.yards;
        s.lng = Math.max(s.lng, t.yards);
        if (t.td) s.td++;
      }
    });
    return s;
  }
  const GAMES = DATA.games.filter((g) => !g.ir);
  const SEASON_COLORS = { wk1: '#3fd4ff', wk6: '#ffc72c', wk7: '#ff6ad5' };
  const COLORS = { catch: '#ffd21f', inc: '#ff3b5c', noplay: '#c9c7da' };

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

  function makeLaneIcon(parent) {
    const g = svg('g', null, parent);
    svg('circle', { r: 30, fill: '#ffc72c', opacity: 0.35, filter: 'url(#bigglow)' }, g);
    svg('ellipse', { rx: 22, ry: 19, cy: 3, fill: '#000', opacity: 0.35 }, g);
    svg('circle', { r: 21, fill: 'url(#laneFill)', stroke: '#ffc72c', 'stroke-width': 3.5 }, g);
    text(g, String(DATA.player.number), { y: 1, 'font-size': 27, 'font-weight': 700, fill: '#fff', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
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

  // One target = route + arrow + fx. Built once per segment, updated per frame.
  function buildTarget(t, i, layers, opts = {}) {
    const r = makeRoute(t);
    const color = opts.color || COLORS[t.result];
    const dashed = t.result !== 'catch';
    const g = svg('g', { opacity: 0 }, layers.routes);
    const under = svg('path', { d: r.d, fill: 'none', stroke: INK, 'stroke-width': 11, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.45 }, g);
    const line = svg('path', { d: r.d, fill: 'none', stroke: color, 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', filter: 'url(#glow)' }, g);
    const arrow = svg('path', { d: 'M8 0 L-8 -8 L-4 0 L-8 8 Z', fill: color, stroke: INK, 'stroke-width': 1.5 }, g);
    const endBall = svg('g', { opacity: 0 }, g);
    svg('ellipse', { rx: 9, ry: 5.5, fill: '#8a4a1c', stroke: INK, 'stroke-width': 1.5, transform: 'rotate(-25)' }, endBall);
    endBall.setAttribute('transform', `translate(${f1(r.end.x)},${f1(r.end.y)})`);

    const tgt = { t, i, r, g, under, line, arrow, endBall, dashed, color };
    if (opts.light) return tgt;

    // fx anchored at the ball spot
    const spot = P(r.ballField[0], r.ballField[1]);
    tgt.spot = spot;
    const fx = svg('g', null, layers.fx);
    tgt.fx = fx;
    if (t.result === 'catch' || t.result === 'noplay') {
      const sc = scribblePath(r.end.x, r.end.y, 44 * r.end.k / K0, 30 * r.end.k / K0, i + 1);
      tgt.scribble = svg('path', { d: sc.d, fill: 'none', stroke: '#ffe600', 'stroke-width': 5, 'stroke-linecap': 'round', filter: 'url(#glow)', opacity: 0 }, fx);
      tgt.scribbleL = sc.L;
    }
    if (t.result === 'inc') {
      const s = 14;
      tgt.xmark = svg('path', { d: `M${-s} ${-s} L${s} ${s} M${s} ${-s} L${-s} ${s}`, stroke: '#ff3b5c', 'stroke-width': 7, 'stroke-linecap': 'round', filter: 'url(#glow)', opacity: 0, transform: `translate(${f1(spot.x)},${f1(spot.y)})` }, fx);
    }
    // pop text
    const pop = svg('g', { opacity: 0 }, labels);
    tgt.pop = pop;
    const above = r.end.y - 132 >= BOX.y + 110;
    tgt.popAt = { x: clamp(r.end.x, BOX.x + 110, BOX.x + BOX.w - 110), y: above ? r.end.y - 132 : r.end.y + 120 };
    if (t.result === 'catch' && t.yards >= 10) {
      svg('polygon', { points: burstPoints(84, 56, 11, i), fill: '#ffe600', stroke: INK, 'stroke-width': 5 }, pop);
      text(pop, 'BOOM!', outlined({ y: -6, 'font-size': 50, 'font-weight': 700, fill: '#e8112d', 'text-anchor': 'middle', 'dominant-baseline': 'central', transform: 'rotate(-8)' }, 6));
      text(pop, `+${t.yards} YDS`, outlined({ y: 76, 'font-size': 36, 'font-weight': 700, fill: '#ffc72c', 'text-anchor': 'middle', 'dominant-baseline': 'central' }));
    } else if (t.result === 'catch') {
      text(pop, `+${t.yards}`, outlined({ y: 0, 'font-size': 70, 'font-weight': 700, fill: '#ffc72c', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 9));
      text(pop, 'YDS', outlined({ y: 46, 'font-size': 26, 'font-weight': 600, fill: '#fff', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'letter-spacing': 3 }));
    } else if (t.result === 'inc') {
      text(pop, 'INC', outlined({ y: 0, 'font-size': 64, 'font-weight': 700, fill: '#ff3b5c', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'letter-spacing': 4 }, 9));
    } else {
      tgt.popTD = svg('g', null, pop);
      svg('polygon', { points: burstPoints(80, 54, 11, i), fill: '#ffe600', stroke: INK, 'stroke-width': 5 }, tgt.popTD);
      text(tgt.popTD, 'TD!', outlined({ y: 0, 'font-size': 58, 'font-weight': 700, fill: '#e8112d', 'text-anchor': 'middle', 'dominant-baseline': 'central', transform: 'rotate(-8)' }, 6));
      tgt.popNP = svg('g', { opacity: 0 }, pop);
      svg('rect', { x: -150, y: -34, width: 300, height: 68, fill: 'rgba(7,6,26,0.9)', stroke: '#ffe600', 'stroke-width': 4, transform: 'skewX(-10)' }, tgt.popNP);
      text(tgt.popNP, 'NO PLAY · HOLDING', { y: 2, 'font-size': 34, 'font-weight': 700, fill: '#ffe600', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'letter-spacing': 1 });
      tgt.flag = svg('g', { opacity: 0 }, fx);
      svg('path', { d: 'M0 0 C 10 -6, 20 6, 30 0 L 30 20 C 20 26, 10 14, 0 20 Z', fill: '#ffe600', stroke: INK, 'stroke-width': 2 }, tgt.flag);
    }
    const chipStr = t.result === 'catch' ? `${t.route} +${t.yards}` : t.result === 'inc' ? `${t.route} · INC` : `${t.route} · NO PLAY`;
    tgt.chip = makeChip(labels, chipStr, color);
    const lead = pointAt(r, r.L);
    const cx = r.end.x + Math.cos(lead.ang) * 40;
    const cy = r.end.y + Math.sin(lead.ang) * 20 - 24;
    tgt.chip.setAttribute('transform', `translate(${f1(clamp(cx, BOX.x + 80, BOX.x + BOX.w - 80))},${f1(Math.max(BOX.y + 24, cy))})`);
    return tgt;
  }

  function setRoute(tgt, p, opacity) {
    tgt.g.setAttribute('opacity', opacity.toFixed(3));
    const da = dashArray(tgt.r.L, p, tgt.dashed);
    tgt.line.setAttribute('stroke-dasharray', da);
    tgt.under.setAttribute('stroke-dasharray', dashArray(tgt.r.L, p, false));
    const tip = pointAt(tgt.r, tgt.r.L * p);
    tgt.arrow.setAttribute('transform', `translate(${f1(tip.x)},${f1(tip.y)}) rotate(${f1((tip.ang * 180) / Math.PI)}) scale(${(tip.k / K0).toFixed(3)})`);
    const showBall = tgt.t.result !== 'inc' && p >= 1;
    tgt.arrow.setAttribute('opacity', p > 0.01 && !showBall ? 1 : 0);
    tgt.endBall.setAttribute('opacity', showBall ? 1 : 0);
    return tip;
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

  // Result effects for a target; st = seconds since the target slot started.
  function setFx(tgt, st, active) {
    const t = tgt.t;
    const fxOn = active && st >= 1.55;
    const fade = 1 - span(st, 2.3, 2.6);
    if (tgt.scribble) {
      const u = easeOut(span(st, 1.55, 1.95));
      tgt.scribble.setAttribute('opacity', fxOn ? fade : 0);
      tgt.scribble.setAttribute('stroke-dasharray', `${f1(tgt.scribbleL * u)} ${f1(tgt.scribbleL + 10)}`);
    }
    if (tgt.xmark) {
      const u = easeBack(span(st, 1.55, 1.8));
      tgt.xmark.setAttribute('opacity', fxOn ? fade : 0);
      tgt.xmark.setAttribute('transform', `translate(${f1(tgt.spot.x)},${f1(tgt.spot.y)}) scale(${(u * tgt.spot.k / K0).toFixed(3)})`);
    }
    const popU = easeBack(span(st, 1.55, 1.85));
    tgt.pop.setAttribute('opacity', fxOn ? fade : 0);
    tgt.pop.setAttribute('transform', `translate(${f1(tgt.popAt.x)},${f1(tgt.popAt.y)}) scale(${(0.3 + 0.7 * popU).toFixed(3)})`);
    if (t.result === 'noplay') {
      const np = span(st, 1.95, 2.1);
      tgt.popTD.setAttribute('opacity', 1 - np);
      tgt.popNP.setAttribute('opacity', np);
      const fu = easeOut(span(st, 1.85, 2.1));
      const fx0 = tgt.r.end.x + 40, fy0 = tgt.r.end.y + 10;
      tgt.flag.setAttribute('opacity', fxOn ? fade : 0);
      tgt.flag.setAttribute('transform', `translate(${f1(fx0)},${f1(lerp(fy0 - 160, fy0, fu))}) rotate(${f1(lerp(-120, 15, fu))})`);
    }
  }

  // ---------- panel (HTML) ----------
  const panel = $('panel');
  function statBox(k, v) {
    return `<div class="stat"><div class="v">${v}</div><div class="k">${k}</div></div>`;
  }
  function buildGamePanel(g) {
    const total = statsOf(g.targets);
    panel.innerHTML = `
      <div class="p-week"><span class="wk">WEEK ${g.week}</span><span class="opp">${g.home ? 'vs' : '@'} ${g.oppName}</span></div>
      <div class="p-meta"><span>${g.date}</span><span>·</span><span class="res-${g.result}">${g.result} ${g.score}</span><span>·</span><span>QB ${g.qb}</span></div>
      <div class="p-stats">${['TGT', 'REC', 'YDS', 'LNG', 'TD'].map((k) => statBox(k, 0)).join('')}</div>
      <div class="p-list">${g.targets.map((t, i) => {
        const los = losText(g, t);
        const badge = t.result === 'catch' ? `+${t.yards}` : t.result === 'inc' ? 'INC' : 'NO PLAY';
        return `<div class="row"><div class="n">${String(i + 1).padStart(2, '0')}</div>
          <div class="rt">${t.route}${los ? `<span class="los">LOS ${los}</span>` : ''}</div>
          <div class="badge ${t.result}">${badge}</div>
          <div class="pbp">${t.pbp}</div></div>`;
      }).join('')}</div>
      <div class="p-note"><b>FILM NOTE</b>${g.note}</div>`;
    const stats = [...panel.querySelectorAll('.stat')];
    return { rows: [...panel.querySelectorAll('.row')], stats, total };
  }
  function setStats(ref, s, hotKey) {
    const vals = [s.tgt, s.rec, s.yds, s.lng, s.td];
    ref.stats.forEach((el, i) => {
      const v = el.firstElementChild;
      if (v.textContent !== String(vals[i])) v.textContent = vals[i];
      el.classList.toggle('hot', hotKey > 0 && i < 4 && (i === 0 || (i > 0 && hotKey > 1)));
    });
  }
  function buildSeasonPanel() {
    const all = GAMES.flatMap((g) => g.targets);
    const s = statsOf(all);
    const byWeek = {};
    GAMES.forEach((g) => { byWeek[g.week] = statsOf(g.targets).yds; });
    const maxY = Math.max(...Object.values(byWeek));
    const weeks = [1, 2, 3, 4, 5, 6, 7, 8];
    const bars = weeks.map((w) => {
      if (byWeek[w] != null) return `<div class="bar"><div class="lbl">${byWeek[w]}</div><div class="fill" data-h="${(byWeek[w] / maxY) * (VERTICAL ? 110 : 150)}"></div></div>`;
      if (w === 8) return `<div class="bar"><div class="lbl" style="font-size:16px;color:var(--dim)">NOV 1</div><div class="fill next" data-h="40"></div></div>`;
      return `<div class="bar"><div class="lbl ir">IR</div><div class="fill ir" data-h="26"></div></div>`;
    }).join('');
    panel.innerHTML = `
      <div class="p-week"><span class="wk">${DATA.season}</span><span class="opp">SEASON TREE</span></div>
      <div class="p-meta"><span>${GAMES.length} GAMES</span><span>·</span><span>WEEKS 1–7</span><span>·</span><span>4 GAMES ON IR</span></div>
      <div class="s-grid"><div>
      <div class="p-stats">${[['TGT', s.tgt], ['REC', s.rec], ['YDS', s.yds], ['LNG', s.lng], ['TD', s.td]].map(([k, v]) => statBox(k, v)).join('')}</div>
      <div class="s-line">${[['Y/REC', (s.yds / s.rec).toFixed(1)], ['CATCH %', Math.round((100 * s.rec) / s.tgt)], ['YDS/G', (s.yds / GAMES.length).toFixed(1)], ['TGT/G', (s.tgt / GAMES.length).toFixed(1)]].map(([k, v]) => `<div class="stat small"><div class="v">${v}</div><div class="k">${k}</div></div>`).join('')}</div>
      </div>
      <div class="chart"><h4>RECEIVING YARDS BY WEEK</h4><div class="bars">${bars}</div>
        <div class="bar-x">${weeks.map((w) => `<span>W${w}</span>`).join('')}</div></div></div>
      <div class="legend">${GAMES.map((g) => `<span><i style="background:${SEASON_COLORS[g.id]}"></i>WK ${g.week} ${g.home ? 'vs' : '@'} ${g.opp}</span>`).join('')}
        <span><i style="background:repeating-linear-gradient(90deg,#fff 0 8px,transparent 8px 13px)"></i>INCOMPLETE</span></div>
      <div class="p-note"><b>NEXT UP</b>${DATA.nextGame}</div>`;
    return { fills: [...panel.querySelectorAll('.fill')], stats: [...panel.querySelectorAll('.stat')] };
  }
  function buildIrPanel(g) {
    panel.innerHTML = `
      <div class="p-week"><span class="wk" style="background:var(--red);color:#fff">${g.title}</span><span class="opp">SIDELINED</span></div>
      <div class="p-meta"><span>${g.headline}</span></div>
      <div class="p-stats">${['TGT', 'REC', 'YDS', 'LNG', 'TD'].map((k) => statBox(k, '—')).join('')}</div>
      <div class="p-list">${g.lines.map((l, i) => `<div class="row"><div class="n">${String(i + 1).padStart(2, '0')}</div><div class="rt">${l}</div></div>`).join('')}</div>
      <div class="p-note"><b>STATUS</b>Missed four games after fracturing his wrist in the opener. Returned to practice and was activated off injured reserve ahead of Week 6.</div>`;
    return { rows: [...panel.querySelectorAll('.row')] };
  }

  // ---------- header / tabs / footer (built once) ----------
  $('hdr-num').textContent = DATA.player.number;
  $('hdr-first').textContent = `${DATA.player.first} · ${DATA.player.pos} · ${DATA.player.team}`;
  $('hdr-last').textContent = DATA.player.last;
  $('hdr-season').textContent = DATA.season;
  $('footer').innerHTML =
    `<span>Targets charted from public play-by-play (yardage · direction · field position). Route types are reconstructions, not official tracking data.</span>` +
    `<span>Sources: ${DATA.sources.join(', ')} · Unofficial fan graphic</span>`;
  const bgSweep = document.createElement('div');
  bgSweep.style.cssText = 'position:absolute;top:-200px;width:420px;height:1500px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.045),transparent);transform-origin:center;pointer-events:none';
  $('bg').appendChild(bgSweep);

  // ---------- timeline ----------
  const T = { intro: 3.8, gameIn: 1.7, target: 2.6, tree: 3.8, ir: 3.6, season: 9 };
  const SEGS = [];
  let total = 0;
  SEGS.push({ kind: 'intro', start: 0, dur: T.intro, tab: null });
  total = T.intro;
  DATA.games.forEach((g) => {
    const dur = g.ir ? T.ir : T.gameIn + g.targets.length * T.target + T.tree;
    SEGS.push({ kind: g.ir ? 'ir' : 'game', g, start: total, dur, tab: g.id });
    total += dur;
  });
  SEGS.push({ kind: 'season', start: total, dur: T.season, tab: 'season' });
  total += T.season;
  const DURATION = total;

  const tabsEl = $('tabs');
  const TABS = [...DATA.games.map((g) => ({ id: g.id, label: g.tab, ir: !!g.ir })), { id: 'season', label: 'SEASON' }];
  TABS.forEach((tb) => {
    const el = document.createElement('div');
    el.className = 'tab' + (tb.ir ? ' ir' : '');
    el.innerHTML = `<div class="prog"></div><span>${tb.label}</span>`;
    el.addEventListener('click', () => seek(SEGS.find((s) => s.tab === tb.id).start + 0.01));
    tabsEl.appendChild(el);
    tb.el = el;
    tb.prog = el.firstElementChild;
  });

  // ---------- segment builders ----------
  let current = null;
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

  function seasonRoutes(layers) {
    const list = [];
    GAMES.forEach((g) => g.targets.forEach((t) => {
      list.push(buildTarget(t, list.length, layers, { light: true, color: t.result === 'noplay' ? COLORS.noplay : SEASON_COLORS[g.id] }));
    }));
    return list;
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

  function banner(g) {
    const grp = svg('g', { opacity: 0 }, screen);
    const cy = BOX.y + BOX.h * 0.46;
    const x0 = BOX.x - 96, x1 = BOX.x + BOX.w + 76;
    const wx = BOX.x + (VERTICAL ? 40 : 194), ox = wx + 330;
    svg('polygon', { points: `${x0 + 40},${cy - 70} ${x1 + 40},${cy - 70} ${x1},${cy + 70} ${x0},${cy + 70}`, fill: '#241773', opacity: 0.94 }, grp);
    svg('polygon', { points: `${x0 + 40},${cy + 62} ${x1 + 40},${cy + 62} ${x1 + 36},${cy + 72} ${x0 + 36},${cy + 72}`, fill: '#ffc72c' }, grp);
    text(grp, `WEEK ${g.week}`, { x: wx, y: cy, 'font-size': 92, 'font-weight': 700, fill: '#ffc72c', 'dominant-baseline': 'central', 'letter-spacing': 2 });
    text(grp, `${g.home ? 'vs' : '@'} ${g.oppName}`, { x: ox, y: cy - 16, 'font-size': 54, 'font-weight': 700, fill: '#fff', 'dominant-baseline': 'central', 'letter-spacing': 2 });
    text(grp, `${g.result} ${g.score} · ${g.date} · ${g.targets.filter((x) => x.result !== 'noplay').length} TARGETS`, { x: ox + 2, y: cy + 34, 'font-size': VERTICAL ? 22 : 26, 'font-weight': 500, fill: '#c8c3f0', 'dominant-baseline': 'central', 'letter-spacing': VERTICAL ? 2 : 3 });
    return grp;
  }

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : word.endsWith('H') ? 'ES' : 'S'}`;
  const treeSubtitle = (s) => `${plural(s.tgt, 'TARGET')} · ${plural(s.rec, 'CATCH')} · ${s.yds} YDS`;

  function buildGame(seg) {
    const g = seg.g;
    const L = layerSet();
    drawField(L.fields, null, g.endZone, true); // plain turf shows through field-to-field dissolves
    const fields = g.targets.map((t) => drawField(L.fields, yardsToGoal(t.los), g.endZone));
    const neutral = drawField(L.fields, null, g.endZone);
    const form = drawFormation(L.formation);
    const targets = g.targets.map((t, i) => buildTarget(t, i, L));
    const ball = makeBall(L.actors);
    const lane = makeLaneIcon(L.actors);
    const lane2 = makeLaneIcon(L.actors);
    const sidesUsed = [...new Set(g.targets.map((t) => t.side))];
    seg.ui = {
      L, fields, neutral, form, targets, ball, lane, lane2, sidesUsed,
      panel: buildGamePanel(g),
      title: fieldTitle(`WEEK ${g.week} TARGET TREE`, treeSubtitle(statsOf(g.targets))),
      bug: playBug(),
      banner: banner(g),
    };
  }

  function updateGame(seg, lt) {
    const ui = seg.ui, g = seg.g, n = g.targets.length;
    const treeStart = T.gameIn + n * T.target;
    const inTree = lt >= treeStart;
    const slot = inTree ? n : Math.floor((lt - T.gameIn) / T.target);
    const cur = clamp(slot, 0, n - 1);
    const st = lt - (T.gameIn + cur * T.target);

    // fields: old markings fade out before the new ones fade in (no doubled
    // yard numbers), neutral field in the tree phase
    const switching = slot >= 1 && !inTree;
    const fadeNew = switching ? easeOut(span(st, 0.12, 0.32)) : 1;
    const fadeOld = switching ? 1 - span(st, 0, 0.18) : 0;
    ui.fields.forEach((f, i) => {
      let o = 0;
      if (!inTree) { if (i === cur) o = fadeNew; else if (i === cur - 1) o = fadeOld; }
      else if (i === n - 1) o = 1;
      f.setAttribute('opacity', o);
    });
    ui.neutral.setAttribute('opacity', inTree ? easeOut(span(lt - treeStart, 0, 0.45)) : 0);

    // banner
    const bIn = easeOut(span(lt, 0.1, 0.5)), bOut = easeInOut(span(lt, 1.25, 1.6));
    ui.banner.setAttribute('opacity', lt < 1.6 ? 1 : 0);
    ui.banner.setAttribute('transform', `translate(${f1(lerp(-STAGE.w * 0.75, 0, bIn) + lerp(0, STAGE.w * 0.8, bOut))},0)`);

    // targets
    let resolved = 0, lastResolveAt = -9;
    ui.targets.forEach((tg, i) => {
      const s = lt - (T.gameIn + i * T.target);
      if (inTree) {
        setRoute(tg, 1, 1);
        setFx(tg, 0, false);
        tg.chip.setAttribute('opacity', easeOut(span(lt - treeStart, 0.3 + i * 0.12, 0.6 + i * 0.12)));
      } else if (i < cur) {
        setRoute(tg, 1, 0.32);
        setFx(tg, 9, false);
        tg.chip.setAttribute('opacity', 0);
      } else if (i === cur && slot >= 0) {
        setRoute(tg, easeInOut(span(s, 0.35, 1.55)), 1);
        setFx(tg, s, true);
        tg.chip.setAttribute('opacity', 0);
      } else {
        setRoute(tg, 0, 0);
        setFx(tg, 0, false);
        tg.chip.setAttribute('opacity', 0);
      }
      if (inTree || s >= 1.55) { resolved = i + 1; lastResolveAt = s - 1.55; }
    });

    // Lane icon + ball
    if (inTree) {
      const pulse = 1 + 0.06 * Math.sin((lt - treeStart) * 6);
      [ui.lane, ui.lane2].forEach((ic, j) => {
        const side = ui.sidesUsed[j];
        if (!side) { ic.setAttribute('opacity', 0); return; }
        const q = P((side === 'L' ? -1 : 1) * LANE_X, 0);
        placeLane(ic, q.x, q.y, q.k, pulse, 1);
      });
      ui.ball.g.setAttribute('opacity', 0);
      ['L', 'R'].forEach((sd) => ui.form.wide[sd].setAttribute('opacity', ui.sidesUsed.includes(sd) ? 0 : 1));
    } else {
      const tg = ui.targets[cur];
      ui.lane2.setAttribute('opacity', 0);
      ['L', 'R'].forEach((sd) => ui.form.wide[sd].setAttribute('opacity', sd === tg.t.side ? 0 : 1));
      const p = easeInOut(span(st, 0.35, 1.55));
      const tip = pointAt(tg.r, tg.r.L * p);
      const popIn = slot < 0 ? 0 : easeBack(span(st, 0, 0.3));
      placeLane(ui.lane, tip.x, tip.y, tip.k, 0.6 + 0.4 * popIn, slot < 0 ? 0 : popIn);
      placeBall(ui.ball, [0, -5], tg.r.ballField, slot < 0 ? 0 : span(st, 0.95, 1.55));
    }

    // play bug
    if (!inTree && slot >= 0) {
      const tg = g.targets[cur];
      ui.bug.a.textContent = `TARGET ${cur + 1} OF ${n}`;
      ui.bug.b.textContent = tg.result === 'noplay' ? 'PENALTY · NO PLAY' : `LOS ${losText(g, tg) || 'N/A'}`;
      ui.bug.g.setAttribute('opacity', easeOut(span(lt, T.gameIn - 0.2, T.gameIn + 0.2)));
    } else {
      ui.bug.g.setAttribute('opacity', inTree ? 1 - span(lt - treeStart, 0, 0.3) : 0);
    }
    ui.title.setAttribute('opacity', inTree ? easeOut(span(lt - treeStart, 0.2, 0.6)) : 0);

    // panel
    const pr = ui.panel;
    pr.rows.forEach((row, i) => {
      const u = easeOut(span(lt, 0.5 + i * 0.09, 0.9 + i * 0.09));
      row.style.opacity = u;
      row.style.transform = `translateX(${f1((1 - u) * 40)}px)`;
      row.classList.toggle('active', !inTree && slot === i);
    });
    const s = statsOf(g.targets, resolved);
    const lastResult = resolved ? g.targets[resolved - 1].result : null;
    const hot = lastResolveAt >= 0 && lastResolveAt < 0.7 && !inTree ? { catch: 2, inc: 1 }[lastResult] || 0 : 0;
    setStats(pr, s, hot);
  }

  function buildIntro(seg) {
    const L = layerSet();
    drawField(L.fields, null, '#241773');
    drawFormation(L.formation, { noDefense: true });
    seg.ui = { routes: seasonRoutes(L) };
    overlay.innerHTML = `<div class="ov-card ov-intro">
        <div class="l1">${DATA.player.first}</div>
        <div class="l2">${DATA.player.last}</div>
        <div class="l3">${DATA.season} ROUTE TREE</div>
        <div class="l4">EVERY TARGET · WEEKS 1–7 · #${DATA.player.number} ${DATA.player.team}</div>
      </div>`;
    seg.ui.card = overlay.firstElementChild;
    seg.ui.lines = [...seg.ui.card.children];
  }
  function updateIntro(seg, lt) {
    const ui = seg.ui;
    ui.routes.forEach((tg, i) => setRoute(tg, easeInOut(span(lt, 0.3 + i * 0.1, 1.3 + i * 0.1)), 0.3));
    const [l1, l2, l3, l4] = ui.lines;
    const out = easeInOut(span(lt, seg.dur - 0.6, seg.dur));
    ui.card.style.transform = `translate(-50%,-50%) scale(${f1(1 + out * 0.15)})`;
    ui.card.style.opacity = 1 - out;
    const a = easeOut(span(lt, 0.05, 0.55));
    l1.style.opacity = a;
    l1.style.transform = `translateX(${f1((1 - a) * -300)}px)`;
    l1.style.letterSpacing = `${f1(22 + (1 - a) * 40)}px`;
    const b = span(lt, 0.25, 0.7);
    l2.style.opacity = clamp(b * 3);
    l2.style.transform = `scale(${(lerp(2.4, 1, easeBack(b))).toFixed(3)}) skewX(-6deg)`;
    const c = easeOut(span(lt, 0.85, 1.25));
    l3.style.clipPath = `inset(0 ${f1((1 - c) * 100)}% 0 0)`;
    l4.style.opacity = easeOut(span(lt, 1.2, 1.7));
    $('header').style.opacity = 0;
    tabsEl.style.opacity = easeOut(span(lt, seg.dur - 0.5, seg.dur));
  }

  function buildIr(seg) {
    const L = layerSet();
    drawField(L.fields, null, '#241773');
    drawFormation(L.formation, { noDefense: true });
    svg('rect', { x: BOX.x, y: BOX.y, width: BOX.w, height: BOX.h, fill: '#07061a', opacity: 0.55 }, L.fx);
    overlay.innerHTML = `<div class="ov-card ov-ir"><div class="box">
        <div class="t1">${seg.g.title}</div>
        <div class="t2">${seg.g.headline}</div>
        <div class="t3">${seg.g.lines.join('<br>')}</div>
      </div></div>`;
    seg.ui = { card: overlay.firstElementChild, panel: buildIrPanel(seg.g) };
    seg.ui.card.style.left = `${BOX.x + BOX.w / 2}px`;
    seg.ui.card.style.top = `${BOX.y + BOX.h / 2}px`;
  }
  function updateIr(seg, lt) {
    const u = easeBack(span(lt, 0.15, 0.55));
    seg.ui.card.style.transform = `translate(-50%,-50%) scale(${(0.6 + 0.4 * u).toFixed(3)})`;
    seg.ui.card.style.opacity = clamp(span(lt, 0.15, 0.35));
    seg.ui.panel.rows.forEach((row, i) => {
      const v = easeOut(span(lt, 0.6 + i * 0.25, 1.0 + i * 0.25));
      row.style.opacity = v;
      row.style.transform = `translateX(${f1((1 - v) * 40)}px)`;
    });
  }

  function buildSeason(seg) {
    const L = layerSet();
    drawField(L.fields, null, '#241773');
    drawFormation(L.formation, { noDefense: true });
    const lanes = ['L', 'R'].map((side) => {
      const ic = makeLaneIcon(L.actors);
      const q = P((side === 'L' ? -1 : 1) * LANE_X, 0);
      return { ic, q };
    });
    seg.ui = {
      routes: seasonRoutes(L), lanes,
      panel: buildSeasonPanel(),
      title: fieldTitle(`${DATA.season} SEASON TREE`, 'ALL TARGETS · WEEKS 1, 6 & 7'),
    };
  }
  function updateSeason(seg, lt) {
    const ui = seg.ui;
    ui.routes.forEach((tg, i) => setRoute(tg, easeInOut(span(lt, 0.4 + i * 0.16, 1.3 + i * 0.16)), 1));
    ui.lanes.forEach(({ ic, q }) => placeLane(ic, q.x, q.y, q.k, 1 + 0.06 * Math.sin(lt * 6), easeOut(span(lt, 0.1, 0.4))));
    ui.title.setAttribute('opacity', easeOut(span(lt, 0.3, 0.7)));
    ui.panel.fills.forEach((f, i) => {
      const u = easeOut(span(lt, 0.8 + i * 0.1, 1.4 + i * 0.1));
      f.style.height = `${f1(Number(f.dataset.h) * u)}px`;
      f.previousElementSibling.style.opacity = u;
    });
  }

  const BUILD = { intro: buildIntro, game: buildGame, ir: buildIr, season: buildSeason };
  const UPDATE = { intro: updateIntro, game: updateGame, ir: updateIr, season: updateSeason };

  // ---------- render ----------
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
      BUILD[seg.kind](seg);
      current = seg;
    }
    UPDATE[seg.kind](seg, lt);
    if (seg.kind !== 'intro') {
      $('header').style.opacity = 1;
      tabsEl.style.opacity = 1;
    }
    // segment cross-fade
    const isLast = seg === SEGS[SEGS.length - 1];
    const fade = Math.min(easeOut(span(lt, 0, 0.35)), isLast ? 1 : 1 - span(lt, seg.dur - 0.3, seg.dur));
    world.setAttribute('opacity', fade.toFixed(3));
    labels.setAttribute('opacity', fade.toFixed(3));
    screen.setAttribute('opacity', fade.toFixed(3));
    if (seg.kind !== 'intro') overlay.style.opacity = fade;
    else overlay.style.opacity = 1;
    const pIn = easeOut(span(lt, 0, 0.45));
    panel.style.opacity = seg.kind === 'intro' ? 0 : fade;
    panel.style.transform = `translateX(${f1((1 - pIn) * 60)}px)`;
    // tabs
    TABS.forEach((tb) => {
      const on = tb.id === seg.tab;
      tb.el.classList.toggle('active', on);
      tb.prog.style.width = on ? `${f1((lt / seg.dur) * 100)}%` : '0%';
    });
    bgSweep.style.transform = `translateX(${f1(((t * 140) % 3200) - 800)}px) rotate(18deg)`;
    if (scrub && !scrubbing) scrub.value = Math.round((t / DURATION) * 1000);
  }

  // ---------- stage scaling ----------
  const stage = $('stage');
  function fitStage() {
    const s = RECORD ? 1 : Math.min(innerWidth / STAGE.w, innerHeight / STAGE.h);
    stage.style.transform = `scale(${s})`;
  }
  addEventListener('resize', fitStage);
  fitStage();

  // ---------- playback ----------
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

  // hooks for tools/record.mjs
  window.__duration = DURATION;
  window.__seek = (t) => { time = t; render(t); };
  window.__segments = SEGS.map((s) => ({ kind: s.kind, tab: s.tab, start: s.start, dur: s.dur }));

  setPlaying(playing);
  document.fonts.ready.then(() => {
    render(time);
    window.__ready = true;
    requestAnimationFrame(tick);
  });
})();
