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

Part angle photos are returned in each product's views metadata. The folder tree
does not define images of combinations of multiple selected products; those are
not synthesized. Existing local prepared views remain only for historical builds.
Marketing/login graphics and all original vehicle/brand assets remain in place.

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
