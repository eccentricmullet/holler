-- Holler steps 11b–11h: everything the v1.1 features need, in one go.
-- Paste into Supabase > SQL Editor and click Run. Safe to run more than once.

-- 11b quick tags and 11c price hint, both optional, on each reaction
alter table public.vouches add column if not exists tags text[] not null default '{}';
alter table public.vouches add column if not exists price smallint;
alter table public.vouches drop constraint if exists vouches_tags_allowed;
alter table public.vouches add constraint vouches_tags_allowed
  check (tags <@ array['on_time', 'fair_price', 'quick_reply', 'clean_work', 'would_rehire']::text[]);
alter table public.vouches drop constraint if exists vouches_price_range;
alter table public.vouches add constraint vouches_price_range check (price is null or price between 1 and 3);
-- Users can change tags and price on their own reactions (row rules from step 2 still apply)
grant update (reaction, note, tags, price) on public.vouches to authenticated;

-- 11f saved pros ("My pros") and a shareable list link
create table if not exists public.saved_pros (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  pro_id uuid not null references public.pros (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, pro_id)
);
alter table public.saved_pros enable row level security;
revoke all on public.saved_pros from anon, authenticated;
grant select, insert, delete on public.saved_pros to authenticated;
drop policy if exists "read own saved pros" on public.saved_pros;
create policy "read own saved pros" on public.saved_pros for select to authenticated using (profile_id = auth.uid());
drop policy if exists "save pros" on public.saved_pros;
create policy "save pros" on public.saved_pros for insert to authenticated with check (profile_id = auth.uid());
drop policy if exists "unsave pros" on public.saved_pros;
create policy "unsave pros" on public.saved_pros for delete to authenticated using (profile_id = auth.uid());

-- Random code for a person's shareable "My pros" page (made only when they tap Share)
alter table public.profiles add column if not exists share_code text unique;

-- 11h Ask the neighborhood: an ask, and neighbors' answers (each answer is a pro, not text)
create table if not exists public.asks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  category_id smallint not null references public.categories (id),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);
create index if not exists asks_open_idx on public.asks (status, created_at desc);

create table if not exists public.ask_answers (
  id uuid primary key default gen_random_uuid(),
  ask_id uuid not null references public.asks (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  pro_id uuid not null references public.pros (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (ask_id, profile_id)
);

-- Asks and answers go through the server only (no browser access)
alter table public.asks enable row level security;
alter table public.ask_answers enable row level security;
revoke all on public.asks, public.ask_answers from anon, authenticated;
