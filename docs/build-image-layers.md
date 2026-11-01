# Build image layers

Create Build and My Builds thumbnails compose existing Storage images in the
browser. This uses Canvas 2D, not an AI model or an API generation request. Saving
still sends car/part IDs to the existing Build API; masks are catalog metadata,
not per-user copies. Discover and Liked cards and their detail dialogs use the same
compositor as My Builds, resolving saved `carId` and `partIds` against the cached
Storage catalog. Legacy builds without IDs keep their recorded cover. No generated
cover upload or SQL migration is required.

## Automatic clipping (current default for Civic FE)

Upload the same full-car angle photos as before. No drawn/uploaded mask or extra
file is required for the Civic / Civic FE / Civic 11 template. Matching is based on
the model name so it also works with the current test Storage brand folders.
`core/catalog/part-clip-regions.ts` contains normalized per-angle regions; other
models need their own calibrated profile rather than reusing Civic coordinates.

A selected full bumper photograph becomes the foundation. Wheels are clipped to
two ellipses, and the spoiler to its polygon, then drawn in stable order. Front and
rear selections affect only their own angles. A single full photograph needs no
compositing; Full Body Kits remain exclusive. Missing angle images or an unknown
model's clip profile remain explicit rather than silently hiding selections.

The browser uses its built-in Canvas 2D API, with no new library, model or API fee.
Automatic wheel composition now uses transparent vehicle bounds only to seed the
search. It refines each wheel independently using dark sidewall-edge contrast,
then maps that wheel patch to the corresponding base tire. Plain light body
panels around the arch are protected, so a wheel photo does not paste a second
fender onto the base car. Analysis runs at 512px and is cached by loaded image.
Low-contrast regions keep their calibrated position instead of inventing a shift.

Non-wheel layers keep their original frame and are scaled only for matching
resolution/aspect ratio. They are no longer stretched to the entire car's alpha
bounds: new bumpers/wings change those bounds and caused body seams. An explicit
custom mask/aligned frame, if present, keeps the exact prepared geometry.

Use matching camera, lighting and vehicle geometry. Local tire matching is a
heuristic, not perspective reconstruction or segmentation, and cannot make
inconsistent AI-rendered body panels identical. Same aspect ratio is required
for automatic composition. Different resolutions at that aspect are scaled to fit.

The fixed regions are approximate. A large/unusually shaped wing or wheel may
extend beyond them; adjust the profile or use the optional Admin region editor.
The original images and database rows are not modified by this automatic flow.

## Optional custom regions

The full-car photo, matching default photo, and mask must have exactly the same
canvas dimensions, camera, scale and vehicle position. Masks cannot correct
misaligned geometry, different lighting or shifted vehicles.

For example, store these together:

```text
Honda/Civic/Part/Front-Bumper/Mugen/Front-01/
  45_front.png
  45_front.mask.png
  45_front.layer.png
  front.png
  front.mask.png
```

A mask is a PNG with **alpha transparency**: transparent everywhere except the
region replaced by the part. White on an opaque black background does not work.
Include the full affected region and both old/new silhouettes, so removed edges
of a stock bumper can be erased. Soft transparent edges may be used sparingly.
Prepare a separate mask for each product and angle; do not reuse one blindly when
the part shape or occlusion changes. Wheels masks cover both visible wheels.
Spoiler masks must exclude bodywork that should remain in front of the spoiler.

Manual PNG mask upload has been removed. Use the source crop editor to generate
the mask and cutout together. Clearing a saved crop disables its prepared layer
for composition. Existing
saved masks still work; the old click-to-place-points editor has been removed.
These controls save immediately, independently of the outer Edit Part Save
button. Save photo/name edits and reopen before editing the region.

## Admin source crop editor

Admin → Edit Part → Wheels or Spoilers → each angle → **ปรับกรอบตัดภาพ**.
This replaces the previous point-drawing and spoiler-placement tools. The full original photo is
fixed in place: Admin moves/resizes the **source selection**, not the photo or the
part's destination. Wheel selections have two independent ellipses; spoilers have
a polygon/box. Drag the selection to move it, drag its lower-right handle to resize,
or use the position/size sliders and arrow keys. Additional regions can be added.

Civic FE presets are starting regions. Other models get editable generic starting
regions, so Admin can prepare them without a code-level profile. Check the cutout
preview and optional Default overlay before saving. The saved PNG retains the
source photo's original full canvas dimensions and pixel coordinates, with all
unselected areas transparent. Source and target car views still need consistent
framing; selecting a crop is not a camera/geometry alignment operation.

Save writes the clipped `.layer.png` plus `.mask.png` using the existing Storage
flow; the original source photo stays unchanged. The mask object's custom metadata
contains `cropEditor: {version:1, regions:[...]}`. Admin loads that metadata with
Storage `info()` to restore selections after refresh. No separate JSON object,
new database table, endpoint or SQL migration is needed. Old masks with no crop
metadata start from the preset/generic regions if the new editor is opened; no
stored image changes until Save.

A spoiler never becomes an unmasked foundation when a Default exists. With wheels
it is layered over Default; with a bumper, that bumper remains the foundation and
the spoiler is last. Prepared photo/mask pairs share pixel dimensions; the base
can have a different resolution at the same aspect ratio.

## Display rules

| View    | Applicable selected parts, back to front |
| ------- | ---------------------------------------- |
| front   | Front Bumper                             |
| front45 | Front Bumper, Wheels, Spoilers           |
| rear45  | Rear Bumper, Wheels, Spoilers            |
| rear    | Rear Bumper, Spoilers                    |

Full Body Kits stay exclusive. No photograph from a different angle is substituted.
All masked sources use the default as the base. If sources have no masks, one
complete source can serve as the base; additional unmasked selections are reported
as missing rather than covering each other. Missing angle photos are also reported.
Removing a part recomputes the composition, so its default pixels return.

The compositor clears each mask's region, clips that part's photo to the mask,
and paints it in a stable order. It validates image dimensions and alpha, limits
render resolution to 2048 px on the longest side, keeps up to 32 image promises,
and only presents a completed frame. Stale async renders cannot overwrite a newer
selection. If loading/CORS/mask validation fails, the base image and an explicit
error are shown. Storage images need anonymous CORS access for Canvas reads.

Mask changes use existing Storage cache notifications, versioned URLs, the server's
one-minute metadata cache, and the browser's five-minute metadata cache. Refresh
Catalog to explicitly reload. Original assets and database rows are untouched.
