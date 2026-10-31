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

## Files

```
index.html                       the graphic (open in any browser)
dist/jakobi-lane-route-tree.html same thing as one self-contained file, easy to share
renders/*.mp4                    exported video: 1920×1080 and 1080×1920 (Reels/TikTok/Shorts)
js/data.js                       ← all game and target data, edit this
js/app.js                        projection, route drawing and animation timeline
css/style.css                    layout and styling (landscape and vertical)
tools/record.mjs                 frame-by-frame MP4 export (Playwright + ffmpeg)
tools/snap.mjs                   render still frames at given times
tools/bundle.mjs                 build the single-file HTML
```

## Viewing

Open `index.html` (or `dist/jakobi-lane-route-tree.html`) in a browser. It
scales to the window and loops.

- **Space** play/pause, **R** restart, **← / →** previous/next game
- Click a tab (WK 1, WK 6, …) to jump to that game
- Hover the bottom bar for the scrubber and speed control (0.5× / 1× / 2×)

URL options:

| Param | Effect |
|---|---|
| `?format=vertical` | 1080×1920 portrait layout for Reels, TikTok and Shorts |
| `?seg=wk6` | start at a segment (`wk1`, `ir`, `wk6`, `wk7`, `season`) |
| `?t=42&paused` | freeze on a specific second, useful for screenshots |

## Re-rendering the video

Requires Node, Playwright (Chromium) and ffmpeg.

```bash
node tools/record.mjs                        # renders/jakobi-lane-route-tree-2026.mp4
node tools/record.mjs --format vertical      # renders/jakobi-lane-route-tree-2026-vertical.mp4
node tools/record.mjs out.mp4 --fps 60       # custom path / frame rate
node tools/bundle.mjs                        # rebuild dist/ after editing
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

Font: [Oswald](https://github.com/googlefonts/OswaldFont), SIL Open Font
License (`assets/fonts/OFL-Oswald.txt`).
