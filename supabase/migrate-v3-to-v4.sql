-- JARVIS ULTIMATE v3 -> v4
create extension if not exists pgcrypto;
create table if not exists routine_reports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  kind text not null check(kind in ('morning','evening','manual')),
  local_date date not null, title text not null, body text not null,
  details jsonb default '{}'::jsonb, created_at timestamptz default now(),
  unique(user_id,kind,local_date)
);
create index if not exists routine_reports_user_idx on routine_reports(user_id,created_at desc);
alter table routine_reports enable row level security;

alter table if exists location_events add column if not exists expires_at timestamptz default (now() + interval '24 hours');
