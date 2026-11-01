# Ja'Kobi Lane — 2026 Route Tree

An animated, telestrator-style football graphic of every target Ja'Kobi Lane
(#6, WR, Baltimore, rookie) has seen in the 2026 season, game by game.

The look borrows from TV-broadcast telestrators and video-game play art: a 3D
field, yellow chalk circles, "BOOM!" bursts, and a stat panel that ticks up.
It's an unofficial fan graphic, with no team, league or video-game logos.

| Segment | What's shown |
|---|---|
| Intro | Title card over a faint preview of the full season tree |
| Week 1 @ IND | 3 targets (1-11) + a TD catch wiped out by holding |
| Weeks 2–5 | Injured reserve (fractured wrist) |
| Week 6 @ CLE | 5 targets (4-40) |
| Week 7 vs CIN | 5 targets (3-25), including the end-zone miss |
| Season | All targets overlaid and color-coded by game, season stats and yards by week |

Each target animates in order: the route draws on, the ball is thrown, then the
result pops (catch / incomplete / no play). After each game the full
**target tree** for that game is shown with labels.

## Week 8 matchup: Lane vs. the Bills defense

`bills-matchup.html` models the coverages Buffalo leans on and grades Lane's
route tree against each one, to answer "does this defense suit him?"

| Segment | What's shown |
|---|---|
| Bills D | Coverage mix (Cover 3 34.4%, Cover 4 26.0%, other 39.6%), blitz rate, pass-defense stats, and the two-high pre-snap shell |
| Cover 3 | Defenders rotate from two-high into three deep / four under; zones grow in, the soft spots get circled, then each of Lane's route types runs against it, graded WIN / CONTESTED / TOUGH |
| Cover 4 | Same for quarters (four deep / three under) |
| Verdict | Lane's tree colored by the blended grade, a matchup meter, and the reasoning |

Current read: **favorable**. 69% of his targets are on routes that beat
Cover 3 and 46% on routes that beat Cover 4. All 8 of his catches gained 6–11
yards, which is the cushion those corners give up. His deep shots (0-for-3)
attack where both shells are strongest.

How the grades work: each route type is graded against each coverage with
standard coverage rules (`grades` in `js/bills-data.js`). A route's blended
score weights the Cover 3 and Cover 4 grades by how often Buffalo plays each,
and the meter is the target-weighted average. Change a grade, a coverage
share or Lane's routes, and every number on screen recalculates.

## Lineup coverage check: any player vs. any defense

`lineup.html` runs the same coverage model for a whole fantasy lineup. Each
starter gets a segment: his opponent's most-used shell animates in, his route
profile runs against it, and each route is graded against the defense's full
coverage mix. A board at the end ranks everyone.

To use it for a new week, edit **`js/lineup-data.js`**:

- `players`: who you're starting, their NFL opponent, kickoff time, leagues,
  and a `role` (`X`, `OUTSIDE`, `SLOT`, `MOVE`, `TE`, `DEEP`, or `charted` for
  play-by-play targets like Lane's)
- `defenses`: each opponent's coverage mix (`c1`, `c2`, `c3`, `c4`, `m2`
  shares), blitz rate, reported pass-defense quality, and how solid the data is
- `calls`: lineup decisions to spell out on the board (scores fill in automatically)

How the score works: every route type has a grade against every shell
(`js/coverages.js`, standard coverage rules). A player's score is his route
profile graded against this defense's mix, minus the same profile against a
league-typical mix, plus a small shift for reported pass-defense quality.
So **0 means an ordinary week for him**, plus means this defense suits him
better, and minus means worse. Blitz-heavy defenses nudge quick routes up and
slow routes down.

Limits: route profiles are role templates unless charted, and several coverage
mixes are derived or low-confidence (shown on screen as HIGH / MED / LOW). This
grades coverage fit only. Volume, QB play and injuries still decide the week.

## Files

```
index.html                          route tree graphic (open in any browser)
bills-matchup.html                  Week 8 Bills coverage model
lineup.html                         lineup coverage check (all your starters)
dist/*.html                         both graphics as self-contained single files, easy to share
renders/*.mp4                       exported videos: 1920×1080 and 1080×1920 (Reels/TikTok/Shorts)
renders/*.png                       still posters (season tree, matchup verdict)
js/data.js                          ← Lane's game and target data, edit this
js/bills-data.js                    ← Bills coverage mix, defender spots, zones, route grades
js/lineup-data.js                   ← your starters, their opponents' coverage mixes
js/coverages.js                     shell library: Cover 1/2/3/4, 2-Man landmarks, zones, route grades
js/matchup-kit.js                   shared zones / defenders / soft-spot markers
js/engine.js                        shared: field projection, players, routes, telestrator fx, playback
js/app.js                           route tree segments
js/bills.js                         Bills matchup segments
js/lineup.js                        lineup segments and scoring
css/style.css                       layout and styling (landscape and vertical)
tools/record.mjs                    frame-by-frame MP4 export (Playwright + ffmpeg)
tools/snap.mjs                      render still frames at given times
tools/bundle.mjs                    build a single-file HTML
```

## Viewing

Open `index.html` or `bills-matchup.html` (or their `dist/` versions) in a
browser. They scale to the window and loop.

- **Space** play/pause, **R** restart, **← / →** previous/next game
- Click a tab (WK 1, WK 6, …) to jump to that game
- Hover the bottom bar for the scrubber and speed control (0.5× / 1× / 2×)

URL options:

| Param | Effect |
|---|---|
| `?format=vertical` | 1080×1920 portrait layout for Reels, TikTok and Shorts |
| `?seg=wk6` | start at a segment (`wk1`, `ir`, `wk6`, `wk7`, `season`; matchup: `defense`, `c3`, `c4`, `verdict`; lineup: a player id like `stbrown`, or `board`) |
| `?t=42&paused` | freeze on a specific second, useful for screenshots |

## Re-rendering the video

Requires Node, Playwright (Chromium) and ffmpeg.

```bash
node tools/record.mjs                        # renders/jakobi-lane-route-tree-2026.mp4
node tools/record.mjs --format vertical      # renders/jakobi-lane-route-tree-2026-vertical.mp4
node tools/record.mjs out.mp4 --fps 60       # custom path / frame rate
node tools/record.mjs renders/jakobi-lane-vs-bills-week8.mp4 --page bills-matchup.html
node tools/bundle.mjs                        # rebuild dist/ after editing
node tools/bundle.mjs dist/jakobi-lane-vs-bills-week8.html bills-matchup.html
node tools/record.mjs renders/lineup-week8.mp4 --page lineup.html
node tools/bundle.mjs dist/lineup-week8.html lineup.html
```

Every frame is a pure function of time, so the export is deterministic and
smooth regardless of machine speed.

## About the data

**What's documented** (box scores and public play-by-play):

- Targets, receptions, yards and longest catch per game. Season: 13 targets,
  8 catches, 76 yards, long of 11, 0 TD.
- For most catches: yardage, direction (short left/right/middle), line of
  scrimmage and where he was tackled. Each target's `pbp` text in `js/data.js`
  is the documented fact, and it appears under that row in the panel.
- Game context: the Week 1 holding penalty that erased a TD, the wrist
  fracture and IR stint, his boundary alignment in Week 6, and the Week 7
  end-zone miss.

**What's reconstructed:** the route type drawn for each target (slant, curl,
dig, …). Public play-by-play doesn't record the route a receiver ran, so each
shape is chosen to fit the documented depth and direction. Where only the
yardage or "incomplete" is known (three targets in Week 1, two in Week 7), the
route is a placeholder at a plausible depth. The graphic's footer says this on
screen.

If you chart the film yourself, or have a PFF / Next Gen Stats route chart,
update `route`, `side` and `depth` on each target in `js/data.js`. Everything
else (stats, labels, trees, season view) recalculates from that file. Then
re-run the recorder.

Sources: ESPN play-by-play, Pro-Football-Reference, NBC Sports / Rotoworld,
Baltimore Beatdown film review, BaltimoreRavens.com. Data runs through Week 7
(Oct 25, 2026). Next game: Week 8 @ BUF, Sun Nov 1.

**Bills model:** the coverage rates come from one charting analysis (Buffalo
Rumblings, 2026 through the Week 7 bye). Treat them as approximate until a
tracking source (PFF, Sharp Football) confirms them. Defender landmarks are a
textbook version of each shell, not Bills-specific tracking. Team stats come
from AP, ESPN and Sharp Football Week 8 previews. Film notes come from The Lead
and The Athletic.

Font: [Oswald](https://github.com/googlefonts/OswaldFont), SIL Open Font
License (`assets/fonts/OFL-Oswald.txt`).
