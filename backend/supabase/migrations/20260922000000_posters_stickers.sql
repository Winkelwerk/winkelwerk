alter table if exists public.menu_items
  drop constraint if exists menu_items_item_type_check;

alter table public.menu_items
  add constraint menu_items_item_type_check
  check (item_type in ('food', 'drink', 'poster', 'sticker'));

create index if not exists menu_items_print_products_idx
  on public.menu_items (item_type, is_active, sort_order asc)
  where item_type in ('poster', 'sticker');
