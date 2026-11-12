-- Card-image management (cutover workstream #27). Admin sets a catalog card's
-- front/back image path. Mirrors the old app's admin-cards image upload, but the
-- bytes land in Supabase Storage (bucket `catalog-images`, see
-- db/storage/catalog_images.sql) and this RPC records the resulting public URLs.
-- The UI uploads first, then calls this with the final desired paths for BOTH
-- sides (unchanged side passes its current value), so a single update is atomic.
create or replace function public.admin_set_card_images(
  p_card_id bigint, p_front_image_path text, p_back_image_path text)
returns bigint language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.card
     set front_image_path = p_front_image_path,
         back_image_path  = p_back_image_path
   where card_id = p_card_id;
  if not found then raise exception 'card % not found', p_card_id using errcode='P0002'; end if;
  perform public.log_admin('set_images','card',p_card_id::text,null,
    jsonb_build_object('front', p_front_image_path is not null, 'back', p_back_image_path is not null));
  return p_card_id;
end; $$;
grant execute on function public.admin_set_card_images(bigint,text,text) to authenticated;
