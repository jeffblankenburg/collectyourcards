-- Public profile identity columns on profiles. Split out ahead of the view-
-- sharing RPCs (024) which reference profiles.username, and the profile RPCs
-- (025) which manage these fields. Columns only here; behavior lives in 025.
create extension if not exists citext;

alter table public.profiles
  add column if not exists username           citext,
  add column if not exists first_name         text,
  add column if not exists last_name          text,
  add column if not exists is_public_profile  boolean not null default false,
  add column if not exists bio                text,
  add column if not exists avatar_url         text;

-- A display label that is SAFE to show publicly: real name if we have one, else
-- a non-phone display_name, else null (caller falls back to @username / generic).
-- display_name defaults to the phone number at signup, so it must be filtered.
create or replace function public.safe_display_name(
  p_first text, p_last text, p_display text, p_phone text
) returns text
language sql immutable set search_path = public as $$
  select coalesce(
    nullif(trim(coalesce(p_first,'') || ' ' || coalesce(p_last,'')), ''),
    case
      when p_display is not null
       and p_display is distinct from p_phone
       and p_display !~ '^[+(]?[0-9][0-9 ()\-]{5,}$'   -- not a phone-looking string
      then p_display
    end
  );
$$;

-- Case-insensitive uniqueness, but allow many NULLs (users who never pick one).
create unique index if not exists ux_profiles_username on public.profiles (username)
  where username is not null;
