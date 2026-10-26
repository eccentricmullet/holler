-- Holler: "Suggest a service". A neighbor asks for a service that isn't listed (like "Babysitting");
-- the admin adds it as a new category or declines. Replaces "Ask us to add a pro" (vendor_requests is no longer used).
-- Paste into Supabase > SQL Editor and click Run. Safe to run more than once.

create table if not exists public.category_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  details text check (details is null or char_length(details) <= 200), -- "for my dog while I travel"
  status text not null default 'waiting' check (status in ('waiting', 'added', 'declined')),
  category_slug text references public.categories (slug) on delete set null, -- the service the admin added
  decline_reason text check (decline_reason is null or char_length(decline_reason) <= 120),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists category_requests_status_idx on public.category_requests (status, created_at desc);
create index if not exists category_requests_profile_idx on public.category_requests (profile_id, created_at desc);

-- Server only (no browser access)
alter table public.category_requests enable row level security;
revoke all on public.category_requests from anon, authenticated;
