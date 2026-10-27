-- Holler redesign phase 4: The Curb. Neighbors list things to sell or give away (up to 4 photos).
-- "I'm interested" puts the buyer on the item's list and alerts the seller, who picks who to text.
-- Paste into Supabase > SQL Editor and click Run. Safe to run more than once.

create table if not exists public.curb_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 60),
  note text check (note is null or char_length(note) <= 200),
  price integer not null default 0 check (price between 0 and 100000), -- whole dollars; 0 = Free
  kind text not null default 'other' check (kind in ('kids', 'furniture', 'tools', 'other')),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 4), -- in the "porch" photo bucket
  status text not null default 'visible' check (status in ('visible', 'hidden')), -- hidden after 3 reports
  gone boolean not null default false, -- the seller marked it gone
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
create index if not exists curb_items_feed_idx on public.curb_items (status, gone, expires_at, created_at desc);
create index if not exists curb_items_profile_idx on public.curb_items (profile_id, created_at desc);

-- "I'm interested": one per neighbor per item. The seller sees these and picks who to text.
create table if not exists public.curb_interest (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.curb_items (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (item_id, profile_id)
);

-- Neighbors moderate: 3 reports from different homes hides an item
create table if not exists public.curb_reports (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.curb_items (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (item_id, household_id)
);

-- Server only (no browser access)
alter table public.curb_items enable row level security;
alter table public.curb_interest enable row level security;
alter table public.curb_reports enable row level security;
revoke all on public.curb_items, public.curb_interest, public.curb_reports from anon, authenticated;
