> New Builds are private by default. Owners can publish or unpublish them from My Builds → ตั้งค่าการเผยแพร่. Editing car/parts keeps the existing visibility.

# Database Discover feed

Discover reads public.builds through GET /api/discover/builds?offset=0. It no longer
uses static showcase examples. The endpoint returns up to 100 records with nextOffset;
the frontend follows pages so its search/category/bookmark filters cover the loaded
feed, with a bounded maximum offset of 10000. Latest records sort first by created_at,
then ID. Responses use Cache-Control: no-store and are not persisted in localStorage.

Without a token, only is_public=true and is_deleted=false records are returned.
With a verified Active account token, only public records are returned, including
the viewer's own public Builds. Private Builds remain in My Builds only. Another user's private records remain hidden, including from
an Admin using this personal Discover endpoint. No user_id query parameter is trusted.
The service-role client always applies explicit visibility filters before reading rows.

Author display names come from profiles.username; contact details, user IDs, tokens
and emails are not sent to the feed. Storage product names/covers are resolved when
available; recorded covers remain usable if product-name lookup fails. Unavailable
products get a clear label instead of displaying internal hashed part IDs.

Cards show own/private badges and recorded budgets. Zero/default budget is shown as
unspecified. Original is_public values are preserved; saving a build does not publish
it automatically. Existing private builds appear only for their owner after login.

The frontend clears private rows and open details on account change, ignores old
in-flight responses, and reloads after successful Build saves/deletes or returning
to Discover. There is also a refresh button. Failed refreshes retain only the same
account's last successful rows and show an error. An initial error never inserts
sample cards. The database schema and existing Build ownership/delete rules are unchanged.

Restart Backend to register the new route. No SQL migration is required.


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


## Navigation cache

The shared feed store reuses an account-scoped memory snapshot for five minutes,
including empty results. Switching workspace routes does not refetch a fresh
snapshot. Manual refresh bypasses the TTL; save/delete/visibility changes invalidate
it immediately. Concurrent loads share a request. Logout/account changes clear
private snapshots and abort obsolete requests; nothing is persisted to localStorage.
The workspace initializes its ready state from the restored AuthService state to
avoid briefly replacing a cached feed with initial-loading placeholders.
