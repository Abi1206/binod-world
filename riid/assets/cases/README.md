# Publishing a declassified case (manual, no backend)

Same workflow as `assets/press_releases/` and BIASR's `assets/publications/` — static files only, published by editing JSON and pushing to GitHub. This folder is the **open** (public) archive; the parallel folder for classified case files is `classified/assets/cases/` and uses the equivalent classification-level fields instead of `"classification": "DECLASSIFIED"`.

1. Copy the shape in `_TEMPLATE.json`.
2. Append the filled-in object to the array in `manifest.json`.
3. Push to GitHub — the Investigation Archive page and the Home page stats pick it up automatically.

Only cases explicitly approved for release should be added here — this file is public.
