# Images Needed — RIID Website (place files directly in this folder)

Applies to both the public portal (`riid/`) and the Classified Network (`riid/classified/`, which reads from this same `../assets/images/` folder via relative paths). If a file is missing, the site still renders — every `<img>` has an `onerror` fallback (icon tile, initials seal, or a diagonal-stripe placeholder), matching the fallback pattern used across the rest of the site.

## REQUIRED (core identity — site looks broken without these)

| Filename | Status | What it is |
|---|---|---|
| `logo.png` | ✅ Provided | Dedicated RIID seal (eagle crest, "RIID Special Forces") — header/footer/login logo |
| `seal.png` | ✅ Provided | Detailed RIID seal variant (four-pillar icons: research/investigation/justice/defense) — letterhead-style use |
| `favicon.png` | ✅ Provided | Simplified RIID crest — browser tab icon |
| `og-image.png` | ✅ Provided | RIID crest — social share card |
| `hero-bg.png` | ✅ Provided | RIID Headquarters at night, helicopters overhead — Home page hero background |
| `hq-construction-01.png` | ✅ Provided | Groundbreaking-stage construction site render, 07 July 2026 |
| `hq-construction-02.png` | ✅ Provided | Stage 02 — Foundation construction render, target 21 July 2026 |
| `hq-concept-render.png` | ✅ Provided | Finished RIID Headquarters — front gate concept render |

## ABOUT PAGE

| Filename | Ratio | Size (px) | What to put |
|---|---|---|---|
| `director-portrait.jpg` | 4:5 | 800×1000 | RIID Director's official portrait (optional — the Org Chart currently renders as text nodes, no image required) |
| `deputy-director-portrait.jpg` | 4:5 | 800×1000 | Deputy Director's official portrait (optional) |

## INVESTIGATION ARCHIVE

Case imagery is optional — cases are managed via `assets/cases/manifest.json`, and the `images` array in each entry is currently empty. Add filenames there once you have images, e.g.:

| Filename (suggested) | Ratio | Size (px) |
|---|---|---|
| `case-black-ash-01.jpg` | 3:2 | 1200×800 |
| `case-black-ash-map.jpg` | 3:2 | 1200×800 |

## MOST WANTED

| Filename | Ratio | Size (px) | What to put |
|---|---|---|---|
| `wanted-01.png` | 3:4 | 900×1200 | Minecraft skin render / profile image for "The Fabricator" |
| `wanted-02.png` | 3:4 | 900×1200 | Minecraft skin render / profile image for "Ghost Runner" |

## RECRUITMENT PAGE

Currently text-only (icon tiles for each track) — no images required unless you want to add photography later:

| Filename (optional) | Ratio | Size (px) |
|---|---|---|
| `academy.jpg` | 3:2 | 1200×800 |
| `training.jpg` | 3:2 | 1200×800 |

## NEWS PAGE

Currently emoji/icon placeholders per card — no images required unless you want to swap in real screenshots:

| Filename (optional) | Ratio | Size (px) |
|---|---|---|
| `news-01.jpg` … `news-06.jpg` | 16:9 | 1200×675 |

## CLASSIFIED PORTAL

Evidence Vault items are currently emoji/icon placeholders (matching the classified aesthetic — most "evidence" should look like case material, not stock photography). If you want real imagery:

| Filename (optional) | Ratio | Size (px) | What to put |
|---|---|---|---|
| `case-file-evidence-01.jpg` … `04.jpg` | 4:3 | 1200×900 | Device teardown / evidence photography for RIID-C-2026-0011 |
| `intel-map-base.jpg` | 1:1 | 1600×1600 | Optional base texture/screenshot for the Intelligence Map placeholder panel |

---

Press releases (`assets/press_releases/manifest.json`) and case files (both `assets/cases/manifest.json` and `classified/assets/cases/manifest.json`) are managed as JSON, not images — see the `README.md` in each of those folders for the no-backend publishing workflow (same pattern as the government portal's `assets/press_release/` and BIASR's `assets/publications/`).
