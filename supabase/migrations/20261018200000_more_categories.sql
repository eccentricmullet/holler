-- Holler step 11a: 25 categories in groups for the category sheet.
-- Paste into Supabase > SQL Editor and click Run. Safe to run more than once.

alter table public.categories add column if not exists section text not null default 'Inside';

insert into public.categories (slug, name, icon, sort_order, section) values
  -- Outside
  ('lawn',             'Lawn',             '🌱', 1,  'Outside'),
  ('landscaping',      'Landscaping',      '🪴', 2,  'Outside'),
  ('tree-service',     'Tree service',     '🌳', 3,  'Outside'),
  ('gutter-cleaning',  'Gutter cleaning',  '🍂', 4,  'Outside'),
  ('pressure-washing', 'Pressure washing', '💦', 5,  'Outside'),
  ('window-cleaning',  'Window cleaning',  '🪟', 6,  'Outside'),
  ('pool',             'Pool',             '🏊', 7,  'Outside'),
  ('pest',             'Pest',             '🐜', 8,  'Outside'),
  ('fencing',          'Fencing',          '🚧', 9,  'Outside'),
  ('roofing',          'Roofing',          '🏠', 10, 'Outside'),
  -- Inside
  ('plumbing',         'Plumbing',         '🚰', 11, 'Inside'),
  ('electrical',       'Electrical',       '⚡', 12, 'Inside'),
  ('hvac',             'HVAC',             '❄️', 13, 'Inside'),
  ('handyman',         'Handyman',         '🔧', 14, 'Inside'),
  ('painting',         'Painting',         '🎨', 15, 'Inside'),
  ('cleaning',         'Cleaning',         '🧹', 16, 'Inside'),
  ('flooring',         'Flooring',         '🧱', 17, 'Inside'),
  ('appliance-repair', 'Appliance repair', '🔌', 18, 'Inside'),
  ('garage-doors',     'Garage doors',     '🚘', 19, 'Inside'),
  -- Moving & hauling
  ('junk-removal',     'Junk removal',     '🗑️', 20, 'Moving & hauling'),
  ('movers',           'Movers',           '📦', 21, 'Moving & hauling'),
  -- Pets
  ('dog-walking',      'Dog walking',      '🐕', 22, 'Pets'),
  ('pet-grooming',     'Pet grooming',     '✂️', 23, 'Pets'),
  -- Cars
  ('car-care',         'Car care',         '🚗', 24, 'Cars'),
  -- Gifts & events
  ('florist',          'Florist',          '💐', 25, 'Gifts & events')
on conflict (slug) do update
  set name = excluded.name, icon = excluded.icon, sort_order = excluded.sort_order, section = excluded.section;
