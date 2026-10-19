-- Holler: each person's reach (1, 3 or 5 miles, default 3) and each home's city.
-- Paste into Supabase > SQL Editor and click Run. Safe to run more than once.

alter table public.profiles add column if not exists reach_miles smallint not null default 3;
alter table public.profiles drop constraint if exists profiles_reach_miles;
alter table public.profiles add constraint profiles_reach_miles check (reach_miles in (1, 3, 5));
grant select (reach_miles) on public.profiles to authenticated;

-- City from the address (shown instead of neighborhood names)
alter table public.households add column if not exists city text;

-- my_home now also returns the city (for "Who Spring Hill uses")
drop function if exists public.my_home();
create function public.my_home()
returns table (
  first_name text,
  home_lat double precision,
  home_lng double precision,
  neighborhood text,
  city text
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
    h.neighborhood,
    h.city
  from profiles pr
  left join households h on h.id = pr.household_id
  where pr.id = auth.uid();
$$;
revoke all on function public.my_home() from public, anon;
grant execute on function public.my_home() to authenticated;
