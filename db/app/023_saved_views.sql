-- Saved views: a named, shareable snapshot of the collection screen's filter +
-- sort + search + view-mode state. Mirrors the lists workstream (014) for owner
-- RLS, but is STRICTER: there is NO anon/public table SELECT — a view's `config`
-- can reveal private collection structure (location ids, price sort keys), so all
-- public reads go exclusively through the SECURITY DEFINER RPCs in 024.
-- Re-apply via `npm run db:app`.

create table if not exists public.saved_view (
  saved_view_id bigint generated always as identity primary key,
  user_id     bigint not null,                       -- collector_id (no hard FK, like user_list)
  name        text   not null,
  slug        text,                                   -- optional pretty alias (per-user unique)
  -- 122-bit non-guessable token; gen_random_uuid() is core (no pgcrypto dependency).
  share_token text   not null default replace(gen_random_uuid()::text, '-', ''),
  is_public   boolean not null default false,
  config      jsonb  not null,                        -- versioned {v,filters,sort,search,view,valueMode}
  created     timestamptz not null default now(),
  updated     timestamptz not null default now()
);

create unique index if not exists ux_saved_view_token on public.saved_view (share_token);
create unique index if not exists ux_saved_view_user_slug on public.saved_view (user_id, slug) where slug is not null;
create index        if not exists ix_saved_view_user on public.saved_view (user_id);

alter table public.saved_view enable row level security;
grant select, insert, update, delete on public.saved_view to authenticated;
-- NOTE: no grant to anon. Public visibility is RPC-only (024).

-- RLS: owner-only across every verb. (Public reads never touch the table.)
drop policy if exists p_sv_sel on public.saved_view;
create policy p_sv_sel on public.saved_view for select to authenticated
  using (user_id = public.current_collector_id());
drop policy if exists p_sv_ins on public.saved_view;
create policy p_sv_ins on public.saved_view for insert to authenticated
  with check (user_id = public.current_collector_id());
drop policy if exists p_sv_upd on public.saved_view;
create policy p_sv_upd on public.saved_view for update to authenticated
  using (user_id = public.current_collector_id())
  with check (user_id = public.current_collector_id());
drop policy if exists p_sv_del on public.saved_view;
create policy p_sv_del on public.saved_view for delete to authenticated
  using (user_id = public.current_collector_id());

-- ---------------------------------------------------------------------------
-- Owner RPCs (mirror list_create / my_lists). Let a client island save/apply
-- views without knowing its own collector_id.
-- ---------------------------------------------------------------------------

-- Create (p_id null) or update (p_id set, ownership-checked) a view. Returns the id.
create or replace function public.saved_view_upsert(
  p_id bigint, p_name text, p_config jsonb,
  p_is_public boolean default false, p_slug text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_me bigint := public.current_collector_id(); v_id bigint; v_slug text := nullif(trim(p_slug), '');
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'view name required'; end if;
  if jsonb_typeof(p_config) is distinct from 'object' then raise exception 'config must be an object'; end if;

  if p_id is null then
    insert into public.saved_view (user_id, name, slug, is_public, config)
    values (v_me, trim(p_name), v_slug, coalesce(p_is_public, false), p_config)
    returning saved_view_id into v_id;
  else
    update public.saved_view
       set name = trim(p_name), slug = v_slug, is_public = coalesce(p_is_public, false),
           config = p_config, updated = now()
     where saved_view_id = p_id and user_id = v_me
    returning saved_view_id into v_id;
    if v_id is null then raise exception 'view not found'; end if;
  end if;
  return v_id;
end $$;
grant execute on function public.saved_view_upsert(bigint, text, jsonb, boolean, text) to authenticated;

-- The caller's own views (returns config so the collection UI can apply directly).
create or replace function public.my_saved_views()
returns table (saved_view_id bigint, name text, slug text, share_token text,
               is_public boolean, config jsonb, created timestamptz, updated timestamptz)
language sql stable security definer set search_path = public as $$
  select saved_view_id, name, slug, share_token, is_public, config, created, updated
    from public.saved_view
   where user_id = public.current_collector_id()
   order by updated desc;
$$;
grant execute on function public.my_saved_views() to authenticated;

create or replace function public.saved_view_delete(p_id bigint)
returns void language sql security definer set search_path = public as $$
  delete from public.saved_view where saved_view_id = p_id and user_id = public.current_collector_id();
$$;
grant execute on function public.saved_view_delete(bigint) to authenticated;

-- Rotate the share token (revoke a leaked link). Returns the new token.
create or replace function public.saved_view_rotate_token(p_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare v_tok text;
begin
  update public.saved_view
     set share_token = replace(gen_random_uuid()::text, '-', ''), updated = now()
   where saved_view_id = p_id and user_id = public.current_collector_id()
  returning share_token into v_tok;
  if v_tok is null then raise exception 'view not found'; end if;
  return v_tok;
end $$;
grant execute on function public.saved_view_rotate_token(bigint) to authenticated;
