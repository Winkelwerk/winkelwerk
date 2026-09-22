create extension if not exists pgcrypto;
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  subscription jsonb not null,
  site text,
  page text,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);
create index if not exists push_subscriptions_last_seen_idx
  on public.push_subscriptions (last_seen_at desc);
create table if not exists public.internal_messages (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  url text not null,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists internal_messages_created_at_idx
  on public.internal_messages (created_at desc);
