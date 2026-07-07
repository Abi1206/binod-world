# Publishing a RIID press release (manual, no backend)

This mirrors the government site's `assets/press_release/` workflow — everything is a static file, published by editing JSON and pushing to GitHub.

1. (Optional) Drop a PDF into this folder, named `RIID-PR-NNN.pdf`.
2. Open `manifest.json`.
3. Copy the shape in `_TEMPLATE.json`, fill in the fields, and append it to the array in `manifest.json` (this is the single source of truth `js/riid-data.js` reads at runtime).
4. Push to GitHub — the Press Releases page and the Home page "Latest Press Release" panel both pick up the new entry automatically. No build step, no server.

`file` is optional — if you don't have a PDF yet, leave it as `""` and fill in `content` (full text) or `summary` (short teaser) instead; the page renders whichever fields are present and hides the "View PDF" button when `file` is empty.
