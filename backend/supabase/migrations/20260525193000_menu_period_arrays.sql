alter table if exists public.menu_items
  add column if not exists menu_periods text[] not null default array['all_day']::text[];

update public.menu_items
set menu_periods = case
  when menu_period in ('breakfast', 'lunch', 'dinner') then array[menu_period]::text[]
  else array['all_day']::text[]
end;

alter table public.menu_items
  drop constraint if exists menu_items_menu_periods_check;

alter table public.menu_items
  add constraint menu_items_menu_periods_check
  check (
    cardinality(menu_periods) > 0
    and menu_periods <@ array['all_day', 'breakfast', 'lunch', 'dinner']::text[]
    and (not ('all_day' = any(menu_periods)) or cardinality(menu_periods) = 1)
  );

create index if not exists menu_items_periods_gin_idx
  on public.menu_items using gin (menu_periods);
