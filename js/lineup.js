/*
 * Lineup coverage check: each starting pass catcher's route profile run
 * against the shells his opponent plays, weighted by how often it plays them.
 * Data: js/lineup-data.js (players, defenses) + js/coverages.js (shells).
 */
(() => {
  'use strict';

  const D = window.LINEUP_DATA;
  const COV = window.COVERAGES;
  const LANE = window.LANE_DATA;
  const {
    clamp, span, easeInOut, easeOut, easeBack, f1, svg, $, BOX, P, makeRoute, pointAt,
    overlay, panel, labels, drawField, drawFormation, makeLaneIcon, placeLane, makeChip,
    routeLine, setRoute, layerSet, fieldTitle, banner, slideBanner,
  } = RT;
  const { GRADE, blendGrade, buildZones, setZones, buildDefense, setDefense, holeMark, setHole } = MK;

  const LOS_G = 65;
  const QUICK = ['HITCH', 'SLANT', 'DRAG', 'FLAT'];
  const SLOW = ['DIG', 'COMEBACK', 'GO', 'POST', 'CORNER', 'FADE', 'SEAM'];

  // ---------- profiles ----------
  function chartedProfile() {
    const ts = LANE.games.filter((g) => !g.ir).flatMap((g) => g.targets.filter((t) => t.result !== 'noplay'));
    const by = {};
    ts.forEach((t) => { (by[t.route] = by[t.route] || []).push(t.depth); });
    return {
      label: 'CHARTED TARGETS', x: 19.5, side: 'L',
      routes: Object.entries(by).map(([r, ds]) => [r, (100 * ds.length) / ts.length, ds.reduce((a, b) => a + b, 0) / ds.length]),
    };
  }
  const profileOf = (p) => (p.role === 'charted' ? chartedProfile() : D.roles[p.role]);

  // ---------- grading ----------
  // Blended grade of one route vs. a shell mix: shell grades weighted by share,
  // nudged toward quick routes (and away from slow ones) by blitz rate.
  function gradeRoute(route, mix, blitz) {
    const shells = Object.entries(mix);
    const share = shells.reduce((a, [, pct]) => a + pct, 0);
    let s = shells.reduce((a, [k, pct]) => a + GRADE[(COV[k].grades[route] || ['mid'])[0]].score * pct, 0) / share;
    const press = blitz ? clamp((blitz - 25) / 45) * 0.3 : 0;
    if (QUICK.includes(route)) s += press;
    if (SLOW.includes(route)) s -= press;
    return clamp(s, -1, 1);
  }
  // Matchup score = profile vs. this defense, minus the same profile vs. the
  // league-typical mix, plus the reported pass-defense quality shift.
  function evaluate(p) {
    const def = D.defenses[p.opp];
    const prof = profileOf(p);
    const total = prof.routes.reduce((a, r) => a + r[1], 0);
    const routes = prof.routes.map(([route, pct, depth]) => {
      const s = gradeRoute(route, def.mix, def.blitz);
      return { route, pct: (100 * pct) / total, depth, score: s, grade: blendGrade(s), base: gradeRoute(route, D.baseline) };
    });
    const vsDef = routes.reduce((a, r) => a + (r.score * r.pct) / 100, 0);
    const vsBase = routes.reduce((a, r) => a + (r.base * r.pct) / 100, 0);
    const score = vsDef - vsBase + (D.qualityShift[def.quality] || 0);
    const topShell = Object.entries(def.mix).sort((a, b) => b[1] - a[1])[0][0];
    return { def, prof, routes, score, vsDef, vsBase, topShell };
  }
  // Relative scores are small; ±0.3 fills the meter.
  const meterPos = (s) => clamp(s / 0.3, -1, 1);
  const relLabel = (s) => (s >= 0.12 ? 'FAVORABLE' : s >= 0.04 ? 'SLIGHT EDGE' : s > -0.04 ? 'NEUTRAL' : s > -0.12 ? 'SLIGHT DISADVANTAGE' : 'TOUGH');
  const relColor = (s) => (s >= 0.04 ? GRADE.win.color : s > -0.04 ? GRADE.mid.color : GRADE.tough.color);
  const EVALS = D.players.map((p) => Object.assign({ p }, evaluate(p)));

  // ---------- field ----------
  function playerField(L, ev) {
    drawField(L.fields, LOS_G, ev.def.colors[0]);
    const alignX = (ev.prof.side === 'L' ? -1 : 1) * ev.prof.x;
    const form = drawFormation(L.formation, { noDefense: true, skipX: alignX });
    const zoneLayer = svg('g', null, L.formation);
    const trailLayer = svg('g', null, L.formation);
    // hide the generic icon where our player lines up
    if (ev.prof.x > 15) form.wide[ev.prof.side].setAttribute('opacity', 0);
    const icon = makeLaneIcon(L.actors, ev.p.icon);
    const align = P(alignX, 0);
    return { zoneLayer, trailLayer, icon, align };
  }
  function buildRoutes(layer, ev) {
    return ev.routes.map((r) => {
      const route = makeRoute({ route: r.route, side: ev.prof.side, x: ev.prof.x, depth: Math.round(r.depth * 2) / 2 });
      const line = routeLine(layer, route, { color: GRADE[r.grade].color, dashed: r.grade === 'tough' });
      return Object.assign(line, { info: r });
    });
  }

  // ---------- panels ----------
  const pct = (v) => `${Math.round(v)}%`;
  function buildPlayerPanel(ev) {
    const { p, def } = ev;
    const shells = Object.entries(def.mix).sort((a, b) => b[1] - a[1]);
    const other = 100 - shells.reduce((a, [, v]) => a + v, 0);
    const reasonShell = COV[ev.topShell];
    panel.innerHTML = `
      <div class="p-week"><span class="wk" style="background:${def.colors[0]};color:#fff;box-shadow:inset 0 -4px 0 ${def.colors[1]}">vs ${p.opp}</span><span class="opp">${p.short}</span></div>
      <div class="p-meta"><span>${p.team} ${p.pos}</span><span>·</span><span>${ev.prof.label}</span><span>·</span><span>${p.kick}</span></div>
      <div class="p-leagues">${p.leagues.map((l) => `<span>${l}</span>`).join('')}</div>
      <div class="mix tight">${shells.map(([k, v]) => `
        <div class="mix-row"><div class="lbl">${COV[k].name}</div>
          <div class="track"><div class="fill ${k === 'c4' ? 'c4' : ''}" data-w="${v}"></div></div>
          <div class="pct">${pct(v)}</div></div>`).join('')}
        ${other > 0.5 ? `<div class="mix-row other-row"><div class="lbl">OTHER</div><div class="track"><div class="fill other" data-w="${other}"></div></div><div class="pct">${pct(other)}</div></div>` : ''}
        <div class="conf">${def.name} D · DATA CONFIDENCE <b class="c-${def.confidence}">${def.confidence}</b>${def.blitz ? ` · BLITZ ${def.blitz}%` : ''}</div>
      </div>
      <div class="p-list compact single">${ev.routes.map((r) => `
        <div class="row"><div class="n">${pct(r.pct)}</div><div class="rt">${r.route}</div>
          <div class="pbp">${reasonShell.name.replace('COVER ', 'C')}: ${(reasonShell.grades[r.route] || ['', ''])[1]}</div>
          <div class="badge g-${r.grade}">${GRADE[r.grade].label}</div></div>`).join('')}</div>
      <div class="meter small"><div class="meter-bar"><div class="meter-mark"></div></div>
        <div class="meter-label" style="color:${relColor(ev.score)}">${relLabel(ev.score)}</div></div>
      <div class="p-note small"><b>${def.name}</b>${def.note}</div>`;
    return {
      fills: [...panel.querySelectorAll('.mix .fill')],
      rows: [...panel.querySelectorAll('.row')],
      mark: panel.querySelector('.meter-mark'),
      label: panel.querySelector('.meter-label'),
    };
  }

  // ---------- header / footer ----------
  $('hdr-num').textContent = D.week;
  $('hdr-first').textContent = `WEEK ${D.week} · ${D.date}`;
  $('hdr-last').textContent = 'MY LINEUP';
  $('footer').innerHTML =
    `<span>Score: route profile vs. this defense's coverage mix, relative to a league-typical mix. Profiles are role templates unless CHARTED.</span>` +
    `<span>Sources: Sharp Football, ESPN, StatRankings, team beat sites · Unofficial fan graphic</span>`;

  // ---------- segments ----------
  const T = { intro: 3.6, player: 12.5, snap: 2.3, routesAt: 4.4, routeGap: 0.42, board: 11 };

  function buildIntro(seg) {
    const L = layerSet();
    const ev = EVALS[0];
    const f = playerField(L, ev);
    seg.ui = { zones: buildZones(f.zoneLayer, COV.c3), defs: buildDefense(f.trailLayer, L.actors, COV.c3, ['#3a3a5a', '#9c98c4']) };
    f.icon.setAttribute('opacity', 0);
    overlay.innerHTML = `<div class="ov-card ov-intro ov-matchup">
        <div class="l1" style="font-size:34px;letter-spacing:8px;white-space:nowrap">WEEK ${D.week} · ${EVALS.length} PASS CATCHERS</div>
        <div class="l2">MY LINEUP</div>
        <div class="l3">vs THEIR COVERAGE</div>
        <div class="l4">${[...new Set(D.players.flatMap((p) => p.leagues.map((l) => l.replace(' BENCH', ''))))].join(' · ')}</div>
      </div>`;
    seg.ui.card = overlay.firstElementChild;
    seg.ui.lines = [...seg.ui.card.children];
  }
  function updateIntro(seg, lt) {
    const ui = seg.ui;
    setDefense(ui.defs, easeInOut(span(lt, 0.8, 1.9)), 0.45);
    setZones(ui.zones, span(lt, 1.2, 2.4) * 0.5);
    const [l1, l2, l3, l4] = ui.lines;
    const out = easeInOut(span(lt, seg.dur - 0.6, seg.dur));
    ui.card.style.transform = `translate(-50%,-50%) scale(${f1(1 + out * 0.15)})`;
    ui.card.style.opacity = 1 - out;
    const a = easeOut(span(lt, 0.05, 0.55));
    l1.style.opacity = a;
    const b = span(lt, 0.25, 0.7);
    l2.style.opacity = clamp(b * 3);
    l2.style.transform = `scale(${(2.4 - 1.4 * easeBack(b)).toFixed(3)}) skewX(-6deg)`;
    l3.style.clipPath = `inset(0 ${f1((1 - easeOut(span(lt, 0.85, 1.25))) * 100)}% 0 0)`;
    l4.style.opacity = easeOut(span(lt, 1.2, 1.7));
    $('header').style.opacity = 0;
    $('tabs').style.opacity = easeOut(span(lt, seg.dur - 0.5, seg.dur));
  }

  function buildPlayer(seg) {
    const ev = seg.ev;
    const shell = COV[ev.topShell];
    const L = layerSet();
    const f = playerField(L, ev);
    seg.ui = {
      f,
      zones: buildZones(f.zoneLayer, shell),
      defs: buildDefense(f.trailLayer, L.actors, shell, ev.def.colors),
      holes: shell.holes.map((h, i) => holeMark(L.fx, h.at, h.label, i + 2)),
      routes: buildRoutes(L.routes, ev),
      panel: buildPlayerPanel(ev),
      banner: banner(ev.p.short, `vs ${ev.def.name} D`, `${ev.p.team} ${ev.p.pos} · ${ev.p.kick} · ${ev.p.leagues.join(' · ')}`, ev.def.colors[0]),
      title: fieldTitle(`${shell.name} · THEIR TOP SHELL`, `ROUTES GRADED vs THE FULL ${ev.def.name} MIX`),
    };
    L.actors.appendChild(f.icon);
  }
  function updatePlayer(seg, lt) {
    const ui = seg.ui, ev = seg.ev;
    slideBanner(ui.banner, lt, 1.2);
    setDefense(ui.defs, easeInOut(span(lt, T.snap, T.snap + 1)), easeOut(span(lt, 1.1, 1.5)));
    setZones(ui.zones, span(lt, T.snap + 0.3, T.snap + 1.3));
    ui.holes.forEach((h, i) => setHole(h, easeOut(span(lt, 3.4 + i * 0.35, 3.9 + i * 0.35)), lt < T.routesAt ? 1 : 0.5));
    ui.routes.forEach((rt, i) => setRoute(rt, easeInOut(span(lt, T.routesAt + i * T.routeGap, T.routesAt + i * T.routeGap + 0.6)), 1));
    const a = ui.f.align;
    placeLane(ui.f.icon, a.x, a.y, a.k, 1 + 0.05 * Math.sin(lt * 6), easeOut(span(lt, 1.0, 1.4)));
    const done = T.routesAt + ui.routes.length * T.routeGap + 0.6;
    ui.title.setAttribute('opacity', easeOut(span(lt, done, done + 0.4)));
    ui.panel.fills.forEach((fl, i) => { fl.style.width = `${f1(fl.dataset.w * easeOut(span(lt, 0.6 + i * 0.15, 1.3 + i * 0.15)))}%`; });
    ui.panel.rows.forEach((row, i) => {
      const u = easeOut(span(lt, T.routesAt + i * T.routeGap, T.routesAt + i * T.routeGap + 0.35));
      row.style.opacity = u;
      row.style.transform = `translateX(${f1((1 - u) * 40)}px)`;
    });
    const m = easeInOut(span(lt, done, done + 1.2));
    ui.panel.mark.style.left = `${f1(50 + 50 * meterPos(ev.score) * m)}%`;
    const lu = easeBack(span(lt, done + 1.2, done + 1.6));
    ui.panel.label.style.opacity = clamp(lu);
    ui.panel.label.style.transform = `scale(${(0.6 + 0.4 * lu).toFixed(3)})`;
  }

  const evalById = (id) => EVALS.find((ev) => ev.p.id === id);
  const signed = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
  function callText(c) {
    const a = evalById(c.a), b = evalById(c.b);
    if (c.type === 'compare') {
      const lean = a.score >= b.score ? a : b;
      return `${c.league}: ${a.p.short} ${relLabel(a.score)} (${signed(a.score)}) vs ${b.p.short} ${relLabel(b.score)} (${signed(b.score)}). Coverage leans ${lean.p.short}${c.note ? `; ${c.note}` : ''}.`;
    }
    return `${c.league}: if ${a.p.short} is inactive, ${b.p.short} grades ${relLabel(b.score)} (${signed(b.score)}) vs ${b.p.opp}.`;
  }

  function buildBoard(seg) {
    const L = layerSet();
    drawField(L.fields, null, '#241773');
    svg('rect', { x: BOX.x, y: BOX.y, width: BOX.w, height: BOX.h, fill: '#07061a', opacity: 0.72 }, L.fx);
    const sorted = [...EVALS].sort((a, b) => b.score - a.score);
    overlay.innerHTML = `<div class="board" style="left:${BOX.x + 24}px;top:${BOX.y + 20}px;width:${BOX.w - 48}px">
      <div class="board-h"><span>PLAYER</span><span>MATCHUP</span><span></span><span>vs D · TOP SHELL</span><span>KICK</span></div>
      ${sorted.map((ev) => `
        <div class="board-row">
          <div class="who"><b>${ev.p.short}</b><span>${ev.p.team} ${ev.p.pos}</span></div>
          <div class="bar"><div class="mid"></div><div class="val" style="background:${relColor(ev.score)}" data-s="${ev.score}"></div></div>
          <div class="lab" style="color:${relColor(ev.score)}">${relLabel(ev.score)}</div>
          <div class="vs">${ev.p.opp} · ${COV[ev.topShell].name} <i class="c-${ev.def.confidence}">${ev.def.confidence}</i></div>
          <div class="kick">${ev.p.kick}</div>
        </div>`).join('')}
    </div>`;
    panel.innerHTML = `
      <div class="p-week"><span class="wk">WEEK ${D.week}</span><span class="opp">LINEUP BOARD</span></div>
      <div class="p-meta"><span>SORTED BY COVERAGE MATCHUP</span></div>
      <ul class="bullets">${D.calls.map((c) => `<li class="good"><span class="ic">➜</span><span>${callText(c)}</span></li>`).join('')}</ul>
      <div class="p-note small"><b>HOW TO READ IT</b>This grades coverage fit only. Volume, QB play and injuries still decide the week; check inactives 90 minutes before kickoff.</div>`;
    seg.ui = {
      rows: [...overlay.querySelectorAll('.board-row')],
      vals: [...overlay.querySelectorAll('.board-row .val')],
      bullets: [...panel.querySelectorAll('.bullets li')],
      title: fieldTitle('LINEUP BOARD', `WEEK ${D.week} · ${D.date}`),
    };
    seg.ui.title.setAttribute('opacity', 0);
  }
  function updateBoard(seg, lt) {
    const ui = seg.ui;
    ui.rows.forEach((row, i) => {
      const u = easeOut(span(lt, 0.3 + i * 0.12, 0.7 + i * 0.12));
      row.style.opacity = u;
      row.style.transform = `translateX(${f1((1 - u) * -40)}px)`;
      const v = ui.vals[i];
      const s = meterPos(Number(v.dataset.s)) * easeInOut(span(lt, 0.6 + i * 0.12, 1.4 + i * 0.12));
      v.style.left = s >= 0 ? '50%' : `${f1(50 + 50 * s)}%`;
      v.style.width = `${f1(Math.abs(50 * s))}%`;
    });
    ui.bullets.forEach((b, i) => { b.style.opacity = easeOut(span(lt, 1.5 + i * 0.4, 1.9 + i * 0.4)); });
  }

  if (EVALS.length > 7) $('tabs').classList.add('many');
  RT.run({
    segments: [
      { kind: 'intro', tab: null, dur: T.intro, intro: true, build: buildIntro, update: updateIntro },
      ...EVALS.map((ev) => ({ kind: 'player', ev, tab: ev.p.id, dur: T.player, build: buildPlayer, update: updatePlayer })),
      { kind: 'board', tab: 'board', dur: T.board, build: buildBoard, update: updateBoard },
    ],
    tabs: [...EVALS.map((ev) => ({ id: ev.p.id, label: ev.p.short })), { id: 'board', label: 'BOARD' }],
  });

  // for tools and quick checks: node-free summary in the console
  window.__lineup = EVALS.map((ev) => ({ player: ev.p.short, opp: ev.p.opp, score: +ev.score.toFixed(3), vsDef: +ev.vsDef.toFixed(2), vsBase: +ev.vsBase.toFixed(2), label: relLabel(ev.score) }));
})();
