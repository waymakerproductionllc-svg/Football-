/*
 * Ja'Kobi Lane 2026 route tree: one segment per game, an IR card and a
 * season overlay. Rendering primitives and playback live in engine.js.
 */
(() => {
  'use strict';

  const DATA = window.LANE_DATA;
  const {
    VERTICAL, clamp, lerp, span, easeInOut, easeOut, easeBack, f1, svg, text, $,
    BOX, P, K0, LANE_X, makeRoute, pointAt, overlay, panel, labels,
    drawField, drawFormation, makeLaneIcon, placeLane, makeBall, placeBall,
    scribblePath, burstPoints, INK, outlined, makeChip, routeLine, setRoute,
    layerSet, fieldTitle, playBug, banner, slideBanner,
  } = RT;

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

  // One target = route + arrow + fx. Built once per segment, updated per frame.
  function buildTarget(t, i, layers, opts = {}) {
    const r = makeRoute(t);
    const color = opts.color || COLORS[t.result];
    const dashed = t.result !== 'catch';
    const tgt = Object.assign(routeLine(layers.routes, r, { color, dashed, ballAtEnd: t.result !== 'inc' }), { t, i });
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

  // ---------- timeline ----------
  const T = { intro: 3.8, gameIn: 1.7, target: 2.6, tree: 3.8, ir: 3.6, season: 9 };

  function seasonRoutes(layers) {
    const list = [];
    GAMES.forEach((g) => g.targets.forEach((t) => {
      list.push(buildTarget(t, list.length, layers, { light: true, color: t.result === 'noplay' ? COLORS.noplay : SEASON_COLORS[g.id] }));
    }));
    return list;
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
    const lane = makeLaneIcon(L.actors, DATA.player.number);
    const lane2 = makeLaneIcon(L.actors, DATA.player.number);
    const sidesUsed = [...new Set(g.targets.map((t) => t.side))];
    seg.ui = {
      L, fields, neutral, form, targets, ball, lane, lane2, sidesUsed,
      panel: buildGamePanel(g),
      title: fieldTitle(`WEEK ${g.week} TARGET TREE`, treeSubtitle(statsOf(g.targets))),
      bug: playBug(),
      banner: banner(`WEEK ${g.week}`, `${g.home ? 'vs' : '@'} ${g.oppName}`,
        `${g.result} ${g.score} · ${g.date} · ${g.targets.filter((x) => x.result !== 'noplay').length} TARGETS`),
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

    slideBanner(ui.banner, lt);

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
    $('tabs').style.opacity = easeOut(span(lt, seg.dur - 0.5, seg.dur));
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
      const ic = makeLaneIcon(L.actors, DATA.player.number);
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

  // ---------- run ----------
  const segments = [{ kind: 'intro', tab: null, dur: T.intro, intro: true, build: buildIntro, update: updateIntro }];
  DATA.games.forEach((g) => {
    segments.push(g.ir
      ? { kind: 'ir', g, tab: g.id, dur: T.ir, build: buildIr, update: updateIr }
      : { kind: 'game', g, tab: g.id, dur: T.gameIn + g.targets.length * T.target + T.tree, build: buildGame, update: updateGame });
  });
  segments.push({ kind: 'season', tab: 'season', dur: T.season, build: buildSeason, update: updateSeason });
  RT.run({
    segments,
    tabs: [...DATA.games.map((g) => ({ id: g.id, label: g.tab, cls: g.ir ? 'ir' : '' })), { id: 'season', label: 'SEASON' }],
  });
})();
