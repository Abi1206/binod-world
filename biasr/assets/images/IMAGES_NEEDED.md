# Images Needed — BIASR Website (place files directly in this folder)

## REQUIRED (core identity — site looks broken without these)

| Filename | Ratio | Size (px) | What to put |
|---|---|---|---|
| `logo.svg` | 1:1 | any (vector) | Original circular seal — telescope, orbit, sun, moon, star, open book (built as SVG, not a photo — see note below) |
| `logo.png` | 1:1 | 512×512 | PNG export of the seal above, for `<img>`/favicon fallback |
| `favicon.png` | 1:1 | 512×512 | Simplified seal, legible at 16px |
| `seal.png` | 1:1 | 800×800 | Larger/detailed seal for letterhead, About page, PDF cover |
| `hero-bg.jpg` | 16:9 | 1920×1080 | Observatory at night, dome open, stars/Milky Way, dramatic |
| `og-image.jpg` | 1.91:1 | 1200×630 | Social share card — logo + tagline over hero-style background |

## ABOUT PAGE

| Filename | Ratio | Size (px) | What to put |
|---|---|---|---|
| `director-portrait.jpg` | 4:5 | 800×1000 | Director's official portrait (formal, plain background) |
| `headquarters.jpg` | 16:9 | 1600×900 | Exterior of the research campus / main building |
| `history-archive.jpg` | 3:2 | 1200×800 | Archival-style photo for the History/Timeline section |

## RESEARCH DIVISIONS (9 total — one banner each)

`division-astronomy.jpg`, `division-space-exploration.jpg`, `division-temporal-physics.jpg`, `division-planetary-science.jpg`, `division-nether-research.jpg`, `division-end-dimension.jpg`, `division-climate-atmospheric.jpg`, `division-astrophysics.jpg`, `division-computational-sim.jpg`

| Ratio | Size (px) |
|---|---|
| 3:2 | 1200×800 |

(Icons for these are drawn as inline SVG in code — no image files needed for icons, only the banner photo per division.)

## OBSERVATORY PAGE

| Filename | Ratio | Size (px) | What to put |
|---|---|---|---|
| `observatory-main.jpg` | 16:9 | 1920×1080 | Hero shot of the primary observatory dome |
| `solar-observation.jpg` | 3:2 | 1200×800 | Solar telescope / sunspot imagery |
| `sky-map.jpg` | 1:1 | 1600×1600 | Star chart / sky map graphic |
| `telescope-01.jpg` … `telescope-04.jpg` | 3:2 | 1600×1067 | Telescope imagery gallery (4 images) |

Note: lunar phase icons are generated live with CSS/canvas (8 phases as a shadow overlay on a circle) — no image files needed for those.

## CALENDAR RESEARCH PAGE

Diagrams (timeline, temporal synchronization theory, equations) are built as inline SVG/CSS in code so they stay crisp and theme-aware (dark/light mode) — no raster images needed here unless you want to swap in hand-drawn versions later:

| Filename (optional) | Ratio | Size (px) |
|---|---|---|
| `calendar-diagram-01.jpg` | 3:2 | 1200×800 |
| `calendar-diagram-02.jpg` | 3:2 | 1200×800 |

## NEWS PAGE

| Filename | Ratio | Size (px) |
|---|---|---|
| `news-01.jpg` … `news-06.jpg` | 16:9 | 1200×675 |

## CONTACT PAGE

| Filename | Ratio | Size (px) | What to put |
|---|---|---|---|
| `campus-map.jpg` | 3:2 | 1200×800 | Illustrated/satellite-style map of the research campus (a live embed map can replace this if available) |

---

If a file is missing, the site should still render (use a solid Deep Space Blue placeholder with the BIASR monogram, same fallback pattern as the government site's flag/screenshot placeholders).
