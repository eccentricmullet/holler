-- Holler step 4: what the map needs.
-- Paste into Supabase > SQL Editor and click Run.

-- pros_near now lists every pro with a reaction within search_m (default 5 miles),
-- sorted by reactions within radius_m (default 1 mile), then total.
drop function if exists public.pros_near(double precision, double precision, double precision, text);

create or replace function public.pros_near(
  lat double precision,
  lng double precision,
  radius_m double precision default 1609,
  category text default null,
  search_m double precision default 8047
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
      st_dwithin(h.location, (select g from origin), search_m) as in_search,
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
  having count(*) filter (where x.in_search) > 0
  order by count(*) filter (where x.is_near) desc, count(*) desc
  limit 50;
$$;

-- map_pins: one pin per reaction at the neighbor's fuzzed block, never the house.
-- Hidden users and banned users get no pin (their reactions still count in pros_near).
create or replace function public.map_pins(
  lat double precision,
  lng double precision,
  category text,
  search_m double precision default 8047
)
returns table (
  pro_id uuid,
  reaction text,
  pin_lat double precision,
  pin_lng double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    v.pro_id,
    v.reaction,
    st_y(h.display_location::geometry),
    st_x(h.display_location::geometry)
  from vouches v
  join categories c on c.id = v.category_id
  join households h on h.id = v.household_id
  join profiles pr on pr.id = v.profile_id
  join pros p on p.id = v.pro_id
  where v.status = 'visible'
    and c.slug = category
    and p.status = 'active'
    and not pr.banned
    and pr.privacy = 'block'
    and h.display_location is not null
    and st_dwithin(h.display_location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, search_m)
  limit 2000;
$$;

-- my_home: the signed-in user's fuzzed block (to center the map) and display info.
create or replace function public.my_home()
returns table (
  first_name text,
  home_lat double precision,
  home_lng double precision,
  neighborhood text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    pr.first_name,
    st_y(h.display_location::geometry),
    st_x(h.display_location::geometry),
    h.neighborhood
  from profiles pr
  left join households h on h.id = pr.household_id
  where pr.id = auth.uid();
$$;

revoke all on function public.pros_near(double precision, double precision, double precision, text, double precision) from public;
grant execute on function public.pros_near(double precision, double precision, double precision, text, double precision) to anon, authenticated;
revoke all on function public.map_pins(double precision, double precision, text, double precision) from public;
grant execute on function public.map_pins(double precision, double precision, text, double precision) to anon, authenticated;
revoke all on function public.my_home() from public, anon;
grant execute on function public.my_home() to authenticated;
