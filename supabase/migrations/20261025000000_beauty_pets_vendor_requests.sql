-- Holler: Beauty and more Pets services, and "Ask Holler to add a pro" (vendor requests).
-- Paste into Supabase > SQL Editor and click Run. Safe to run more than once.

-- 1. New services. Beauty is its own group; Pets grows to five.
insert into public.categories (slug, name, icon, sort_order, section) values
  ('vet',                 'Vet',                 '🩺', 24, 'Pets'),
  ('dog-boarding',        'Dog boarding',        '🦴', 25, 'Pets'),
  ('mobile-dog-grooming', 'Mobile dog grooming', '🚐', 26, 'Pets'),
  ('hair-salon',          'Hair salon',          '💇‍♀️', 27, 'Beauty'),
  ('nails',               'Nails',               '💅', 28, 'Beauty'),
  ('lash-extensions',     'Lash extensions',     '✨', 29, 'Beauty'),
  ('botox',               'Botox & fillers',     '💉', 30, 'Beauty')
on conflict (slug) do update
  set name = excluded.name, icon = excluded.icon, sort_order = excluded.sort_order, section = excluded.section;

-- Keep Cars and Gifts & events after the new groups
update public.categories set sort_order = 31 where slug = 'car-care';
update public.categories set sort_order = 32 where slug = 'florist';

-- 2. Vendor requests: a neighbor asks Holler to add a pro they can't add themselves
create table if not exists public.vendor_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  tags text[] not null default '{}',
  details text check (details is null or char_length(details) <= 300), -- phone, Instagram, "the salon on Main St"
  status text not null default 'waiting' check (status in ('waiting', 'added', 'declined')),
  pro_id uuid references public.pros (id) on delete set null, -- the pro the admin created
  decline_reason text check (decline_reason is null or char_length(decline_reason) <= 120),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists vendor_requests_status_idx on public.vendor_requests (status, created_at desc);
create index if not exists vendor_requests_profile_idx on public.vendor_requests (profile_id, created_at desc);

-- Server only (no browser access)
alter table public.vendor_requests enable row level security;
revoke all on public.vendor_requests from anon, authenticated;
