# User catalog from the catalog bucket

The User Catalog, Compare, and Create Build brand/model/part pickers use the same
Storage tree as the merged Admin interface. No catalog rows are imported or written
by this feature. There are no new migrations or required keys.

## Source

- Brand: `catalog/{Brand}/logo.png` (also jpg/jpeg/webp/svg/avif).
- Model: `catalog/{Brand}/{Model}/45_front.jpg`, `front.png`, `45_Back.png`,
  `Back.png` (same image formats). `CarPicture.*` remains supported for old models.
- New Admin full kit: `{Brand}/{Model}/BodyKit/{Manufacturer}/{Kit}/{angle}.*`.
- New Admin part: `{Brand}/{Model}/Part/{Category}/{Manufacturer}/{Part}/{angle}.*`.
  Categories include Front-Bumper, Rear-Bumper, Wheels, Spoilers, Brakes, Exhaust,
  and Suspension. Each product folder becomes one item with its available views.
- Full body kit: `{Brand}/{Model}/BodyKit/{Manufacturer}/{Name}.png`.
- Separate part: `{Brand}/{Model}/Part/{Manufacturer}/{Name}.png`.
- Manufacturer `logo.*` is excluded from product cards.

A brand with a logo can exist before it has models. A model is listed when it has a recognized angle image or a legacy CarPicture file. Old random-ID upload namespaces without a brand logo or
recognized model folders are ignored. No files are uploaded, moved, or deleted by
reading the catalog. Folder and file names are the identities; renaming a path
changes its identity. Replacing bytes at the same path retains its identity.

`BodyKit` always means a complete exterior kit. It cannot be combined with separate
parts. For `Part`, filenames classify Front-Bumper/Front-Lip, Rear-Bumper/Rear-Diffuser,
Wheel, Spoiler/Wing, Brake/Caliper/Rotor, Exhaust, or Suspension/Coilover. Unrecognized
products appear under Other Parts rather than an invented category.

Vehicle cover priority is 45_front, front, 45_Back, Back, side, then CarPicture.
Available angles feed the User build view selector. Each image URL points to the
exact Storage file and includes its updated_at version. Nested product folders
are grouped into one item rather than displaying every camera angle as a part.
Legacy flat product-image files remain supported with unchanged IDs.

Part angle photos are returned in each product's views metadata. For full-car
photos, optional `{angle}.mask.png` files in the same product folder are returned
as `masks`. Admin can draw these regions directly on the existing photo. Optional
`{angle}.layer.png` aligned frames are returned as `layerViews`. Neither auxiliary
file becomes a catalog product or cover photo. Create Build uses
these optional masks to replace only each selected part's region in the matching
angle. Civic FE also has automatic angle/category clipping profiles, so its normal
full-car photos can be composed without uploading or drawing masks. The browser
normalizes transparent photo framing before clipping; no catalog file is written.
The frontend local catalog images and prepared-view manifests have been removed. See
[build-image-layers.md](build-image-layers.md) for preparation and limits.
Marketing/login graphics remain local. Vehicle/brand/part photos are supplied only
by Storage metadata. See [Local asset cleanup](local-assets.md).

## Implementation

- Backend `src/services/storage-catalog.js`: paginated Storage tree reader, stable
  path IDs, updated_at image URL versions, six concurrent Storage reads at most.
- `GET /api/catalog/storage`: one-minute server metadata cache and coalesced reads.
  `?refresh=1` explicitly reloads Storage.
- Frontend `core/catalog/storage-catalog.ts`: shared five-minute memory/localStorage
  metadata cache, in-flight coalescing, stale/error state and cross-tab invalidation.
- BrandDirectory/ModelDirectory project that shared snapshot. No hardcoded model or
  brand allowlist is used in the User picker.
- Admin's existing CatalogStorageHelper uploads notify the User cache. Other devices
  refresh on expiry or via the Catalog refresh button. Images use browser HTTP cache;
  replacement uploads have versioned URLs derived from their Storage updated_at.
- Build API validates new Storage car/part IDs from a fresh server-side Storage read.
  Ownership, account status and Full Body Kit rules remain enforced. Historical
  reference-model Build validation remains supported.

