-- Holler steps 11j–11l: pro colors, The Porch, photos, and opt-in alerts.
-- Paste into Supabase > SQL Editor and click Run. Safe to run more than once.

-- 11j: each pro's own pin color (a real logo replaces it)
alter table public.pros add column if not exists color text;
alter table public.pros drop constraint if exists pros_color_hex;
alter table public.pros add constraint pros_color_hex check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');
grant select (color) on public.pros to anon, authenticated;

-- 11k: The Porch
create table if not exists public.porch_posts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  kind text not null check (kind in (
    'just_hired', 'garage_sale', 'curb_alert', 'lost_pet', 'found_pet', 'event', 'heads_up', 'new_neighbor'
  )),
  topic text check (topic is null or topic in ('roads', 'weather', 'power', 'water')), -- heads-up only
  body text not null check (char_length(body) between 1 and 280),
  photo_path text,
  pro_id uuid references public.pros (id) on delete set null, -- "just hired" shout-outs
  happens_on date,                                            -- garage sales and events
  done boolean not null default false,                        -- "taken" / "found" / "over"
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists porch_posts_live_idx on public.porch_posts (status, expires_at desc);

create table if not exists public.porch_reactions (
  post_id uuid not null references public.porch_posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reaction text not null check (reaction in ('thumbs_up', 'love')),
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

-- One-tap actions instead of comment threads: "I've seen this pet", "Going"
create table if not exists public.porch_actions (
  post_id uuid not null references public.porch_posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  action text not null check (action in ('seen_pet', 'going')),
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id, action)
);

-- Neighbors moderate: 3 reports from different homes hides a post automatically
create table if not exists public.porch_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.porch_posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (post_id, household_id)
);

-- Server only (no browser access); the app checks every rule on the server
alter table public.porch_posts enable row level security;
alter table public.porch_reactions enable row level security;
alter table public.porch_actions enable row level security;
alter table public.porch_reports enable row level security;
revoke all on public.porch_posts, public.porch_reactions, public.porch_actions, public.porch_reports from anon, authenticated;

-- Photos for Porch posts: public images up to 5 MB, uploaded only by the server
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('porch', 'porch', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- 11l: opt-in alerts (browser push), one row per phone/browser
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- Which alerts each person wants (all off until they opt in)
alter table public.profiles add column if not exists alert_asks boolean not null default false;
alter table public.profiles add column if not exists alert_answers boolean not null default false;
alter table public.profiles add column if not exists alert_porch_daily boolean not null default false;
grant select (alert_asks, alert_answers, alert_porch_daily) on public.profiles to authenticated;
