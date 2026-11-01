/*
 * Coverage shell library: defender landmarks, zones, soft spots and route
 * grades for the standard NFL coverages. Team-agnostic — a defense file only
 * says how often it plays each shell.
 *
 * Coordinates are [X, D] field yards (X: 0 = middle, + = offense's right;
 * D: yards past the line of scrimmage). `pre` = pre-snap spot, `post` = zone
 * landmark / man trail spot / pass-rush spot.
 *
 * Grades: 'win' = the shell concedes the route, 'mid' = contested or
 * situational, 'tough' = the shell is built to take it away. These are
 * standard coverage principles, not team-specific charting.
 */
window.COVERAGES = (() => {
  const RUSH = [
    { pos: 'DL', pre: [-3.2, 0.7], post: [-2.6, -3.6], rush: true },
    { pos: 'DL', pre: [0, 0.7], post: [0.3, -3.1], rush: true },
    { pos: 'DL', pre: [3.2, 0.7], post: [2.6, -3.6], rush: true },
    { pos: 'OLB', pre: [7.2, 0.7], post: [4.2, -4.6], rush: true },
  ];

  return {
    c1: {
      name: 'COVER 1',
      tagline: 'MAN-FREE · ONE DEEP SAFETY',
      defenders: [
        { pos: 'CB', pre: [-19.5, 1.5], post: [-19, 10] },
        { pos: 'FS', pre: [0, 14], post: [0, 19] },
        { pos: 'SS', pre: [-12.5, 5], post: [-11.5, 9] },
        { pos: 'CB', pre: [19.5, 1.5], post: [19, 10] },
        { pos: 'OLB', pre: [-7, 0.7], post: [-3.5, -4.4], rush: true },
        { pos: 'LB', pre: [-2.6, 4.5], post: [0, 7] },
        { pos: 'LB', pre: [2.6, 4.5], post: [7, 8] },
        ...RUSH.slice(0, 3),
        { pos: 'OLB', pre: [7.2, 0.7], post: [4.2, -4.6], rush: true },
      ],
      zones: [
        { type: 'deep', c: [0, 20], r: [11, 6.5], label: 'DEEP MIDDLE' },
        { type: 'hook', c: [0, 7.5], r: [4, 3], label: 'ROBBER' },
      ],
      holes: [
        { at: [-21, 17], label: 'OUTSIDE, AWAY FROM FS' },
        { at: [-6, 5], label: 'CROSSERS vs TRAIL MAN' },
      ],
      grades: {
        HITCH: ['mid', 'Press corner can sit on it'],
        SLANT: ['mid', 'Wins with inside release, contested at the catch'],
        CURL: ['mid', 'Needs separation at the break'],
        COMEBACK: ['mid', 'Needs separation at the break'],
        OUT: ['mid', 'Timing throw against a trailing corner'],
        DIG: ['win', 'Crossers beat trail-man technique'],
        DRAG: ['win', 'Rubs and crossers are man beaters'],
        FLAT: ['mid', 'Defender is running with him'],
        SEAM: ['mid', 'Free safety sits in the middle'],
        POST: ['tough', 'Runs right at the free safety'],
        CORNER: ['win', 'Breaks away from the lone deep safety'],
        GO: ['mid', 'One-on-one: pure contested ball'],
        FADE: ['mid', 'One-on-one: pure contested ball'],
      },
    },

    c2: {
      name: 'COVER 2',
      tagline: 'TWO DEEP · FIVE UNDER',
      defenders: [
        { pos: 'CB', pre: [-19.5, 5], post: [-19.5, 4] },
        { pos: 'S', pre: [-9, 13], post: [-13, 18] },
        { pos: 'S', pre: [9, 13], post: [13, 18] },
        { pos: 'CB', pre: [19.5, 5], post: [19.5, 4] },
        { pos: 'OLB', pre: [-7, 0.7], post: [-11, 9] },
        { pos: 'LB', pre: [-2.6, 4.5], post: [0, 10] },
        { pos: 'LB', pre: [2.6, 4.5], post: [11, 9] },
        ...RUSH,
      ],
      zones: [
        { type: 'deep', c: [-13.3, 21], r: [12.5, 7.5], label: 'DEEP ½' },
        { type: 'deep', c: [13.3, 21], r: [12.5, 7.5], label: 'DEEP ½' },
        { type: 'flat', c: [-20.5, 4], r: [5, 3.5], label: 'FLAT' },
        { type: 'hook', c: [-10.5, 9], r: [4.5, 3.6], label: 'HOOK-CURL' },
        { type: 'hook', c: [0, 10], r: [4.5, 3.6], label: 'MIDDLE' },
        { type: 'hook', c: [10.5, 9], r: [4.5, 3.6], label: 'HOOK-CURL' },
        { type: 'flat', c: [20.5, 4], r: [5, 3.5], label: 'FLAT' },
      ],
      holes: [
        { at: [-21.5, 16.5], label: 'HONEY HOLE' },
        { at: [-3, 19], label: 'MIDDLE SEAM' },
      ],
      grades: {
        HITCH: ['tough', 'Corner squats on the flat'],
        SLANT: ['mid', 'Into the hook-curl defender'],
        CURL: ['mid', 'Five underneath defenders clog it'],
        COMEBACK: ['tough', 'Squatting corner is sitting on it'],
        OUT: ['tough', 'Squatting corner jumps it'],
        DIG: ['mid', 'Window between hooks, under the safety'],
        DRAG: ['mid', 'Underneath traffic'],
        FLAT: ['tough', 'Corner owns the flat'],
        SEAM: ['win', 'Splits the two deep safeties'],
        POST: ['win', 'Splits the two deep safeties'],
        CORNER: ['win', 'Honey hole between corner and safety'],
        GO: ['win', 'Sideline hole behind the squatting corner'],
        FADE: ['win', 'Sideline hole behind the squatting corner'],
      },
    },

    c3: {
      name: 'COVER 3',
      tagline: 'THREE DEEP · FOUR UNDER',
      defenders: [
        { pos: 'CB', pre: [-19.5, 6.5], post: [-18, 19.5] },
        { pos: 'FS', pre: [-9, 13], post: [0, 21] },
        { pos: 'SS', pre: [9, 13], post: [13.5, 7.5] },
        { pos: 'CB', pre: [19.5, 6.5], post: [18, 19.5] },
        { pos: 'OLB', pre: [-7, 0.7], post: [-14.5, 7] },
        { pos: 'LB', pre: [-2.6, 4.5], post: [-5, 9] },
        { pos: 'LB', pre: [2.6, 4.5], post: [5, 9] },
        ...RUSH,
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
        { at: [-8.9, 19], label: 'SEAM' },
      ],
      grades: {
        HITCH: ['win', 'Corner bails, so the cushion is free'],
        SLANT: ['win', 'Inside the curl-flat, in front of the hook'],
        CURL: ['win', 'Window between curl-flat and hook'],
        COMEBACK: ['win', 'Corner is backpedaling to his third'],
        OUT: ['mid', 'Curl-flat defender can sink under it'],
        DIG: ['win', 'Behind the hooks, in front of the middle safety'],
        DRAG: ['mid', 'Hook defenders sit on it'],
        FLAT: ['win', 'Stretches the curl-flat defender'],
        SEAM: ['win', 'Splits the deep thirds'],
        POST: ['mid', 'Needs the middle safety to bite'],
        CORNER: ['tough', 'Deep-third corner sits on it'],
        GO: ['tough', "Runs into the corner's deep third"],
        FADE: ['tough', 'Corner owns the outside third'],
      },
    },

    c4: {
      name: 'COVER 4',
      tagline: 'QUARTERS · FOUR DEEP · THREE UNDER',
      defenders: [
        { pos: 'CB', pre: [-19.5, 6.5], post: [-19.5, 16] },
        { pos: 'S', pre: [-9, 13], post: [-8, 16.5] },
        { pos: 'S', pre: [9, 13], post: [8, 16.5] },
        { pos: 'CB', pre: [19.5, 6.5], post: [19.5, 16] },
        { pos: 'OLB', pre: [-7, 0.7], post: [-12, 7] },
        { pos: 'LB', pre: [-2.6, 4.5], post: [-0.5, 8.5] },
        { pos: 'LB', pre: [2.6, 4.5], post: [11, 7] },
        ...RUSH,
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
        HITCH: ['win', 'Only 3 underneath; corner bails'],
        SLANT: ['mid', 'Hook defender walls it; safety drives'],
        CURL: ['win', 'Outside the hook-curl, under the corner'],
        COMEBACK: ['win', 'Corner carries the stem deep'],
        OUT: ['win', 'Flat is soft with 3 underneath'],
        DIG: ['mid', 'Quarters safeties drive on in-breakers'],
        DRAG: ['win', 'Under the linebackers'],
        FLAT: ['win', 'Flat is soft with 3 underneath'],
        SEAM: ['tough', 'Safety reads #2 going vertical'],
        POST: ['tough', 'Inside safety sits on it'],
        CORNER: ['tough', 'Corner and safety bracket it'],
        GO: ['tough', 'Corner on top, safety over the top'],
        FADE: ['tough', 'Corner on top, safety help'],
      },
    },

    m2: {
      name: '2-MAN',
      tagline: 'MAN UNDER · TWO DEEP',
      defenders: [
        { pos: 'CB', pre: [-19.5, 1.5], post: [-19, 9] },
        { pos: 'S', pre: [-9, 13], post: [-13, 18] },
        { pos: 'S', pre: [9, 13], post: [13, 18] },
        { pos: 'CB', pre: [19.5, 1.5], post: [19, 9] },
        { pos: 'OLB', pre: [-12.5, 5], post: [-12, 9] },
        { pos: 'LB', pre: [-2.6, 4.5], post: [2, 3] },
        { pos: 'LB', pre: [2.6, 4.5], post: [7, 8] },
        ...RUSH,
      ],
      zones: [
        { type: 'deep', c: [-13.3, 21], r: [12.5, 7.5], label: 'DEEP ½' },
        { type: 'deep', c: [13.3, 21], r: [12.5, 7.5], label: 'DEEP ½' },
      ],
      holes: [{ at: [0, 3], label: 'QB SCRAMBLE LANES' }],
      grades: {
        HITCH: ['mid', 'Trail defender underneath'],
        SLANT: ['mid', 'Trail defender in the hip pocket'],
        CURL: ['mid', 'Needs separation at the break'],
        COMEBACK: ['mid', 'Needs separation at the break'],
        OUT: ['mid', 'Timing throw against trail man'],
        DIG: ['mid', 'Trail man underneath, safety over the top'],
        DRAG: ['mid', 'Defender trails, but rubs help'],
        FLAT: ['mid', 'Defender is running with him'],
        SEAM: ['tough', 'Trail man plus deep safety'],
        POST: ['tough', 'Trail man plus deep safety'],
        CORNER: ['tough', 'Trail man plus deep safety'],
        GO: ['tough', 'Trail man plus deep safety'],
        FADE: ['tough', 'Trail man plus deep safety'],
      },
    },
  };
})();
