-- Storage for ADMIN-managed catalog card images (cutover workstream #27).
-- Apply via the direct `postgres` connection (same as collection_photos.sql —
-- postgres CAN create storage.objects policies). Public read (served by
-- next/image); write restricted to admins via is_admin(). Path convention:
-- `cards/<card_id>/<front|back>.jpg`. Existing Azure-hosted image URLs are
-- untouched — this only governs new uploads to the Supabase bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-images', 'catalog-images', true, 10485760,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may read (public catalog imagery).
drop policy if exists catalog_images_select on storage.objects;
create policy catalog_images_select on storage.objects for select to public
  using (bucket_id = 'catalog-images');

-- Only admins may write. is_admin() is the SECURITY DEFINER helper (db/app/009)
-- granted to authenticated; it reads profiles.role for the caller's auth.uid().
drop policy if exists catalog_images_insert on storage.objects;
create policy catalog_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'catalog-images' and public.is_admin());

drop policy if exists catalog_images_update on storage.objects;
create policy catalog_images_update on storage.objects for update to authenticated
  using (bucket_id = 'catalog-images' and public.is_admin())
  with check (bucket_id = 'catalog-images' and public.is_admin());

drop policy if exists catalog_images_delete on storage.objects;
create policy catalog_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'catalog-images' and public.is_admin());
