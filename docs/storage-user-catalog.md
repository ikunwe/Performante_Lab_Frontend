# User catalog from the catalog bucket

The User Catalog, Compare, and Create Build brand/model/part pickers use the same
Storage tree as the merged Admin interface. No catalog rows are imported or written
by this feature. There are no new migrations or required keys.

## Source

- Brand: `catalog/{Brand}/logo.png` (also jpg/jpeg/webp/svg/avif).
- Model: `catalog/{Brand}/{Model}/CarPicture.jpg` (same image formats).
- Full body kit: `{Brand}/{Model}/BodyKit/{Manufacturer}/{Name}.png`.
- Separate part: `{Brand}/{Model}/Part/{Manufacturer}/{Name}.png`.
- Manufacturer `logo.*` is excluded from product cards.

A brand with a logo can exist before it has models. A model is listed when its
CarPicture file exists. Old random-ID upload namespaces without a brand logo or
CarPicture model folders are ignored. No files are uploaded, moved, or deleted by
reading the catalog. Folder and file names are the identities; renaming a path
changes its identity. Replacing bytes at the same path retains its identity.

`BodyKit` always means a complete exterior kit. It cannot be combined with separate
parts. For `Part`, filenames classify Front-Bumper/Front-Lip, Rear-Bumper/Rear-Diffuser,
Wheel, Spoiler/Wing, Brake/Caliper/Rotor, Exhaust, or Suspension/Coilover. Unrecognized
products appear under Other Parts rather than an invented category.

CarPicture is the vehicle cover. Product images appear in Catalog/Compare/pickers.
This tree does not define camera angles or prepared multi-part installation photos;
those are not synthesized from individual product images. Existing local prepared
views are retained only for historical reference-model builds, not as the source of
new Storage vehicle selections. Marketing/login graphics remain local assets.

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
