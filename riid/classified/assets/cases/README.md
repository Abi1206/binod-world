# Publishing a classified case file (manual, no backend)

Same static-file, no-backend workflow as the public `assets/cases/` and `assets/press_releases/` folders — but this one lives inside `classified/`, and its records use the six-level classification scheme (`RESTRICTED` / `CONFIDENTIAL` / `SECRET` / `TOP SECRET` / `OMEGA`) instead of `DECLASSIFIED`. Field structure and section order (doc header → classification badge → meta grid → body sections → distribution restriction) follows the same pattern as the government's existing `docs/classified/classified.css` archive.

1. Copy the shape in `_TEMPLATE.json`.
2. Append the filled-in object to the array in `manifest.json`.
3. Push to GitHub — `case-file.html` and the Dashboard's operation counts pick it up automatically.

Reminder: this folder is not real access control (static site, no backend) — it is a roleplay-flavor gate matching the spec's own literal dev login credentials. Do not rely on it to hide anything sensitive in real life.
