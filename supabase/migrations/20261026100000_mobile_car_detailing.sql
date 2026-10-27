-- Holler: Mobile car detailing, under Cars right after Car care. Safe to run more than once.
update public.categories set sort_order = 33 where slug = 'florist';
insert into public.categories (slug, name, icon, sort_order, section) values
  ('mobile-car-detailing', 'Mobile car detailing', '🧽', 32, 'Cars')
on conflict (slug) do update
  set name = excluded.name, icon = excluded.icon, sort_order = excluded.sort_order, section = excluded.section;
