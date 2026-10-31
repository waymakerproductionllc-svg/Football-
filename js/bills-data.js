/*
 * Buffalo Bills 2026 defense model for the Week 8 matchup vs. Ja'Kobi Lane.
 *
 * Coverage rates: Buffalo Rumblings charting (2026 season, through the Bills'
 * Week 7 bye). Team stats: AP / ESPN / Sharp Football previews of Week 8.
 *
 * Defender spots are [X, D] in field yards (X: 0 = middle, + = offense's
 * right; D: yards past the line of scrimmage). Lane is the boundary X
 * receiver on the offense's LEFT. `pre` = pre-snap alignment, `post` = where
 * the defender ends up (zone landmark, or pass rush).
 *
 * Grades apply standard coverage principles to each route Lane has been
 * targeted on: 'win' = the coverage concedes it, 'mid' = contested /
 * situational, 'tough' = the coverage is built to take it away.
 */
window.BILLS_DATA = {
  matchup: {
    week: 8,
    opp: 'BUFFALO',
    date: 'SUN NOV 1, 2026',
    records: 'BAL 4-3 · BUF 5-1',
    qb: 'LAMAR JACKSON BACK FROM ANKLE INJURY',
  },

  defense: {
    dc: 'JIM LEONHARD',
    dcNote: '1ST-YEAR DC · 3-4 BASE',
    mix: [
      { id: 'c3', label: 'COVER 3', pct: 34.4, note: 'LEAGUE AVG 32.7%' },
      { id: 'c4', label: 'COVER 4', pct: 26.0, note: '#1 IN THE NFL' },
      { id: 'other', label: 'EVERYTHING ELSE', pct: 39.6, note: 'COVER 6 · COVER 1 · 2-MAN …' },
    ],
    blitz: { pct: 27.9, rank: '20TH' },
    stats: [
      { v: '285.8', k: 'PASS YDS/G', r: '31ST' },
      { v: '102.5', k: 'OPP RATING', r: 'ALLOWED' },
      { v: '15', k: 'PASS TDs', r: 'TOP-3 MOST' },
      { v: '30TH', k: 'EPA / PLAY', r: 'ALLOWED' },
    ],
    note:
      'Top-4 in fantasy points allowed to WRs through Week 7. Leonhard on the problems: ' +
      '"significantly more on the back seven" — "too many times we look confused."',
  },

  // Both shells start from the same two-high look; the Bills rotate at the snap.
  coverages: [
    {
      id: 'c3',
      name: 'COVER 3',
      pct: 34.4,
      tagline: 'THREE DEEP · FOUR UNDER',
      defenders: [
        { pos: 'CB', pre: [-19.5, 6.5], post: [-18, 19.5] },
        { pos: 'FS', pre: [-9, 13], post: [0, 21] },
        { pos: 'SS', pre: [9, 13], post: [13.5, 7.5] },
        { pos: 'CB', pre: [19.5, 6.5], post: [18, 19.5] },
        { pos: 'OLB', pre: [-7, 0.7], post: [-14.5, 7] },
        { pos: 'LB', pre: [-2.6, 4.5], post: [-5, 9] },
        { pos: 'LB', pre: [2.6, 4.5], post: [5, 9] },
        { pos: 'DL', pre: [-3.2, 0.7], post: [-2.6, -3.6], rush: true },
        { pos: 'DL', pre: [0, 0.7], post: [0.3, -3.1], rush: true },
        { pos: 'DL', pre: [3.2, 0.7], post: [2.6, -3.6], rush: true },
        { pos: 'OLB', pre: [7.2, 0.7], post: [4.2, -4.6], rush: true },
      ],
      zones: [
        { type: 'deep', c: [-17.8, 21], r: [8.4, 7.5], label: 'DEEP ⅓' },
        { type: 'deep', c: [0, 22], r: [8.4, 7.5], label: 'DEEP ⅓' },
        { type: 'deep', c: [17.8, 21], r: [8.4, 7.5], label: 'DEEP ⅓' },
        { type: 'flat', c: [-15, 6.5], r: [6, 4], label: 'CURL-FLAT' },
        { type: 'hook', c: [-5, 8.5], r: [4.6, 3.8], label: 'HOOK' },
        { type: 'hook', c: [5, 8.5], r: [4.6, 3.8], label: 'HOOK' },
        { type: 'flat', c: [15, 6.5], r: [6, 4], label: 'CURL-FLAT' },
      ],
      holes: [
        { at: [-21.5, 7.5], label: 'CB BAILS: CUSHION' },
        { at: [-10, 11.5], label: 'CURL WINDOW' },
        { at: [-1, 13.5], label: 'DIG LANE' },
      ],
      grades: {
        HITCH: ['win', 'CB bails to his deep third, so the 5–6 yd cushion is free'],
        CURL: ['win', 'Settles in the window between curl-flat and hook'],
        COMEBACK: ['win', 'CB is backpedaling; break back to the sideline'],
        SLANT: ['win', 'Inside the curl-flat defender, in front of the hook'],
        DIG: ['win', 'Behind the hooks, in front of the deep middle safety'],
        OUT: ['mid', 'Curl-flat defender can sink under the throw'],
        POST: ['mid', 'Splits CB and middle safety; needs the safety to bite'],
        GO: ['tough', "Runs straight into the CB's deep third"],
        FADE: ['tough', 'CB owns the outside third: a 50/50 ball at best'],
        CORNER: ['tough', 'The deep-third CB sits right on top of it'],
      },
      note:
        'Bills linebackers have been pulled out of their zones and safety play has been ' +
        'inconsistent (The Athletic). That is exactly where curls and digs live.',
    },
    {
      id: 'c4',
      name: 'COVER 4',
      pct: 26.0,
      tagline: 'QUARTERS · FOUR DEEP · THREE UNDER',
      defenders: [
        { pos: 'CB', pre: [-19.5, 6.5], post: [-19.5, 16] },
        { pos: 'S', pre: [-9, 13], post: [-8, 16.5] },
        { pos: 'S', pre: [9, 13], post: [8, 16.5] },
        { pos: 'CB', pre: [19.5, 6.5], post: [19.5, 16] },
        { pos: 'OLB', pre: [-7, 0.7], post: [-12, 7] },
        { pos: 'LB', pre: [-2.6, 4.5], post: [-0.5, 8.5] },
        { pos: 'LB', pre: [2.6, 4.5], post: [11, 7] },
        { pos: 'DL', pre: [-3.2, 0.7], post: [-2.6, -3.6], rush: true },
        { pos: 'DL', pre: [0, 0.7], post: [0.3, -3.1], rush: true },
        { pos: 'DL', pre: [3.2, 0.7], post: [2.6, -3.6], rush: true },
        { pos: 'OLB', pre: [7.2, 0.7], post: [4.2, -4.6], rush: true },
      ],
      zones: [
        { type: 'deep', c: [-20, 20.5], r: [6.3, 7.5], label: 'DEEP ¼' },
        { type: 'deep', c: [-6.7, 21], r: [6.3, 7.5], label: 'DEEP ¼' },
        { type: 'deep', c: [6.7, 21], r: [6.3, 7.5], label: 'DEEP ¼' },
        { type: 'deep', c: [20, 20.5], r: [6.3, 7.5], label: 'DEEP ¼' },
        { type: 'hook', c: [-12, 7.5], r: [5.5, 4], label: 'HOOK-CURL' },
        { type: 'hook', c: [0, 8.5], r: [5, 4], label: 'MIDDLE HOOK' },
        { type: 'hook', c: [12, 7.5], r: [5.5, 4], label: 'HOOK-CURL' },
      ],
      holes: [
        { at: [-22.5, 4.5], label: 'SOFT FLAT' },
        { at: [-20.5, 11], label: 'UNDER THE CB' },
      ],
      grades: {
        HITCH: ['win', 'Only 3 underneath; the CB bails to his deep quarter'],
        CURL: ['win', 'Outside the hook-curl defender, under the CB'],
        COMEBACK: ['win', 'CB carries the stem deep, so the comeback opens late'],
        OUT: ['win', 'Flat is soft with just 3 underneath defenders'],
        SLANT: ['mid', 'Runs into the hook defender; the safety drives on it'],
        DIG: ['mid', 'Quarters safeties drive hard on in-breakers'],
        GO: ['tough', 'CB stays on top with the safety over the top'],
        POST: ['tough', 'The inside safety sits right on the post'],
        FADE: ['tough', 'CB on top plus safety help: contested at best'],
        CORNER: ['tough', 'Bracketed: CB and safety both in the area'],
      },
      note:
        "Quarters is the Bills' best look on film: on one Patriots deep shot both outside " +
        'WRs ran into double coverage and the middle safety drove on in-breakers.',
    },
  ],

  verdict: {
    points: [
      { good: true, text: 'Zone-heavy: Cover 3 or 4 on 60%+ of snaps means fewer press-man reps, the main knock on his release at USC.' },
      { good: true, text: 'CATCH_DEPTH' }, // filled in from Lane's targets
      { good: false, text: 'DEEP_SHOTS' }, // filled in from Lane's targets
      { good: true, text: 'Buffalo allows 285.8 pass yds/g (31st), ranks top-4 in fantasy points allowed to WRs, and Lamar Jackson returns.' },
    ],
    caveat:
      'Small sample (13 targets). Coverage rates come from one charting analysis; grades apply ' +
      'standard coverage rules to reconstructed route types.',
  },

  sources: [
    'Buffalo Rumblings coverage charting',
    'The Lead film review',
    'The Athletic',
    'AP',
    'ESPN',
    'Sharp Football',
    'StatChasers',
  ],
};
