# Local car images

Files are read from `assets/List_Car/<Brand>/<Model> [Year].png` (also JPG/WebP/AVIF).
While `npm start` or `npm run watch` is running, a recursive file watcher automatically
regenerates `src/app/core/catalog/car-image-manifest.ts` when images are added,
replaced, renamed or removed, including new brand folders. Changes are debounced
and unchanged scans do not rewrite the manifest, avoiding rebuild loops.
Angular rebuilds/live-reloads the updated manifest during `npm start`.
Start/build also generate the initial manifest automatically. No Supabase/cache reset
is required because images are resolved locally from the existing model records.

Matching is exact after case/space/punctuation normalization, scoped to brand.
An optional leading brand in a filename is removed. The existing Haval file
`Dargon.png` is explicitly mapped to the dataset name `Dargo`; no general fuzzy
matching is used. `F8` does not match `F80`, and `488 GTB` does not match `488 Spider`.

The model overview uses the undated image when available, otherwise the newest
dated image as a representative. Generation cards use the exact source start
year, then an undated matching model image. A different year or body style is
not substituted. For example, Accord Coupe will not inherit Accord Sedan imagery.
Missing matches retain the existing gradient placeholder. No generations or years
are added to the database from image names (4Runner 2025 is a model-cover asset,
not a newly imported generation).

Images appear in model/generation cards, the selected car preview and saved
reference-build cards. Existing build snapshots remain unchanged; image paths are
resolved at render time. The files supplied by the user are preserved as-is.

Car images are supplied manually in `assets/List_Car`; no remote photo fallback is used. Each generated image URL includes
?v=<content SHA-256 prefix>, so replacing an image under the same filename
updates the browser cache as soon as the running watcher rebuilds the manifest.

Restart an already-running dev server once after this watcher feature is installed;
then adding images needs no extra terminal commands. Stop the dev server normally
to close the watcher too. Production builds remain static; new assets require a
new build/deployment. `npm run assets:cars` remains available as an optional manual
refresh, and `npm run test:assets` verifies watcher behavior in temporary folders.
