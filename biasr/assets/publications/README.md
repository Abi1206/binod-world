# Publishing a paper (manual, no backend)

This mirrors the government site's `assets/press_release/` workflow — everything is a static file, published by editing JSON and pushing to GitHub.

1. Drop the PDF in this folder, named `BIASR-YYYY-NNN.pdf`.
2. Copy `_TEMPLATE.json`, fill in the fields, and append the object to `manifest.json` (the array in this folder — this is the single source of truth the Publications page reads at runtime).
3. Commit both files and push. GitHub Pages serves the new PDF and the Publications page picks up the new entry on next load — no build step, no server.

Citation and DOI fields are display-only text (not resolvable), consistent with how the rest of the site has no live backend.
