# Car viewing angles

Place stock photos in `assets/ListCar_view/<Brand>/<Model>/default/`.

| Filename | View |
| --- | --- |
| `45_front.png` | Front three-quarter (default) |
| `front.png` | Front |
| `side.png` | Side |
| `45_Back.png` or `45_rear.png` | Rear three-quarter |
| `Back.png` or `rear.png` | Rear |

Names are case-insensitive; spaces, underscores and hyphens are ignored when
matching view names. PNG, JPEG, WebP and AVIF are supported. Only the `default`
folder is treated as stock. Other folders are indexed as part variants. Unknown
image names are ignored; duplicate angles within a variant fail generation.

Use folders matching the part label (case, spaces, underscores and hyphens ignored):

```
ListCar_view/Honda/civic/
  default/          45_front.png, front.png, 45_Back.png, Back.png
    Wheel 1/        45_front.png, 45_Back.png
    Spoilers 1/     45_front.png, 45_Back.png, Back.png
  Front Bumper 1/   45_front.png, front.png
    Wheel 1/        45_front.png
    Spoilers 1/     45_front.png
  Rear Bumper 1/    45_Back.png, Back.png
    Wheel 1/        45_Back.png
    Spoilers 1/     45_Back.png, Back.png
```

The existing List_Part cover files remain the selectable options. A variant folder
must match that option's name; it does not create a new selectable part by itself.
Front views resolve the selected front bumper; rear views resolve the selected
rear bumper. Both can be selected and saved together without one side overwriting
the other. Full Body Kit still replaces separate parts.

Wheel 1's selectable cover is `List_Part/Honda/Civic/Wheel_1.png`. The nested
`Wheel 1` folders contain complete car photos for that combination, not wheel-only
overlays. Use `Wheel 2`, etc. for additional numbered options, matching the cover's
name. Legacy `Wheels 1` aliases are also read; prefer singular `Wheel 1` consistently.
The currently supplied folders have been renamed to singular without altering files.

Wheels affect front45 and rear45 only. With no bumper selected the resolver uses
`default/Wheel 1`; otherwise it uses `<selected bumper>/Wheel 1` for the viewed end.
Straight front/rear views remain bumper-specific. Selecting wheels preserves a
current 45-degree view; from a straight view it switches to front45. Removing
wheels restores the corresponding bumper or stock photo. Stock view lists exclude
nested wheel images, so they do not produce duplicate angle buttons.

Spoiler covers use `List_Part/Honda/Civic/Spoilers_1.png`. Both `Spoilers 1` and
`Spoiler 1` folders normalize to the same option. Spoilers affect front45, rear45
and rear, while straight front remains unchanged. Selecting a spoiler preserves
one of its supported angles, or switches to rear45 from straight front. Its cover
can only substitute for rear45 with no bumper selected.

To depict wheels and a spoiler together, add a complete prepared combination under
`<base>/Wheel 1/Spoilers 1/<angle>.png` (reverse nesting is also supported). Here
`<base>` is default, Front Bumper 1 or Rear Bumper 1. Do not store duplicate pictures
for the same option set in both nesting orders; the index rejects duplicates.
Without a combined picture, the largest available matching subset is displayed
with a missing-parts notice (wheels win a tie). A selected bumper is always retained;
an accessory picture for another bumper/default is never substituted. Thumbnails
and saved build covers share this same resolution behavior.

If an exact variant angle is missing, the matching List_Part cover is used only
for front45 (front bumper) or rear45 (rear bumper). Otherwise that angle shows the
stock picture with a notice if its relevant part is selected. Missing images never
borrow another option's image. Selecting a bumper preserves the current angle if
already viewing the same end, otherwise switches to that end's three-quarter view.
If a bumper/wheel combination is missing, the existing bumper photo is retained
with a notice that the preview does not depict all selected parts. No other
bumper's image is substituted to display wheels. A wheel cover can serve as its
front45 picture only when no bumper is selected. View thumbnails use the same
resolver as the main image. Changing views is a
display preference and does not mark the build as edited. Images depict the part
for the viewed end, not a newly generated composite of every selected part.

Models without views retain their existing `List_Car` fallback. Model-level views
are not assigned to saved builds that explicitly identify a generation. Saved
build thumbnails use the prepared image if available, otherwise the first stock
view. No database changes or image processing are required.

`npm start` and `npm run watch` watch this collection alongside List_Car and
List_Part. Restart a running dev server once after this watcher extension is
installed. File changes regenerate `car-view-manifest.ts`; content hashes refresh
browser image caches. Production needs a new build. `npm run assets:views` is an
optional manual refresh; production build generates it automatically.
