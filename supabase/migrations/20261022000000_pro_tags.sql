-- Holler redesign phase 2: each pro has its own list of service tags, and each home reacts to a pro once.
-- Paste into Supabase > SQL Editor and click Run. Safe to run more than once.

-- 1. Emoji and names from the redesign spec
update public.categories set icon = '🌿' where slug = 'lawn';
update public.categories set icon = '🌳' where slug = 'landscaping';
update public.categories set icon = '🪓' where slug = 'tree-service';
update public.categories set icon = '🪜', name = 'Gutters' where slug = 'gutter-cleaning';
update public.categories set icon = '🔌', name = 'Electrician' where slug = 'electrical';
update public.categories set icon = '🧰' where slug = 'appliance-repair';

-- 2. Tags on the pro: category slugs, main one first
alter table public.pros add column if not exists tags text[] not null default '{}';
grant select (tags) on public.pros to anon, authenticated;
create index if not exists pros_tags_idx on public.pros using gin (tags);

-- Fill tags for existing pros from what neighbors picked, most-picked first
update public.pros p
set tags = sub.tags
from (
  select pro_id, array_agg(slug order by n desc, first_at) as tags
  from (
    select v.pro_id, c.slug, count(*) as n, min(v.created_at) as first_at
    from public.vouches v
    join public.categories c on c.id = v.category_id
    group by v.pro_id, c.slug
  ) per_tag
  group by pro_id
) sub
where sub.pro_id = p.id and p.tags = '{}';

-- Only real category slugs can be tags
create or replace function public.check_pro_tags() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from unnest(new.tags) t where t not in (select slug from public.categories)) then
    raise exception 'unknown pro tag';
  end if;
  return new;
end $$;
drop trigger if exists pros_check_tags on public.pros;
create trigger pros_check_tags before insert or update of tags on public.pros
  for each row execute function public.check_pro_tags();

-- 3. One reaction per home per pro (a home that picked lawn + gutters for the same pro counts once).
-- Keep the reaction with a note if there is one, else the newest; move any reports onto it first.
with ranked as (
  select id, household_id, pro_id,
    first_value(id) over (partition by household_id, pro_id order by (note is not null) desc, created_at desc) as keep_id
  from public.vouches
)
update public.flags f set vouch_id = r.keep_id
from ranked r
where f.vouch_id = r.id and r.id <> r.keep_id;

with ranked as (
  select id,
    row_number() over (partition by household_id, pro_id order by (note is not null) desc, created_at desc) as n
  from public.vouches
)
delete from public.vouches v using ranked r where v.id = r.id and r.n > 1;

alter table public.vouches drop constraint if exists vouches_household_id_pro_id_category_id_key;
alter table public.vouches drop constraint if exists vouches_household_pro_key;
alter table public.vouches add constraint vouches_household_pro_key unique (household_id, pro_id);

-- 4. The map matches a pro on any of its tags
drop function if exists public.pros_near(double precision, double precision, double precision, text, double precision);

create function public.pros_near(
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
  social_url text,
  logo_url text,
  category_slug text,
  tags text[],
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
      st_dwithin(h.location, (select g from origin), radius_m) as is_near,
      st_dwithin(h.location, (select g from origin), search_m) as in_search,
      v.reaction,
      v.household_id
    from vouches v
    join households h on h.id = v.household_id
    join profiles pr on pr.id = v.profile_id
    where v.status = 'visible'
      and not pr.banned
  )
  select
    p.id, p.name, p.phone, p.website, p.social_url, p.logo_url,
    coalesce(category, p.tags[1]), p.tags,
    count(*) filter (where x.is_near and x.reaction = 'thumbs_up'),
    count(*) filter (where x.is_near and x.reaction = 'love'),
    count(distinct x.household_id) filter (where x.is_near),
    count(*) filter (where x.reaction = 'thumbs_up'),
    count(*) filter (where x.reaction = 'love')
  from counted x
  join pros p on p.id = x.pro_id
  where p.status = 'active'
    and (category is null or category = any (p.tags))
  group by p.id
  having count(*) filter (where x.in_search) > 0
  order by count(*) filter (where x.is_near) desc, count(*) desc
  limit 50;
$$;

revoke all on function public.pros_near(double precision, double precision, double precision, text, double precision) from public;
grant execute on function public.pros_near(double precision, double precision, double precision, text, double precision) to anon, authenticated;

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
  join households h on h.id = v.household_id
  join profiles pr on pr.id = v.profile_id
  join pros p on p.id = v.pro_id
  where v.status = 'visible'
    and category = any (p.tags)
    and p.status = 'active'
    and not pr.banned
    and pr.privacy = 'block'
    and h.display_location is not null
    and st_dwithin(h.display_location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, search_m)
  limit 2000;
$$;
