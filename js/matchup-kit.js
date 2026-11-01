/*
 * Shared pieces for coverage-matchup pages (bills.js, lineup.js): route
 * grades, zone bubbles, defenders that move from pre-snap spots to their
 * landmarks, and telestrator circles on the soft spots.
 */
window.MK = (() => {
  'use strict';

  const { clamp, lerp, easeOut, easeBack, f1, svg, text, BOX, P, K0, poly, labels, scribblePath, makeChip } = RT;

  const GRADE = {
    win: { color: '#3ef08a', label: 'WIN', score: 1 },
    mid: { color: '#ffc72c', label: 'CONTESTED', score: 0 },
    tough: { color: '#ff3b5c', label: 'TOUGH', score: -1 },
  };
  const ZONE_COLORS = { deep: '#3f7bff', hook: '#a46bff', flat: '#39c6ff' };
  const blendGrade = (s) => (s >= 0.5 ? 'win' : s <= -0.5 ? 'tough' : 'mid');
  const meterLabel = (s) => (s >= 0.25 ? 'FAVORABLE' : s >= 0.05 ? 'SLIGHT EDGE' : s > -0.05 ? 'NEUTRAL' : s > -0.25 ? 'SLIGHT DISADVANTAGE' : 'TOUGH');
  const meterColor = (s) => (s >= 0.05 ? GRADE.win.color : s > -0.05 ? GRADE.mid.color : GRADE.tough.color);

  function ellipsePoints(c, r, n = 44) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([c[0] + Math.cos(a) * r[0], c[1] + Math.sin(a) * r[1]]);
    }
    return pts;
  }
  function buildZones(parent, cov) {
    return cov.zones.map((z) => {
      const color = ZONE_COLORS[z.type];
      const g = svg('g', { opacity: 0 }, parent);
      svg('polygon', { points: poly(ellipsePoints(z.c, z.r)), fill: color, 'fill-opacity': 0.2, stroke: color, 'stroke-width': 2.5, 'stroke-dasharray': '9 6' }, g);
      const q = P(z.c[0], z.c[1]);
      const lq = P(z.c[0], z.c[1] - z.r[1] * 0.62); // label sits below the defender's landmark
      text(g, z.label, { x: f1(lq.x), y: f1(lq.y), 'font-size': f1(Math.max(13, lq.k * 0.8)), 'font-weight': 600, fill: '#fff', opacity: 0.85, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'letter-spacing': 1.5 });
      return { g, q };
    });
  }
  function setZones(zones, u) {
    zones.forEach(({ g, q }, i) => {
      const v = easeBack(clamp(u * 1.6 - i * 0.08));
      g.setAttribute('opacity', clamp(v).toFixed(3));
      g.setAttribute('transform', `translate(${f1(q.x)},${f1(q.y)}) scale(${(0.2 + 0.8 * v).toFixed(3)}) translate(${f1(-q.x)},${f1(-q.y)})`);
    });
  }

  function defenderIcon(parent, pos, [fill, stroke]) {
    const g = svg('g', { opacity: 0 }, parent);
    svg('ellipse', { rx: 19, ry: 16, cy: 3, fill: '#000', opacity: 0.3 }, g);
    svg('circle', { r: 17, fill, stroke, 'stroke-width': 3 }, g);
    text(g, pos, { y: 1, 'font-size': pos.length > 2 ? 11 : 13, 'font-weight': 700, fill: '#fff', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    return g;
  }
  function placeAt(g, X, D, opacity = 1) {
    const q = P(X, D);
    g.setAttribute('transform', `translate(${f1(q.x)},${f1(q.y)}) scale(${(q.k / K0).toFixed(3)})`);
    g.setAttribute('opacity', opacity.toFixed(3));
  }
  function buildDefense(trailLayer, iconLayer, cov, colors) {
    return cov.defenders.map((d) => {
      const a = P(d.pre[0], d.pre[1]), b = P(d.post[0], d.post[1]);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const trail = svg('path', { d: `M${f1(a.x)} ${f1(a.y)} L${f1(b.x)} ${f1(b.y)}`, fill: 'none', stroke: d.rush ? colors[1] : '#dfe7ff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0 }, trailLayer);
      return { d, len, trail, icon: defenderIcon(iconLayer, d.pos, colors) };
    });
  }
  function setDefense(defs, u, show = 1) {
    defs.forEach((o) => {
      placeAt(o.icon, lerp(o.d.pre[0], o.d.post[0], u), lerp(o.d.pre[1], o.d.post[1], u), show);
      o.trail.setAttribute('stroke-dasharray', `${f1(o.len * u)} ${f1(o.len + 10)}`);
      o.trail.setAttribute('opacity', u > 0 ? (0.55 * show).toFixed(3) : 0);
    });
  }

  function holeMark(parent, at, label, seed, size = [50, 32]) {
    const q = P(at[0], at[1]);
    const sc = scribblePath(q.x, q.y, (size[0] * q.k) / K0, (size[1] * q.k) / K0, seed);
    const path = svg('path', { d: sc.d, fill: 'none', stroke: '#ffe600', 'stroke-width': 5, 'stroke-linecap': 'round', filter: 'url(#glow)', opacity: 0 }, parent);
    const chip = makeChip(labels, label, '#ffe600');
    chip.setAttribute('transform', `translate(${f1(clamp(q.x, BOX.x + 110, BOX.x + BOX.w - 110))},${f1(q.y - ((size[1] + 16) * q.k) / K0)})`);
    return { path, L: sc.L, chip };
  }
  function setHole(h, u, opacity = 1) {
    h.path.setAttribute('opacity', u > 0 ? opacity : 0);
    h.path.setAttribute('stroke-dasharray', `${f1(h.L * u)} ${f1(h.L + 10)}`);
    h.chip.setAttribute('opacity', (easeOut(clamp((u - 0.4) * 2)) * opacity).toFixed(3));
  }

  return {
    GRADE, ZONE_COLORS, blendGrade, meterLabel, meterColor,
    ellipsePoints, buildZones, setZones, defenderIcon, placeAt, buildDefense, setDefense, holeMark, setHole,
  };
})();
