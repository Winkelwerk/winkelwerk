create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  image_url text,
  price text,
  category text,
  badge text,
  cta_label text,
  cta_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists menu_items_sort_idx
  on public.menu_items (sort_order asc, created_at asc);

create index if not exists menu_items_active_idx
  on public.menu_items (is_active, sort_order asc);
