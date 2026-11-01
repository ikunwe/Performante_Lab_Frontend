> New Builds are private by default. Owners can publish or unpublish them from My Builds → ตั้งค่าการเผยแพร่. Editing car/parts keeps the existing visibility.

> New User selections now use Storage path IDs. See [Storage user catalog](storage-user-catalog.md). The generated asset metadata below remains for historical reference-model builds only.

# Account builds

Create Build and My Builds now use the backend API; there is no localStorage write
fallback when a request fails. A failed save keeps the editor and selected parts
open. The UI shows loading/saving/deleting states and blocks duplicate writes.

Flow: Supabase access token -> backend validates token + Active profile -> verifies
car and parts using its own catalog -> saves to public.builds with the token's user
ID. GET/PUT/DELETE always filter by that user ID, even for an Admin account using
the personal Build API. Builds are private by default and deletion is soft deletion.
The frontend never receives or uses the backend secret key.

The existing schema is reused, without a new SQL migration:

| Database | API |
| --- | --- |
| id | id |
| title | name |
| tag | carId (stable model reference or demo car ID) |
| car_name | canonical car name |
| parts | selected part IDs |
| image_url | server-resolved asset cover URL |
| created_at / updated_at | createdAt / updatedAt |

The API reconstructs carSnapshot from its canonical model reference data. It never
trusts a client car name, snapshot, image URL, owner or publication setting. Historical
rows with unknown tags remain visible as basic snapshots; saving requires selecting
a supported car. Existing non-app rows are not rewritten or deleted automatically.

The generated `assets/build-catalog.json` contains public asset metadata (no image
bytes or secrets). The watcher and production prebuild generate this and also update
`../Performante_Lab_Backend/data/build-assets.json` when the sibling backend exists.
For separate deployment, commit/copy the matching data/build-assets.json to the API
alongside its model dataset. The API reads asset metadata on demand. Both apps must
deploy matching car/part IDs; missing assets cause validation failure, not guessed
compatibility. Backend needs SUPABASE_SECRET_KEY and the existing profiles/builds
tables. Restart the backend to load the new routes, and restart the frontend once
to load the updated watcher. No new environment keys or SQL execution are needed.

API: GET /api/builds?offset=0 (100 per page), POST /api/builds, PUT /api/builds/:id,
DELETE /api/builds/:id. Creates use a stable UUID per submitted payload so timeout
retries do not duplicate the build. Updates preserve identity/creation date.
Switching accounts clears the list and discards previous account's pending results.

Old local builds under performante-lab.builds.v1 remain untouched. They are not
automatically uploaded to an account because the old storage was not account-scoped.
Pricing, likes and image uploads are not part of this change; pictures
remain static assets and selected combinations retain their preview rules.


## Visibility settings

My Builds cards show the current private/public status and provide
ตั้งค่าการเผยแพร่. Changes are confirmed by the server before updating the UI;
failed requests retain the previous state and can be retried. Discover reloads
after successful visibility changes.

`PATCH /api/builds/:id/visibility` accepts `{ "isPublic": true | false }`.
It requires an Active owner's Bearer token, rejects non-boolean values, and
filters by authenticated user_id and is_deleted=false. It does not require the
vehicle to remain in the current catalog. Existing Builds keep their flag until
the owner changes it. No SQL migration or bulk data update is needed.


## Build categories

The User editor offers five part sections: Full Body Kits, Front Bumper, Rear Bumper, Wheels,
and Spoilers. Other product categories and existing saved parts are retained.

The save dialog selects Street / Track / Show for the Build's category. The value
is sent on create/update and returned on read, shown in My Builds, and used by
Discover filters. New Builds default to Street. Older clients omitting category
on an update keep the existing value. The database already has this column and
constraint; no migration is needed.