Both applications need the updated code. Restart Backend after changing routes.
The frontend API_BASE_URL must point to that Backend. Supabase files remain in the
existing `catalog` bucket and no database catalog table is required for display.


## Brand display names

Admin saves a brand's edited display name as `brandDisplayName` in the logo
object's custom Storage metadata. The Admin list and backend Storage catalog read
this label. Folder names, car/part IDs and existing build references remain stable;
subsequent Admin uploads still use the original brand folder (`storagePath`).
No SQL migration is required. A brand needs a logo to persist its display name.


Workshop/part-brand names follow the same stable-folder rule. The existing
workshop logo stores `workshopDisplayName`; workshops without a logo get a tiny
transparent `logo.png` metadata carrier marked `workshopPlaceholderLogo` (not
shown as a product or brand logo). Admin keeps the physical manufacturer key and
category-specific workshop path for all subsequent uploads and edits. User
Catalog/Compare read the display name from the backend. No old folders are moved
or deleted, and part IDs and saved Build references remain unchanged.


Deleting a car brand in Admin removes only its catalog Storage folder. It does
not delete `car_brands` or `car_brand_reference` rows. An empty Storage catalog
stays empty on refresh; it is not repopulated from reference-table fallbacks.
Storage errors keep the current brand visible and return a failure.


## Part crop and placement editor

Admin → Edit Data → edit a Wheels/Spoilers image → **ตัดภาพ / จัดวาง**.
Crop mode edits source regions. Placement mode drags each region on the Default
image and independently adjusts uniform scale and rotation around its crop centre.
Offsets are fractions of the full image, so coordinates scale with resolution.
Preview opacity is temporary and is not saved in the output images.

Each angle keeps its own `{angle}.mask.png` and `{angle}.layer.png`. Both exported
frames contain the same baked placement transformation; User Build previews,
My Builds and Discover continue using the existing compositor without applying a
second transform. The original full-car image is untouched. Regions moved outside
the canvas are clipped; placement aligns existing pixels and does not generate
missing bodywork or remove visible stock parts outside the replacement footprint.

The mask object's custom Storage metadata stores
`cropEditor: { version: 2, regions, placements }`. Each placement has normalized
`x/y`, uniform `scale` and `rotation` in degrees, one entry per crop region.
Reopening restores both modes; version 1 crops reopen with identity placements.
No SQL migration, AI service or new package is required.


### Foundation-specific placement

Before opening the crop editor, Admin can choose **จัดวางสำหรับภาพฐาน**:
Default/general placement, or a Front Bumper (front angles) / Rear Bumper (rear
angles) from the same model with a full photo in that angle. The editor displays
the chosen foundation photograph rather than Default. Each foundation retains
its own crop geometry and placement; saving it does not overwrite the general
frames or another foundation. Full Body Kits remain exclusive to other parts.

Foundation variants live next to the part's original images:
`{angle}.on-{foundationPartIdHash}.layer.png` and
`{angle}.on-{foundationPartIdHash}.mask.png`. The mask retains editable version 2
crop metadata. The Storage catalog groups these as `placementVariants` by stable
foundation part ID, excluding derived files from product/cover images. Only
complete pairs with a mask at least as new as its frame are exposed.

The shared Build layer planner uses a variant only when both the actual selected
full-photo foundation and viewing angle match; otherwise it uses general frames
or the existing automatic cropping fallback. This applies to Build Preview,
My Builds, User/Admin Discover, and Liked. Existing saved Build IDs are unchanged.
Deploy both Frontend and Backend; no SQL or new bucket is required.


Placement also supports independent `scaleX`/`scaleY` stretch factors (default 1
for older metadata), multiplied by the overall scale. Drag the right/bottom handles
for one axis or the corner for both; the sliders support precise adjustments.
Rotation-aware handles stretch in the part's local axes around its crop centre.
Both exported layer and mask use exactly the same stretch. The **ซ่อนกรอบ** toggle
hides crop/placement guides and handles only; the preview image and saved settings
are unaffected, and guides are never exported.


The editor workspace supports 100–400% zoom, fit-to-frame and a drag-to-pan mode.
Zoom enlarges the display stage inside a scroll viewport only. Crop/placement
pointers use the enlarged SVG bounding box; exports and stored coordinates still
use the original full-resolution frame. Zoom and pan are temporary view settings.
