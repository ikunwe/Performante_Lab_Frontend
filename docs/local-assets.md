# Frontend assets after the Storage migration

The `assets/` directory now contains only:

- `Logo_Performante_Lab.png`: site branding in User/Admin headers.
- `car_pic.png`: Home hero.
- `car_pic_loginpage.jpg`: Login visual.

Catalog vehicle/brand/part images and per-angle previews come from the existing
Supabase `catalog` bucket via `GET /api/catalog/storage`. The shared cache and
Canvas part composition remain intact. The following local catalog sources were
removed: `List_Car`, `ListCar_view`, `List_Part`, `brands`, generated build metadata,
and the manifest/watch/download scripts. `npm start` now runs Angular directly;
`npm run build` only generates auth config before building. There is no catalog
write to the sibling backend on start/build.

Current model images, available angles and part selection use cloud metadata only.
Old Build records stay in the database; a removed local-only image is unavailable
rather than replaced with a different vehicle. Select a current Storage item to
update such a Build. Test fixtures use synthetic URLs; no real image files or
Supabase writes are needed to run unit tests.

No Supabase image, bucket, database row, backend dataset or file in `Photo_Edit`
was removed. Restart an already running frontend to drop its old asset watcher.
