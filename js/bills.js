/*
 * Week 8 matchup: the Bills' two main zone shells (Cover 3, Cover 4) modeled
 * on the field, with Ja'Kobi Lane's route tree graded against each.
 * Rendering primitives and playback live in engine.js.
 */
(() => {
  'use strict';

  const LANE = window.LANE_DATA;
  const BILLS = window.BILLS_DATA;
  const {
    VERTICAL, clamp, lerp, span, easeInOut, easeOut, easeBack, f1, svg, text, $,
    BOX, P, K0, LANE_X, poly, makeRoute, pointAt, overlay, panel, labels,
    drawField, drawFormation, makeLaneIcon, placeLane, scribblePath, makeChip,
    routeLine, setRoute, layerSet, fieldTitle, banner, slideBanner,
  } = RT;

  const BUF_BLUE = '#00338D';
  const BUF_RED = '#C60C30';
  const GRADE = {
    win: { color: '#3ef08a', label: 'WIN', score: 1 },
    mid: { color: '#ffc72c', label: 'CONTESTED', score: 0 },
    tough: { color: '#ff3b5c', label: 'TOUGH', score: -1 },
  };
  const ZONE_COLORS = { deep: '#3f7bff', hook: '#a46bff', flat: '#39c6ff' };
  const LOS_G = 60; // model every snap from Baltimore's own 40

  // ---------- Lane's route tree, grouped by route type ----------
  const TARGETS = LANE.games.filter((g) => !g.ir).flatMap((g) => g.targets.filter((t) => t.result !== 'noplay'));
  const TOTAL = TARGETS.length;
  const ROUTE_ORDER = ['HITCH', 'SLANT', 'CURL', 'COMEBACK', 'OUT', 'DIG', 'POST', 'CORNER', 'GO', 'FADE'];
  const DEEP_ROUTES = ['GO', 'FADE', 'POST', 'CORNER'];
  const TREE = ROUTE_ORDER.map((route) => {
    const ts = TARGETS.filter((t) => t.route === route);
    if (!ts.length) return null;
    const catches = ts.filter((t) => t.result === 'catch');
    return {
      route, n: ts.length, rec: catches.length,
      yds: catches.reduce((a, t) => a + t.yards, 0),
      depth: ts.reduce((a, t) => a + t.depth, 0) / ts.length,
    };
  }).filter(Boolean);

  // ---------- grading ----------
  const COVS = BILLS.coverages;
  const SHARE = COVS.reduce((a, c) => a + c.pct, 0);
  const gradeOf = (cov, route) => (cov.grades[route] || ['mid', ''])[0];
  const blendedScore = (route) => COVS.reduce((a, c) => a + GRADE[gradeOf(c, route)].score * c.pct, 0) / SHARE;
  const blendGrade = (s) => (s >= 0.5 ? 'win' : s <= -0.5 ? 'tough' : 'mid');
  function tally(cov) {
    const out = { win: 0, mid: 0, tough: 0 };
    TREE.forEach((r) => { out[gradeOf(cov, r.route)] += r.n; });
    return out;
  }
  const MATCHUP = TREE.reduce((a, r) => a + blendedScore(r.route) * r.n, 0) / TOTAL; // -1 … +1
  const meterLabel = (s) => (s >= 0.25 ? 'FAVORABLE' : s >= 0.05 ? 'SLIGHT EDGE' : s > -0.05 ? 'NEUTRAL' : s > -0.25 ? 'SLIGHT DISADVANTAGE' : 'TOUGH');

  function verdictPoints() {
    const catches = TARGETS.filter((t) => t.result === 'catch');
    const yds = catches.map((t) => t.yards);
    const deep = TARGETS.filter((t) => DEEP_ROUTES.includes(t.route));
    const deepRec = deep.filter((t) => t.result === 'catch').length;
    const deepNames = [...new Set(deep.map((t) => t.route))].join(', ');
    return BILLS.verdict.points.map((p) => {
      if (p.text === 'CATCH_DEPTH') {
        return { good: true, text: `All ${catches.length} of his NFL catches have gained ${Math.min(...yds)}–${Math.max(...yds)} yards: the cushion Cover 3 and Cover 4 corners give up when they bail.` };
      }
      if (p.text === 'DEEP_SHOTS') {
        return { good: false, text: `Deep shots (${deepNames}) attack the strength of both shells: he is ${deepRec}-for-${deep.length} on them so far.` };
      }
      return p;
    });
  }

  // ---------- field pieces ----------
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

  function defenderIcon(parent, pos) {
    const g = svg('g', { opacity: 0 }, parent);
    svg('ellipse', { rx: 19, ry: 16, cy: 3, fill: '#000', opacity: 0.3 }, g);
    svg('circle', { r: 17, fill: BUF_BLUE, stroke: BUF_RED, 'stroke-width': 3 }, g);
    text(g, pos, { y: 1, 'font-size': pos.length > 2 ? 11 : 13, 'font-weight': 700, fill: '#fff', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    return g;
  }
  function placeAt(g, X, D, opacity = 1) {
    const q = P(X, D);
    g.setAttribute('transform', `translate(${f1(q.x)},${f1(q.y)}) scale(${(q.k / K0).toFixed(3)})`);
    g.setAttribute('opacity', opacity.toFixed(3));
  }
  function buildDefense(trailLayer, iconLayer, cov) {
    return cov.defenders.map((d) => {
      const a = P(d.pre[0], d.pre[1]), b = P(d.post[0], d.post[1]);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const trail = svg('path', { d: `M${f1(a.x)} ${f1(a.y)} L${f1(b.x)} ${f1(b.y)}`, fill: 'none', stroke: d.rush ? BUF_RED : '#dfe7ff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0 }, trailLayer);
      return { d, len, trail, icon: defenderIcon(iconLayer, d.pos) };
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

  // Lane's tree from the boundary (offense's left), one route per type.
  function buildTree(layer, colorOf) {
    return TREE.map((r) => {
      const route = makeRoute({ route: r.route, side: 'L', depth: Math.round(r.depth * 2) / 2 });
      const grade = colorOf(r.route);
      const line = routeLine(layer, route, { color: GRADE[grade].color, dashed: grade === 'tough' });
      const chip = makeChip(labels, `${r.route} ×${r.n} · ${GRADE[grade].label}`, GRADE[grade].color);
      const lead = pointAt(route, route.L);
      const cx = route.end.x + Math.cos(lead.ang) * 30;
      const cy = route.end.y - 42;
      chip.setAttribute('transform', `translate(${f1(clamp(cx, BOX.x + 120, BOX.x + BOX.w - 120))},${f1(Math.max(BOX.y + 24, cy))})`);
      return Object.assign(line, { tree: r, grade, chip });
    });
  }

  function baseField(L, opts = {}) {
    drawField(L.fields, LOS_G, BUF_BLUE);
    const form = drawFormation(L.formation, { noDefense: true });
    form.wide.L.setAttribute('opacity', 0); // Lane's spot
    const zoneLayer = svg('g', null, L.formation);
    const trailLayer = svg('g', null, L.formation);
    const lane = makeLaneIcon(L.actors, LANE.player.number);
    const align = P(-LANE_X, 0);
    placeLane(lane, align.x, align.y, align.k, 1, opts.lane === false ? 0 : 1);
    return { form, zoneLayer, trailLayer, lane, align };
  }

  // ---------- panels ----------
  const statBox = (k, v, cls = '') => `<div class="stat ${cls}"><div class="v">${v}</div><div class="k">${k}</div></div>`;

  function buildDefensePanel() {
    const d = BILLS.defense;
    panel.innerHTML = `
      <div class="p-week"><span class="wk wk-buf">2026</span><span class="opp">BUFFALO DEFENSE</span></div>
      <div class="p-meta"><span>DC ${d.dc}</span><span>·</span><span>${d.dcNote}</span></div>
      <div class="mix">${d.mix.map((m) => `
        <div class="mix-row"><div class="lbl">${m.label}</div>
          <div class="track"><div class="fill ${m.id}" data-w="${m.pct}"></div></div>
          <div class="pct">${m.pct.toFixed(1)}%</div>
          <div class="sub">${m.note}</div></div>`).join('')}
      </div>
      <div class="p-stats four">${d.stats.map((s) => statBox(`${s.k}<br><span class="rk">${s.r}</span>`, s.v)).join('')}</div>
      <div class="blitz">BLITZ RATE <b>${d.blitz.pct}%</b> · ${d.blitz.rank} IN THE NFL</div>
      <div class="p-note"><b>FILM NOTE</b>${d.note}</div>`;
    return { fills: [...panel.querySelectorAll('.mix .fill')] };
  }

  function buildCoveragePanel(cov) {
    const t = tally(cov);
    panel.innerHTML = `
      <div class="p-week"><span class="wk wk-buf">${cov.pct.toFixed(1)}%</span><span class="opp">${cov.name}</span></div>
      <div class="p-meta"><span>${cov.tagline}</span></div>
      <div class="p-stats three">${['win', 'mid', 'tough'].map((g) => statBox(`${GRADE[g].label}`, 0, `g-${g}`)).join('')}</div>
      <div class="p-list compact">${TREE.map((r) => {
        const [g, why] = cov.grades[r.route] || ['mid', ''];
        return `<div class="row"><div class="n">×${r.n}</div>
          <div class="rt">${r.route}<span class="los">${r.rec ? `${r.rec} REC · ${r.yds} YDS` : `0 REC`}</span></div>
          <div class="badge g-${g}">${GRADE[g].label}</div>
          <div class="pbp">${why}</div></div>`;
      }).join('')}</div>
      <div class="p-note small"><b>BILLS FILM</b>${cov.note}</div>`;
    return { rows: [...panel.querySelectorAll('.row')], stats: [...panel.querySelectorAll('.stat .v')], total: t };
  }

  function buildVerdictPanel() {
    const label = meterLabel(MATCHUP);
    const winPct = (cov) => Math.round((100 * tally(cov).win) / TOTAL);
    const deep = TARGETS.filter((t) => DEEP_ROUTES.includes(t.route));
    panel.innerHTML = `
      <div class="p-week"><span class="wk">WEEK ${BILLS.matchup.week}</span><span class="opp">THE VERDICT</span></div>
      <div class="p-meta"><span>LANE vs THE BILLS' ZONE MIX</span><span>·</span><span>${TOTAL} TARGETS GRADED</span></div>
      <div class="meter"><div class="meter-bar"><div class="meter-mark"></div></div>
        <div class="meter-ends"><span>TOUGH</span><span>NEUTRAL</span><span>FAVORABLE</span></div>
        <div class="meter-label">${label}</div></div>
      <div class="s-line three">${[
        [`${winPct(COVS[0])}%`, `WIN ROUTES vs ${COVS[0].name}`],
        [`${winPct(COVS[1])}%`, `WIN ROUTES vs ${COVS[1].name}`],
        [`${deep.filter((t) => t.result === 'catch').length}/${deep.length}`, 'DEEP SHOTS CAUGHT'],
      ].map(([v, k]) => statBox(k, v, 'small')).join('')}</div>
      <ul class="bullets">${verdictPoints().map((p) => `<li class="${p.good ? 'good' : 'bad'}"><span class="ic">${p.good ? '✔' : '✖'}</span><span>${p.text}</span></li>`).join('')}</ul>
      <div class="p-note"><b>CAVEAT</b>${BILLS.verdict.caveat}</div>`;
    return {
      mark: panel.querySelector('.meter-mark'),
      label: panel.querySelector('.meter-label'),
      bullets: [...panel.querySelectorAll('.bullets li')],
    };
  }

  // ---------- header / footer ----------
  $('hdr-num').textContent = LANE.player.number;
  $('hdr-first').textContent = `${LANE.player.first} · ${LANE.player.pos} · ${LANE.player.team}`;
  $('hdr-last').textContent = LANE.player.last;
  $('footer').innerHTML =
    `<span>Coverage mix: Buffalo Rumblings charting, 2026 through Week 7. Grades apply standard coverage rules to Lane's charted routes (route types are reconstructions).</span>` +
    `<span>Sources: ${BILLS.sources.join(', ')} · Unofficial fan graphic</span>`;

  // ---------- segments ----------
  const T = { intro: 3.8, defense: 9.5, snap: 2.6, move: 1.1, holesAt: 4.0, holeGap: 0.45, routesAt: 5.6, route: 1.55, hold: 3.6, verdict: 12 };

  function buildIntro(seg) {
    const L = layerSet();
    const f = baseField(L);
    const cov = COVS[0];
    seg.ui = { zones: buildZones(f.zoneLayer, cov), defs: buildDefense(f.trailLayer, L.actors, cov) };
    overlay.innerHTML = `<div class="ov-card ov-intro ov-matchup">
        <div class="l1">${LANE.player.first} ${LANE.player.last} vs</div>
        <div class="l2">BILLS D</div>
        <div class="l3">WEEK ${BILLS.matchup.week} COVERAGE MODEL</div>
        <div class="l4">RAVENS @ BILLS · ${BILLS.matchup.date}</div>
      </div>`;
    seg.ui.card = overlay.firstElementChild;
    seg.ui.lines = [...seg.ui.card.children];
  }
  function updateIntro(seg, lt) {
    const ui = seg.ui;
    setDefense(ui.defs, easeInOut(span(lt, 0.8, 1.9)), 0.55);
    setZones(ui.zones, span(lt, 1.2, 2.4) * 0.6);
    const [l1, l2, l3, l4] = ui.lines;
    const out = easeInOut(span(lt, seg.dur - 0.6, seg.dur));
    ui.card.style.transform = `translate(-50%,-50%) scale(${f1(1 + out * 0.15)})`;
    ui.card.style.opacity = 1 - out;
    const a = easeOut(span(lt, 0.05, 0.55));
    l1.style.opacity = a;
    l1.style.transform = `translateX(${f1((1 - a) * -300)}px)`;
    const b = span(lt, 0.25, 0.7);
    l2.style.opacity = clamp(b * 3);
    l2.style.transform = `scale(${lerp(2.4, 1, easeBack(b)).toFixed(3)}) skewX(-6deg)`;
    l3.style.clipPath = `inset(0 ${f1((1 - easeOut(span(lt, 0.85, 1.25))) * 100)}% 0 0)`;
    l4.style.opacity = easeOut(span(lt, 1.2, 1.7));
    $('header').style.opacity = 0;
    $('tabs').style.opacity = easeOut(span(lt, seg.dur - 0.5, seg.dur));
  }

  function buildDefenseSeg(seg) {
    const L = layerSet();
    const f = baseField(L);
    const defs = buildDefense(f.trailLayer, L.actors, COVS[0]);
    seg.ui = {
      defs,
      shell: holeMark(L.fx, [0, 13], 'TWO-HIGH LOOK PRE-SNAP', 3, [235, 46]),
      rotate: makeChip(labels, 'ROTATES TO COVER 3 OR COVER 4 AT THE SNAP', '#ffc72c'),
      panel: buildDefensePanel(),
      banner: banner('BILLS D', 'WHAT THEY PLAY', `DC ${BILLS.defense.dc} · 3-4 BASE · ${BILLS.matchup.records}`, BUF_BLUE),
    };
    const q = P(0, 13);
    seg.ui.rotate.setAttribute('transform', `translate(${f1(q.x)},${f1(q.y + 48)})`);
  }
  function updateDefenseSeg(seg, lt) {
    const ui = seg.ui;
    slideBanner(ui.banner, lt);
    ui.defs.forEach((o, i) => placeAt(o.icon, o.d.pre[0], o.d.pre[1], easeOut(span(lt, 1.5 + i * 0.06, 1.8 + i * 0.06))));
    setHole(ui.shell, easeOut(span(lt, 2.8, 3.5)));
    ui.rotate.setAttribute('opacity', easeOut(span(lt, 3.8, 4.2)));
    ui.panel.fills.forEach((f, i) => { f.style.width = `${f1(f.dataset.w * easeOut(span(lt, 0.6 + i * 0.25, 1.4 + i * 0.25)))}%`; });
  }

  function buildCoverage(seg) {
    const cov = seg.cov;
    const L = layerSet();
    const f = baseField(L);
    seg.ui = {
      f,
      zones: buildZones(f.zoneLayer, cov),
      defs: buildDefense(f.trailLayer, L.actors, cov),
      holes: cov.holes.map((h, i) => holeMark(L.fx, h.at, h.label, i + 2)),
      routes: buildTree(L.routes, (route) => gradeOf(cov, route)),
      panel: buildCoveragePanel(cov),
      banner: banner(cov.name, cov.tagline, `${cov.pct.toFixed(1)}% OF BILLS SNAPS IN 2026`, BUF_BLUE),
      title: fieldTitle(`${cov.name} vs LANE'S TREE`, (() => { const t = tally(cov); return `${t.win} WIN · ${t.mid} CONTESTED · ${t.tough} TOUGH  (OF ${TOTAL} TARGETS)`; })()),
    };
    // Lane runs on top of the defenders
    L.actors.appendChild(f.lane);
  }
  function updateCoverage(seg, lt) {
    const ui = seg.ui;
    const n = ui.routes.length;
    slideBanner(ui.banner, lt);
    const preIn = easeOut(span(lt, 1.2, 1.6));
    const move = easeInOut(span(lt, T.snap, T.snap + T.move));
    setDefense(ui.defs, move, preIn);
    setZones(ui.zones, span(lt, T.snap + 0.3, T.snap + T.move + 0.4));
    const routesDone = lt >= T.routesAt + n * T.route;
    ui.holes.forEach((h, i) => setHole(h, easeOut(span(lt, T.holesAt + i * T.holeGap, T.holesAt + i * T.holeGap + 0.5)), lt < T.routesAt ? 1 : 0.55));

    const slot = Math.floor((lt - T.routesAt) / T.route);
    const counts = { win: 0, mid: 0, tough: 0 };
    ui.routes.forEach((rt, i) => {
      const s = lt - (T.routesAt + i * T.route);
      const p = easeInOut(span(s, 0.1, 0.85));
      setRoute(rt, p, i === slot && !routesDone ? 1 : s > 0 ? (routesDone ? 1 : 0.5) : 0);
      rt.chip.setAttribute('opacity', i === slot && !routesDone ? (easeOut(span(s, 0.7, 0.95)) * (1 - span(s, 1.35, 1.55))).toFixed(3) : 0);
      if (s >= 0.85) counts[rt.grade] += rt.tree.n;
    });
    // Lane runs the active route, then resets to his alignment
    const a = ui.f.align;
    if (slot >= 0 && !routesDone) {
      const rt = ui.routes[slot];
      const s = lt - (T.routesAt + slot * T.route);
      const tip = pointAt(rt.r, rt.r.L * easeInOut(span(s, 0.1, 0.85)));
      placeLane(ui.f.lane, tip.x, tip.y, tip.k, 0.7 + 0.3 * easeBack(span(s, 0, 0.15)), 1);
    } else {
      placeLane(ui.f.lane, a.x, a.y, a.k, routesDone ? 1 + 0.06 * Math.sin(lt * 6) : 1, 1);
    }
    ui.title.setAttribute('opacity', routesDone ? easeOut(span(lt, T.routesAt + n * T.route, T.routesAt + n * T.route + 0.4)) : 0);
    // panel
    ui.panel.rows.forEach((row, i) => {
      const u = easeOut(span(lt, 0.5 + i * 0.07, 0.9 + i * 0.07));
      row.style.opacity = u;
      row.style.transform = `translateX(${f1((1 - u) * 40)}px)`;
      row.classList.toggle('active', i === slot && !routesDone);
    });
    ['win', 'mid', 'tough'].forEach((g, i) => {
      const v = ui.panel.stats[i];
      if (v.textContent !== String(counts[g])) v.textContent = counts[g];
    });
  }

  function buildVerdict(seg) {
    const L = layerSet();
    const f = baseField(L);
    const holes = [];
    COVS.forEach((cov) => cov.holes.forEach((h) => holes.push(holeMark(L.fx, h.at, h.label, holes.length + 2))));
    seg.ui = {
      f, holes,
      routes: buildTree(L.routes, (route) => blendGrade(blendedScore(route))),
      panel: buildVerdictPanel(),
      title: fieldTitle('WHERE LANE CAN WIN', `ROUTES GRADED vs THE BILLS' COVER 3 / COVER 4 MIX`),
    };
  }
  function updateVerdict(seg, lt) {
    const ui = seg.ui;
    ui.title.setAttribute('opacity', easeOut(span(lt, 0.2, 0.6)));
    ui.routes.forEach((rt, i) => {
      setRoute(rt, easeInOut(span(lt, 0.5 + i * 0.2, 1.3 + i * 0.2)), 1);
      rt.chip.setAttribute('opacity', 0);
    });
    ui.holes.forEach((h, i) => setHole(h, easeOut(span(lt, 2.4 + i * 0.25, 2.9 + i * 0.25)), 0.85));
    const a = ui.f.align;
    placeLane(ui.f.lane, a.x, a.y, a.k, 1 + 0.06 * Math.sin(lt * 6), 1);
    const m = easeInOut(span(lt, 1.0, 2.6));
    ui.panel.mark.style.left = `${f1(50 + 50 * MATCHUP * m)}%`;
    const lu = easeBack(span(lt, 2.6, 3.0));
    ui.panel.label.style.opacity = clamp(lu);
    ui.panel.label.style.transform = `scale(${(0.6 + 0.4 * lu).toFixed(3)})`;
    ui.panel.bullets.forEach((b, i) => {
      const u = easeOut(span(lt, 3.2 + i * 0.5, 3.6 + i * 0.5));
      b.style.opacity = u;
      b.style.transform = `translateX(${f1((1 - u) * 40)}px)`;
    });
  }

  const covSegs = COVS.map((cov) => ({
    kind: 'coverage', cov, tab: cov.id, dur: T.routesAt + TREE.length * T.route + T.hold, build: buildCoverage, update: updateCoverage,
  }));
  RT.run({
    segments: [
      { kind: 'intro', tab: null, dur: T.intro, intro: true, build: buildIntro, update: updateIntro },
      { kind: 'defense', tab: 'defense', dur: T.defense, build: buildDefenseSeg, update: updateDefenseSeg },
      ...covSegs,
      { kind: 'verdict', tab: 'verdict', dur: T.verdict, build: buildVerdict, update: updateVerdict },
    ],
    tabs: [
      { id: 'defense', label: 'BILLS D' },
      ...COVS.map((c) => ({ id: c.id, label: `${c.name} · ${Math.round(c.pct)}%` })),
      { id: 'verdict', label: 'VERDICT' },
    ],
  });
})();
