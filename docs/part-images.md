# Prepared part previews

Add complete, prepared car pictures to:

```
assets/List_Part/<Brand>/<Model>/Front Bumper_1.png
assets/List_Part/<Brand>/<Model>/Front Bumper_2.png
```

Example: `assets/List_Part/Honda/Civic/Front Bumper_1.png`.
Each picture must show the car with that option already installed. These are not
transparent part-only overlays. PNG, JPG, WebP and AVIF are supported. The original
stock picture remains in `assets/List_Car/Honda/civic.png`.

The filename must start with Front Bumper, Rear Bumper, Full Body Kit, Body Kit,
Wheel or Spoiler (spaces, underscores and hyphens are ignored for category matching).
The rest of its name labels the option. Brand/model matching is exact after ignoring
case, spaces and punctuation. No model-level image is applied to legacy builds
that specify a generation, because the file does not establish generation fitment.

During `npm start` or `npm run watch`, additions, replacements, renames and removals
automatically regenerate `src/app/core/catalog/part-image-manifest.ts`. Restart a
dev server that was running before this feature was installed once to activate the
new watcher. Production assets require a rebuild/deployment.

The builder lists matching files as options. Selecting one changes the main image;
selecting it again restores the stock view. Another option in the same category
replaces the previous one. Saved local builds retain the option ID, and My Builds
uses its prepared preview. Full Body Kits remain exclusive of separate parts.

For additional angles, add a folder with the option name under
`assets/ListCar_view/<Brand>/<Model>/`, e.g. `Front Bumper 1/front.png` or
`Rear Bumper 1/Back.png`. See `car-views.md` for the complete layout. Existing cover
files do not need to move, so saved part IDs remain stable.

Front Bumpers change front/front45 views only; Rear Bumpers change rear/rear45
views only. The two options can coexist; changing one does not replace the other
end's pictures. Exact matching variant-angle images take precedence, with the
cover used only at its known three-quarter angle. Other missing angles retain the
stock image and display a notice. No AI processing or automatic image compositing
occurs. Front/rear option cards zoom in on the corresponding end of the car.

Wheel option cards zoom in on the front wheel in the supplied car image. Wheels
update front45/rear45 previews using nested combination folders, for example
`ListCar_view/Honda/civic/default/Wheel 1/45_front.png` and
`ListCar_view/Honda/civic/Rear Bumper 1/Wheel 1/45_Back.png`. Use complete prepared
car images in those folders. See `car-views.md` for missing-combination behavior.

Spoiler option cards zoom into the rear wing. `Spoilers_1.png` uses matching
`Spoilers 1` subfolders beneath default or a bumper variant in ListCar_view.
Front45, rear45 and rear angles are supported; front stays unchanged. A wheel and
spoiler combination requires its own nested prepared photo, e.g.
`Rear Bumper 1/Wheel 1/Spoilers 1/45_Back.png`. Missing combinations are explicitly
marked as incomplete previews rather than represented as having every part.

Replacing a file keeps its part ID but changes its content-hashed URL to refresh the
browser cache. Renaming a file changes its ID; avoid renaming/removing options used
by saved builds. The existing local-build validator requires selected options to
remain available. Unknown filename prefixes are ignored rather than guessed.

`npm run assets:parts` manually refreshes the index. Start, watch and production
builds refresh it automatically. `npm run test:assets` checks the file watcher.
