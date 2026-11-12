-- Sets browse index: every set (a few thousand rows) as one compact jsonb array
-- so the /sets page can load once and filter/search by name + sport client-side
-- (the v1 model, but mobile-first). Sport comes from the set's organization.
-- Public catalog data → anon-granted, SECURITY DEFINER for a stable plan.
create or replace function public.sets_index()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'set_id', s.set_id,
      'name', s.name,
      'year', s.year,
      'slug', s.slug,
      'card_count', s.card_count,
      'series_count', s.series_count,
      'sport', o.sport,                 -- 'baseball' | 'football' | ... | null
      'org', o.abbreviation
    )
    order by s.year desc nulls last, s.name
  ), '[]'::jsonb)
  from public.set s
  left join public.organization o on o.organization_id = s.organization_id
  where s.slug is distinct from 'recovered-set-placeholder';
$$;
grant execute on function public.sets_index() to anon, authenticated;
