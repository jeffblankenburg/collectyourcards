-- Storage setup for collection photo uploads. APPLIED 2026-11-10 via the direct
-- `postgres` connection (SUPABASE_DIRECT_CONNECTION_STRING) — contrary to the old
-- note, postgres CAN create these policies even though storage.objects is owned by
-- supabase_storage_admin. Re-apply the same way if a migration/ run resets storage.
-- Symptom when missing: "new row violates row-level security policy" on upload
-- (the bucket can exist & be public, but public only grants READ — INSERT needs a policy).

-- Public bucket (served directly by next/image), 10MB cap, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-photos', 'card-photos', true, 10485760,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do nothing;

-- Per-user object access: the object path is `<collector_id>/<user_card_id>/<uuid>.<ext>`,
-- so foldername(name)[1] is the owner's collector_id. current_collector_id() is the
-- SECURITY DEFINER helper already granted to authenticated.
drop policy if exists card_photos_select on storage.objects;
create policy card_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'card-photos' and (storage.foldername(name))[1] = public.current_collector_id()::text);

drop policy if exists card_photos_insert on storage.objects;
create policy card_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'card-photos' and (storage.foldername(name))[1] = public.current_collector_id()::text);

drop policy if exists card_photos_update on storage.objects;
create policy card_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'card-photos' and (storage.foldername(name))[1] = public.current_collector_id()::text)
  with check (bucket_id = 'card-photos' and (storage.foldername(name))[1] = public.current_collector_id()::text);

drop policy if exists card_photos_delete on storage.objects;
create policy card_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'card-photos' and (storage.foldername(name))[1] = public.current_collector_id()::text);

-- Public bucket note: SELECT is open for serving images; the write policies above
-- still restrict insert/update/delete to the owning collector's folder.
