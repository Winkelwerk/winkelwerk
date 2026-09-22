create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  maintenance_mode boolean not null default false,
  maintenance_message text not null default 'Website wird gerade bearbeitet. Bitte später erneut versuchen.',
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.site_settings (
  id,
  maintenance_mode,
  maintenance_message
)
values (
  1,
  false,
  'Website wird gerade bearbeitet. Bitte später erneut versuchen.'
)
on conflict (id) do nothing;
