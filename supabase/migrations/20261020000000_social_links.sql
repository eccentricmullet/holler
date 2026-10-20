-- Holler: Instagram or Facebook link for pros without a phone number.
-- Paste into Supabase > SQL Editor and click Run.

alter table public.pros add column if not exists social_url text;
alter table public.pros drop constraint if exists pros_social_url_check;
alter table public.pros add constraint pros_social_url_check
  check (social_url is null or social_url ~ '^https://(www\.)?(instagram\.com|facebook\.com|instagr\.am|fb\.com|fb\.me)/');
grant select (social_url) on public.pros to anon, authenticated;
create index if not exists pros_social_url_idx on public.pros (social_url) where social_url is not null;

-- pros_near also returns the link (the return shape changes, so drop and recreate)
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
    p.id, p.name, p.phone, p.website, p.social_url, p.logo_url, x.category_slug,
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

revoke all on function public.pros_near(double precision, double precision, double precision, text, double precision) from public;
grant execute on function public.pros_near(double precision, double precision, double precision, text, double precision) to anon, authenticated;
