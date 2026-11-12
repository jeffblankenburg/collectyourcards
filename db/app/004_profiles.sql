-- Identity bridge between Supabase Auth (auth.users.id uuid) and the collection
-- data (user_card.user_id bigint -> legacy public."user"). A profile is 1:1 with
-- an auth user and carries the bigint collector_id.

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  collector_id  bigint,            -- legacy "user".user_id; plain bigint (no hard FK:
                                    -- a catalog re-migrate must never cascade into identity)
  phone         text,
  display_name  text,
  role          text not null default 'user',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists ux_profiles_collector on public.profiles (collector_id);

alter table public.profiles enable row level security;
grant select, update on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated, anon;  -- inserts via trigger only

-- ---------------------------------------------------------------------------
-- Owner link: set this to Jeff's real E.164 phone so his existing 12,602-card
-- collection (legacy user_id = 1) attaches on his first OTP sign-in. Until it's
-- set, Jeff just gets a fresh empty collection like any new user; you can also
-- run the one-off UPDATE at the bottom after he signs in.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_digits constant text := '16143275066';  -- owner's phone, digits only (E.164 w/o +)
  v_phone text := coalesce(new.phone, new.raw_user_meta_data->>'phone');
  v_name  text := coalesce(new.raw_user_meta_data->>'display_name', v_phone);
  v_collector_id bigint;
begin
  -- Compare digits-only so '+1614…', '1614…', '(614)…' all match.
  if v_phone is not null and regexp_replace(v_phone, '\D', '', 'g') = v_owner_digits then
    v_collector_id := 1;                     -- bind to the owner's legacy row (12,602 cards)
  else
    insert into public."user"
      (name, role, is_active, is_verified, login_attempts, is_public_profile, profile_completed, is_muted, created, created_at, updated_at)
    values
      (v_name, 'user', true, true, 0, false, false, false, now(), now(), now())
    returning user_id into v_collector_id;
  end if;

  insert into public.profiles (id, collector_id, phone, display_name, role)
  values (new.id, v_collector_id, v_phone, v_name,
          case when v_collector_id = 1 then 'admin' else 'user' end)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- STABLE SECURITY DEFINER so RLS evaluates it ONCE per query (not per row) and it
-- can read profiles without tripping profiles' own RLS.
create or replace function public.current_collector_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select collector_id from public.profiles where id = auth.uid()
$$;
grant execute on function public.current_collector_id() to authenticated;

-- One-off owner link fallback (uncomment + set phone, run once after Jeff signs in):
-- update public.profiles set collector_id = 1, role = 'admin' where phone = '+1XXXXXXXXXX';
