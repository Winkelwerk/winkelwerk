alter table if exists public.menu_items
  add column if not exists menu_period text not null default 'all_day';

update public.menu_items
set menu_period = 'all_day'
where menu_period is null
   or btrim(menu_period) = '';

alter table public.menu_items
  drop constraint if exists menu_items_menu_period_check;

alter table public.menu_items
  add constraint menu_items_menu_period_check
  check (menu_period in ('all_day', 'breakfast', 'lunch', 'dinner'));

create index if not exists menu_items_period_idx
  on public.menu_items (menu_period, is_active, sort_order asc);
