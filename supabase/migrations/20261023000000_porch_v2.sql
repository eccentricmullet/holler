-- Holler redesign phase 3: the new Porch. Pro requests get timing, a note and "Found someone";
-- garage sales get a time window and an address for directions.
-- Paste into Supabase > SQL Editor and click Run. Safe to run more than once.

-- Pro requests (the asks table)
alter table public.asks add column if not exists timing text not null default 'planning';
alter table public.asks drop constraint if exists asks_timing_check;
alter table public.asks add constraint asks_timing_check check (timing in ('asap', 'this_week', 'planning', 'date'));
alter table public.asks add column if not exists needed_on date;
alter table public.asks add column if not exists note text;
alter table public.asks drop constraint if exists asks_note_check;
alter table public.asks add constraint asks_note_check check (note is null or char_length(note) <= 120);
-- "Found someone": who they went with
alter table public.asks add column if not exists chosen_pro_id uuid references public.pros (id) on delete set null;
alter table public.asks add column if not exists closed_at timestamptz;

-- Garage sales: time window and where (shared only with neighbors on the Porch)
alter table public.porch_posts add column if not exists starts_at time;
alter table public.porch_posts add column if not exists ends_at time;
alter table public.porch_posts add column if not exists address text;
alter table public.porch_posts drop constraint if exists porch_posts_address_check;
alter table public.porch_posts add constraint porch_posts_address_check check (address is null or char_length(address) <= 120);
