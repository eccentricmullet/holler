-- Holler step 3: one household per real address, matched by Google's place id.
-- Paste into Supabase > SQL Editor and click Run.

alter table public.households add column address_place_id text unique;
