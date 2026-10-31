/*
 * Ja'Kobi Lane — 2026 target data (Baltimore Ravens, rookie season).
 *
 * Box-score totals (targets, catches, yards, long) match published game logs.
 * Per-target yardage / direction / field position come from public
 * play-by-play where available — the `pbp` string on each target is the
 * documented fact. The ROUTE TYPE drawn on the field is a reconstruction
 * that fits that depth/direction; it is not official tracking data.
 * Edit `route`, `side`, `depth` here if you chart the film yourself.
 *
 * Field conventions
 *   side   'L' | 'R'   which sideline Lane aligned toward (offense's view)
 *   depth  yards past the line of scrimmage where the route ends
 *   los    { opp: N } = opponent's N-yard line, { own: N } = own N, null = unknown
 *   result 'catch' | 'inc' | 'noplay'
 *   miss   optional [outward, downfield] yards the ball sailed past the target
 *
 * Route types: GO, FADE, OUT, CURL, HITCH, COMEBACK, SLANT, DIG, POST, CORNER
 */
window.LANE_DATA = {
  player: {
    first: "JA'KOBI",
    last: 'LANE',
    number: 6,
    pos: 'WR',
    team: 'BALTIMORE',
    tag: 'ROOKIE · RD 3, PICK 80 · USC',
  },
  season: 2026,
  nextGame: 'WK 8 @ BUF · SUN NOV 1',

  games: [
    {
      id: 'wk1',
      week: 1,
      tab: 'WK 1 @IND',
      date: 'SEP 13, 2026',
      opp: 'IND',
      oppName: 'INDIANAPOLIS',
      home: false,
      result: 'W',
      score: '41–23',
      qb: 'LAMAR JACKSON',
      endZone: '#0b3d82',
      note:
        'Fractured his wrist in the opener (surgery, then four games on IR). ' +
        'A red-zone TD catch was wiped out by offensive holding.',
      targets: [
        { route: 'CURL', side: 'R', depth: 11, result: 'catch', yards: 11, los: null,
          pbp: 'Reception, 11 yds' },
        { route: 'GO', side: 'R', depth: 24, result: 'inc', los: null,
          pbp: 'Target, incomplete' },
        { route: 'FADE', side: 'R', depth: 6, result: 'noplay', yards: 4, los: { opp: 4 },
          pbp: 'TD catch nullified — offensive holding, enforced at IND 4 (No Play)' },
        { route: 'SLANT', side: 'R', depth: 7, result: 'inc', los: null,
          pbp: 'Target, incomplete' },
      ],
    },
    {
      id: 'ir',
      ir: true,
      tab: 'WK 2–5 IR',
      title: 'WEEKS 2–5',
      headline: 'INJURED RESERVE',
      lines: ['FRACTURED WRIST · WEEK 1', 'SURGERY · MID-SEPTEMBER', 'ACTIVATED · OCT 14'],
    },
    {
      id: 'wk6',
      week: 6,
      tab: 'WK 6 @CLE',
      date: 'OCT 18, 2026',
      opp: 'CLE',
      oppName: 'CLEVELAND',
      home: false,
      result: 'L',
      score: '10–13',
      qb: 'TYLER HUNTLEY',
      endZone: '#5a2a0c',
      note:
        'First game back from IR. Lined up on the boundary on 20 of 22 receiving ' +
        'snaps, won against press, and kept working back to the QB on scrambles.',
      targets: [
        { route: 'SLANT', side: 'L', depth: 11, result: 'catch', yards: 11, los: { opp: 32 },
          pbp: 'Short pass, 11 yds to CLE 21 · opening drive' },
        { route: 'CURL', side: 'L', depth: 8, result: 'catch', yards: 8, los: { opp: 17 },
          pbp: 'Short pass, 8 yds to CLE 9 · set up the opening TD' },
        { route: 'COMEBACK', side: 'L', depth: 10, result: 'catch', yards: 10, los: { own: 2 },
          pbp: 'Short pass, 10 yds to BAL 12 · backed up at own 2' },
        { route: 'GO', side: 'L', depth: 27, result: 'inc', los: null,
          pbp: 'Deep pass, incomplete' },
        { route: 'DIG', side: 'L', depth: 11, result: 'catch', yards: 11, los: { own: 39 },
          pbp: 'Short middle, 11 yds to the 50' },
      ],
    },
    {
      id: 'wk7',
      week: 7,
      tab: 'WK 7 vs CIN',
      date: 'OCT 25, 2026',
      opp: 'CIN',
      oppName: 'CINCINNATI',
      home: true,
      result: 'L',
      score: '13–35',
      qb: 'TYLER HUNTLEY',
      endZone: '#2a1a6e',
      note:
        'Two red-zone targets, including a missed TD: open in the end zone, ' +
        'but the throw was off target. Second on the team in first-read share.',
      targets: [
        { route: 'OUT', side: 'L', depth: 10, result: 'catch', yards: 10, los: { opp: 45 }, oob: true,
          pbp: 'Short left, 10 yds, pushed out at CIN 35' },
        { route: 'SLANT', side: 'R', depth: 9, result: 'catch', yards: 9, los: { opp: 29 },
          pbp: 'Short right, 9 yds to CIN 20' },
        { route: 'HITCH', side: 'L', depth: 6, result: 'catch', yards: 6, los: null,
          pbp: 'Reception, 6 yds' },
        { route: 'CORNER', side: 'R', depth: 19, result: 'inc', los: { opp: 12 }, losEst: true,
          miss: [3.5, 4],
          pbp: 'Open in the end zone — throw off target (red zone)' },
        { route: 'CURL', side: 'L', depth: 12, result: 'inc', los: null,
          pbp: 'Target, incomplete' },
      ],
    },
  ],

  sources: [
    'ESPN play-by-play',
    'Pro-Football-Reference',
    'NBC Sports / Rotoworld',
    'Baltimore Beatdown film review',
    'BaltimoreRavens.com',
  ],
};
