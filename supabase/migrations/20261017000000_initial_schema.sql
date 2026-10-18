-- Holler step 2: tables, PostGIS, Row Level Security, 12 categories.
-- Paste this whole file into Supabase > SQL Editor and click Run. Safe to run once on a fresh project.
--
-- Privacy model: browsers (anon / authenticated roles) never touch households,
-- other people's profiles or raw vouches. Public numbers come from security-definer
-- functions like pros_near(), which only return counts. Writes that need trust rules
-- go through the server with the service role key.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  address text not null,                                   -- private
  location extensions.geography(Point, 4326) not null,     -- private, exact
  display_location extensions.geography(Point, 4326),      -- fuzzed ~150 m cell, set by trigger
  neighborhood text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  first_name text not null check (char_length(first_name) between 1 and 40),
  last_initial text not null check (char_length(last_initial) = 1),
  phone_verified boolean not null default false,
  privacy text not null default 'block' check (privacy in ('block', 'hidden')),
  role text not null default 'user' check (role in ('user', 'admin')),
  banned boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.categories (
  id smallint primary key generated always as identity,
  slug text not null unique,
  name text not null,
  icon text not null,
  sort_order smallint not null
);

create table public.pros (
  id uuid primary key default gen_random_uuid(),
  google_place_id text unique,
  name text not null,
  phone text,
  website text,
  logo_url text,
  photo_url text,
  location extensions.geography(Point, 4326),
  service_area_text text,
  status text not null default 'active' check (status in ('active', 'hidden')),
  merged_into_id uuid references public.pros (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.vouches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  pro_id uuid not null references public.pros (id) on delete cascade,
  category_id smallint not null references public.categories (id),
  reaction text not null check (reaction in ('thumbs_up', 'love')),
  note text check (char_length(note) <= 140),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  via_invite boolean not null default false,
  created_at timestamptz not null default now(),
  unique (household_id, pro_id, category_id)
);

create table public.flags (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid references public.pros (id) on delete cascade,
  vouch_id uuid references public.vouches (id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason text not null,
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  check (pro_id is not null or vouch_id is not null)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null references public.pros (id) on delete cascade,
  code text not null unique,
  uses integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  phone text,
  email text,
  zip text,
  town text,
  created_at timestamptz not null default now(),
  check (phone is not null or email is not null)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index households_location_idx on public.households using gist (location);
create index households_display_location_idx on public.households using gist (display_location);
create index pros_location_idx on public.pros using gist (location);
create index profiles_household_idx on public.profiles (household_id);
create index vouches_pro_idx on public.vouches (pro_id, category_id);
create index vouches_profile_idx on public.vouches (profile_id);
create index flags_open_idx on public.flags (status) where status = 'open';

-- ---------------------------------------------------------------------------
-- Fuzzed display location: snap the home to the center of a ~150 m grid cell
-- ---------------------------------------------------------------------------

create or replace function public.set_display_location()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  merc geometry := st_transform(new.location::geometry, 3857);
  -- Web Mercator stretches distances by 1/cos(latitude); scale so cells are ~150 real meters.
  cell double precision := 150 / cos(radians(st_y(new.location::geometry)));
begin
  new.display_location := st_transform(
    st_setsrid(
      st_makepoint(
        floor(st_x(merc) / cell) * cell + cell / 2,
        floor(st_y(merc) / cell) * cell + cell / 2
      ),
      3857
    ),
    4326
  )::geography;
  return new;
end;
$$;

create trigger households_display_location
before insert or update of location on public.households
for each row execute function public.set_display_location();

-- ---------------------------------------------------------------------------
-- Row Level Security: on for every table
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.pros enable row level security;
alter table public.vouches enable row level security;
alter table public.flags enable row level security;
alter table public.invites enable row level security;
alter table public.waitlist enable row level security;

-- Supabase grants browsers full table access by default; start from nothing
-- and grant back only what each role needs (column lists hide private columns).
revoke all on public.households, public.profiles, public.categories, public.pros,
  public.vouches, public.flags, public.invites, public.waitlist
  from anon, authenticated;

-- categories: anyone can read
grant select on public.categories to anon, authenticated;
create policy "categories are public" on public.categories
  for select to anon, authenticated using (true);

-- pros: anyone can read active pros, minus created_by
grant select (id, google_place_id, name, phone, website, logo_url, photo_url, location,
  service_area_text, status, merged_into_id, created_at)
  on public.pros to anon, authenticated;
create policy "active pros are public" on public.pros
  for select to anon, authenticated using (status = 'active');

-- profiles: signed-in users see and edit only their own name and privacy choice
grant select (id, household_id, first_name, last_initial, phone_verified, privacy, role, banned, created_at)
  on public.profiles to authenticated;
grant update (first_name, last_initial, privacy) on public.profiles to authenticated;
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- vouches: signed-in users see, switch and remove only their own
-- (new reactions go through the server so trust rules apply)
grant select on public.vouches to authenticated;
grant update (reaction, note) on public.vouches to authenticated;
grant delete on public.vouches to authenticated;
create policy "read own vouches" on public.vouches
  for select to authenticated using (profile_id = auth.uid());
create policy "update own vouches" on public.vouches
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "delete own vouches" on public.vouches
  for delete to authenticated using (profile_id = auth.uid());

-- flags: signed-in users can file one; nobody but the server (admin) reads them
grant insert (pro_id, vouch_id, reason, details) on public.flags to authenticated;
create policy "file a flag" on public.flags
  for insert to authenticated with check (profile_id = auth.uid());

-- waitlist: anyone can join; nobody reads it from the browser
grant insert (phone, email, zip, town) on public.waitlist to anon, authenticated;
create policy "join waitlist" on public.waitlist
  for insert to anon, authenticated with check (true);

-- households and invites: no browser access at all (server only)

-- ---------------------------------------------------------------------------
-- pros_near: pros with 👍/❤️ counts within a radius and in total
-- ---------------------------------------------------------------------------

create or replace function public.pros_near(
  lat double precision,
  lng double precision,
  radius_m double precision default 1609,
  category text default null
)
returns table (
  id uuid,
  name text,
  phone text,
  website text,
  logo_url text,
  category_slug text,
  thumbs_near bigint,
  love_near bigint,
  customers_near bigint,
  thumbs_total bigint,
  love_total bigint
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with origin as (
    select st_setsrid(st_makepoint(lng, lat), 4326)::geography as g
  ),
  counted as (
    select
      v.pro_id,
      c.slug as category_slug,
      st_dwithin(h.location, (select g from origin), radius_m) as is_near,
      v.reaction,
      v.household_id
    from vouches v
    join categories c on c.id = v.category_id
    join households h on h.id = v.household_id
    join profiles pr on pr.id = v.profile_id
    where v.status = 'visible'
      and not pr.banned
      and (category is null or c.slug = category)
  )
  select
    p.id, p.name, p.phone, p.website, p.logo_url, x.category_slug,
    count(*) filter (where x.is_near and x.reaction = 'thumbs_up'),
    count(*) filter (where x.is_near and x.reaction = 'love'),
    count(distinct x.household_id) filter (where x.is_near),
    count(*) filter (where x.reaction = 'thumbs_up'),
    count(*) filter (where x.reaction = 'love')
  from counted x
  join pros p on p.id = x.pro_id
  where p.status = 'active'
  group by p.id, x.category_slug
  having count(*) filter (where x.is_near) > 0
  order by count(*) filter (where x.is_near) desc, count(*) desc;
$$;

revoke all on function public.pros_near(double precision, double precision, double precision, text) from public;
grant execute on function public.pros_near(double precision, double precision, double precision, text) to anon, authenticated;
revoke all on function public.set_display_location() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed: the 12 fixed categories
-- ---------------------------------------------------------------------------

insert into public.categories (slug, name, icon, sort_order) values
  ('pool',             'Pool',             '🏊', 1),
  ('lawn',             'Lawn',             '🌱', 2),
  ('hvac',             'HVAC',             '❄️', 3),
  ('plumbing',         'Plumbing',         '🚰', 4),
  ('electrical',       'Electrical',       '⚡', 5),
  ('roofing',          'Roofing',          '🏠', 6),
  ('pest',             'Pest',             '🐜', 7),
  ('cleaning',         'Cleaning',         '🧹', 8),
  ('handyman',         'Handyman',         '🔧', 9),
  ('painting',         'Painting',         '🎨', 10),
  ('pressure-washing', 'Pressure washing', '💦', 11),
  ('tree-service',     'Tree service',     '🌳', 12);
