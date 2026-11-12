-- Public profile identity columns on profiles. Split out ahead of the view-
-- sharing RPCs (024) which reference profiles.username, and the profile RPCs
-- (025) which manage these fields. Columns only here; behavior lives in 025.
create extension if not exists citext;

alter table public.profiles
  add column if not exists username           citext,
  add column if not exists is_public_profile  boolean not null default false,
  add column if not exists bio                text,
  add column if not exists avatar_url         text;

-- Case-insensitive uniqueness, but allow many NULLs (users who never pick one).
create unique index if not exists ux_profiles_username on public.profiles (username)
  where username is not null;
