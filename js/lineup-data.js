/*
 * Week 8 lineup check: your starting pass catchers vs. the coverage their
 * opponent plays. Edit this file each week; lineup.js recomputes everything.
 *
 * DEFENSES
 *   mix         share of snaps by shell (keys from js/coverages.js). Shares can
 *               sum to < 100; the rest is "other" and isn't graded.
 *   confidence  HIGH = direct shell charting
 *               MED  = dated snapshot, or split derived from measured
 *                      man / zone / middle-closed rates
 *               LOW  = inferred from scheme reporting or conflicting sources
 *   blitz       blitz rate % when reported: heavy pressure helps quick routes
 *               and hurts slow-developing ones
 *   quality     reported pass-defense quality, when known: 'elite' | 'strong' | 'leaky'
 *
 * Scores are relative to `baseline` (a league-typical mix), so 0 = an
 * ordinary week for that player and + means this defense suits him better.
 *
 * PLAYERS
 *   role        route profile template from ROLES below (estimated, not
 *               charted), or 'charted' to use Lane's play-by-play targets
 */
window.LINEUP_DATA = {
  week: 8,
  date: 'SUN NOV 1, 2026',

  // League-typical shell mix. Cover 3 (32.7%, 2026) and Cover 4 (17.2%, 2025)
  // are reported league averages; the others are approximate.
  baseline: { c3: 32.7, c4: 17.2, c1: 20, c2: 12, m2: 3 },
  qualityShift: { elite: -0.15, strong: -0.07, leaky: 0.1 },

  // Route profiles by role: [route, share %, typical depth in yards]
  roles: {
    X: { label: 'OUTSIDE X', x: 19.5, side: 'L', routes: [['GO', 18, 24], ['CURL', 16, 11], ['COMEBACK', 12, 12], ['DIG', 14, 13], ['SLANT', 12, 7], ['POST', 10, 18], ['OUT', 10, 10], ['FADE', 8, 14]] },
    OUTSIDE: { label: 'OUTSIDE · INTERMEDIATE', x: 19.5, side: 'L', routes: [['CURL', 18, 11], ['COMEBACK', 14, 12], ['DIG', 18, 13], ['GO', 14, 24], ['OUT', 12, 10], ['SLANT', 12, 7], ['POST', 12, 18]] },
    SLOT: { label: 'SLOT', x: 12.5, side: 'L', routes: [['SLANT', 16, 6], ['HITCH', 14, 6], ['DIG', 16, 11], ['OUT', 14, 8], ['DRAG', 12, 4], ['CURL', 10, 9], ['SEAM', 10, 18], ['CORNER', 8, 16]] },
    MOVE: { label: 'MOVE · YAC', x: 12.5, side: 'L', routes: [['DRAG', 18, 4], ['SLANT', 18, 6], ['HITCH', 14, 5], ['FLAT', 14, 2], ['OUT', 12, 7], ['DIG', 12, 10], ['GO', 12, 22]] },
    TE: { label: 'TIGHT END', x: 6.8, side: 'R', routes: [['SEAM', 16, 18], ['CURL', 16, 8], ['DRAG', 16, 4], ['FLAT', 14, 2], ['DIG', 14, 11], ['OUT', 12, 7], ['CORNER', 12, 15]] },
    DEEP: { label: 'DEEP SPEED', x: 19.5, side: 'L', routes: [['GO', 22, 25], ['POST', 18, 20], ['DIG', 16, 13], ['CURL', 12, 11], ['SLANT', 12, 7], ['OUT', 10, 10], ['DRAG', 10, 4]] },
  },

  defenses: {
    BUF: {
      name: 'BUFFALO', colors: ['#00338D', '#C60C30'], confidence: 'HIGH',
      mix: { c3: 34.4, c4: 26.0 }, blitz: 27.9, quality: 'leaky',
      note: 'Cover 3 or 4 on 60%+ of snaps (Cover 4 rate is #1 in the NFL). 31st in pass yards allowed.',
    },
    MIN: {
      name: 'MINNESOTA', colors: ['#4F2683', '#FFC62F'], confidence: 'LOW',
      mix: { c3: 37, c4: 20, c2: 20, c1: 23 }, blitz: 69.9, quality: 'elite',
      note: 'Brian Flores blitzes on ~70% of dropbacks (most in the NFL) with mostly zone behind it, rotating quarters, Cover 2 and Cover 3. #1 in defensive EPA.',
    },
    ARI: {
      name: 'ARIZONA', colors: ['#97233F', '#FFB612'], confidence: 'MED',
      mix: { c3: 21, c4: 20, c2: 14, c1: 5.8 },
      note: 'About 81% zone through Week 5: Cover 3 21%, Cover 4 20%, Cover 2 14%, Cover 1 under 6%.',
    },
    DAL: {
      name: 'DALLAS', colors: ['#041E42', '#869397'], confidence: 'MED',
      mix: { c1: 21.3, c3: 38.9, c2: 15.5, c4: 15.5 },
      note: '70% zone, 21% man, middle of the field closed on 60% of snaps. Shell split derived from those rates.',
    },
    JAX: {
      name: 'JACKSONVILLE', colors: ['#006778', '#D7A22A'], confidence: 'LOW',
      mix: { c1: 21, c3: 37, c2: 18, c4: 18 }, quality: 'leaky',
      note: 'Sources conflict on man rate (21% vs. 65%). Allows 273.8 pass yards per game (30th).',
    },
    CLE: {
      name: 'CLEVELAND', colors: ['#311D00', '#FF3C00'], confidence: 'MED',
      mix: { c1: 42.4, c3: 30.2, c2: 23.8 }, quality: 'strong',
      note: '42% man and #1 in middle-closed rate: lots of Cover 1. Ran Cover 1 on 59% of snaps vs. Pittsburgh in Week 4.',
    },
    PIT: {
      name: 'PITTSBURGH', colors: ['#101820', '#FFB612'], confidence: 'MED',
      mix: { c3: 40, c1: 12.6, c2: 21, c4: 21 },
      note: 'One of the most zone-heavy defenses (82% zone). Cover 3 is the most-used shell at about 40%.',
    },
    DEN: {
      name: 'DENVER', colors: ['#FB4F14', '#002244'], confidence: 'LOW',
      mix: { c3: 45, c1: 24.5, c2: 12.5, c4: 12.5 }, blitz: 35,
      note: '70% zone, mostly Cover 3; man is mostly Cover 1. Blitzes about 35% of the time.',
    },
    WAS: {
      name: 'WASHINGTON', colors: ['#5A1414', '#FFB612'], confidence: 'LOW',
      mix: { c4: 28, c2: 27, c3: 24, c1: 10.5, m2: 10.5 }, quality: 'leaky',
      note: '79% zone, mostly two-high. 28th in pass yards allowed and last in red-zone TD rate (81.8%).',
    },
    PHI: {
      name: 'PHILADELPHIA', colors: ['#004C54', '#A5ACAF'], confidence: 'LOW',
      mix: { c4: 40, c2: 20, c3: 20, c1: 10 },
      note: "Vic Fangio's two-high, quarters-based zone: built to take away big plays and force short throws.",
    },
  },

  // In kickoff order. leagues: where you're starting (or benching) him.
  players: [
    { id: 'pickens', name: 'GEORGE PICKENS', short: 'PICKENS', icon: 'GP', team: 'DAL', pos: 'WR', role: 'X', opp: 'ARI', kick: '1:00 PM', leagues: ['SUNDAY FUNDAY'],
      note: 'QUESTIONABLE (shoulder, hamstring); check inactives. Role uses the outside-X template.' },
    { id: 'mwilson', name: 'MICHAEL WILSON', short: 'WILSON', icon: 'MW', team: 'ARI', pos: 'WR', role: 'OUTSIDE', opp: 'DAL', kick: '1:00 PM', leagues: ['SUNDAY FUNDAY'],
      note: '2025 aDOT 13.3; may see more slot snaps in the new scheme.' },
    { id: 'warren', name: 'TYLER WARREN', short: 'WARREN', icon: 'TW', team: 'IND', pos: 'TE', role: 'TE', opp: 'JAX', kick: '1:00 PM', leagues: ['SUNDAY FUNDAY'],
      note: 'Tight-end template.' },
    { id: 'stbrown', name: 'AMON-RA ST. BROWN', short: 'ST. BROWN', icon: 'AR', team: 'DET', pos: 'WR', role: 'SLOT', opp: 'MIN', kick: '1:00 PM', leagues: ['LUMBERG'],
      note: 'aDOT about 8.6; slot on ~40% of snaps in 2025.' },
    { id: 'bernard', name: 'GERMIE BERNARD', short: 'BERNARD', icon: 'GB', team: 'PIT', pos: 'WR', role: 'SLOT', opp: 'CLE', kick: '1:00 PM', leagues: ['LUMBERG'],
      note: 'Rookie "big slot": 22% target rate, 7.9 yds per catch. Pittsburgh has struggled vs. man.' },
    { id: 'concepcion', name: 'KC CONCEPCION JR.', short: 'CONCEPCION', icon: 'KC', team: 'CLE', pos: 'WR', role: 'MOVE', opp: 'PIT', kick: '1:00 PM', leagues: ['PRIME TIME', 'LUMBERG BENCH'],
      note: '8-129 on 10 targets in Week 7; 5-64 vs. Pittsburgh in Week 4.' },
    { id: 'lane', name: "JA'KOBI LANE", short: 'LANE', icon: '6', team: 'BAL', pos: 'WR', role: 'charted', opp: 'BUF', kick: '1:00 PM', leagues: ['SUNDAY FUNDAY BENCH'],
      note: 'Charted from play-by-play (see the full Bills model). Bench option if Pickens sits.' },
    { id: 'rice', name: 'RASHEE RICE', short: 'RICE', icon: 'RR', team: 'KC', pos: 'WR', role: 'MOVE', opp: 'DEN', kick: '4:25 PM', leagues: ['PRIME TIME'],
      note: 'About 50/50 slot and wide; 75% of 2025 targets within 9 yards.' },
    { id: 'goedert', name: 'DALLAS GOEDERT', short: 'GOEDERT', icon: 'DG', team: 'PHI', pos: 'TE', role: 'TE', opp: 'WAS', kick: '8:20 PM', leagues: ['LUMBERG'],
      note: 'Tight-end template.' },
    { id: 'diggs', name: 'STEFON DIGGS', short: 'DIGGS', icon: 'SD', team: 'WAS', pos: 'WR', role: 'SLOT', opp: 'PHI', kick: '8:20 PM', leagues: ['PRIME TIME'],
      note: 'Now mostly a slot receiver; sub-9 aDOT the past two seasons.' },
    { id: 'mbrown', name: 'MARQUISE BROWN', short: 'BROWN', icon: 'MB', team: 'PHI', pos: 'WR', role: 'DEEP', opp: 'WAS', kick: '8:20 PM', leagues: ['PRIME TIME'],
      note: 'Role reported as unclear behind DeVonta Smith; deep-speed template.' },
  ],

  // Lineup decisions to spell out on the board (scores fill in automatically).
  calls: [
    { type: 'compare', league: 'LUMBERG WR2', a: 'bernard', b: 'concepcion', note: 'Concepcion is on your bench there' },
    { type: 'fallback', league: 'SUNDAY FUNDAY', a: 'pickens', b: 'lane' },
  ],

  sources: ['Buffalo Rumblings', 'Pride of Detroit', 'Sharp Football', 'ESPN', 'StatRankings', 'Steelers Depot', 'Yahoo Sports', 'Fox Sports', 'Rotoballer', 'Draftsharks'],
};
