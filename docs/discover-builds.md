# Database Discover feed

Discover reads public.builds through GET /api/discover/builds?offset=0. It no longer
uses static showcase examples. The endpoint returns up to 100 records with nextOffset;
the frontend follows pages so its search/category/bookmark filters cover the loaded
feed, with a bounded maximum offset of 10000. Latest records sort first by created_at,
then ID. Responses use Cache-Control: no-store and are not persisted in localStorage.

Without a token, only is_public=true and is_deleted=false records are returned.
With a verified Active account token, public records plus that user's own private
records are returned. Another user's private records remain hidden, including from
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
