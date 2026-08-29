create extension if not exists pgcrypto;

create table if not exists memories (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  kind text not null check (kind in ('preference','habit','workflow','fact','person','project')),
  content text not null, confidence double precision default .8,
  source text default 'conversation', created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists memories_user_idx on memories(user_id, created_at desc);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  role text not null check (role in ('user','assistant','system')), content text not null,
  created_at timestamptz default now()
);
create index if not exists messages_user_idx on messages(user_id, created_at desc);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, name text not null,
  token_hash text not null unique, enabled boolean default true, capabilities jsonb default '[]'::jsonb,
  last_seen_at timestamptz, created_at timestamptz default now()
);
create index if not exists devices_user_idx on devices(user_id, last_seen_at desc);

create table if not exists device_commands (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, device_id uuid references devices(id) on delete cascade,
  action text not null, target text default '', payload jsonb default '{}'::jsonb,
  requires_confirmation boolean default false, confirmation_token text,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled','waiting_confirmation')),
  result text, created_at timestamptz default now(), started_at timestamptz, completed_at timestamptz
);
create index if not exists commands_device_idx on device_commands(device_id,status,created_at);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, title text not null, notes text default '',
  due_at timestamptz, recurrence text, status text default 'open' check(status in ('open','done','cancelled')),
  notify boolean default true, last_notified_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists tasks_user_due_idx on tasks(user_id,status,due_at);

create table if not exists routines (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, name text not null,
  trigger_type text not null default 'manual' check(trigger_type in ('manual','time','location','event')),
  trigger_config jsonb default '{}'::jsonb, steps jsonb default '[]'::jsonb, enabled boolean default true,
  learned boolean default false, confidence double precision default .8, created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists behavior_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, event_type text not null,
  metadata jsonb default '{}'::jsonb, created_at timestamptz default now()
);
create index if not exists behavior_events_user_idx on behavior_events(user_id,created_at desc);

create table if not exists integrations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, provider text not null,
  access_token text, refresh_token text, expires_at timestamptz, scopes text, metadata jsonb default '{}'::jsonb,
  enabled boolean default true, created_at timestamptz default now(), updated_at timestamptz default now(),
  unique(user_id,provider)
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, endpoint text not null unique,
  p256dh text not null, auth text not null, created_at timestamptz default now()
);

create table if not exists approvals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, action text not null,
  details jsonb default '{}'::jsonb, token text not null unique,
  status text default 'pending' check(status in ('pending','approved','denied','expired')),
  expires_at timestamptz not null, created_at timestamptz default now(), resolved_at timestamptz
);

create table if not exists action_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, source text not null,
  action text not null, details jsonb default '{}'::jsonb, success boolean, result text,
  created_at timestamptz default now()
);
create index if not exists action_logs_user_idx on action_logs(user_id,created_at desc);

create table if not exists usage_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, model text,
  input_tokens bigint default 0, output_tokens bigint default 0, total_tokens bigint default 0,
  estimated_cost_usd numeric(12,6) default 0, created_at timestamptz default now()
);

create table if not exists file_index (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, device_id uuid references devices(id) on delete cascade,
  path text not null, name text not null, extension text, size bigint default 0, modified_at timestamptz,
  excerpt text default '', searchable_text text default '', indexed_at timestamptz default now(),
  unique(device_id,path)
);
create index if not exists file_index_search_idx on file_index using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(searchable_text,'')));

create table if not exists location_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  latitude double precision not null, longitude double precision not null, accuracy double precision,
  label text, created_at timestamptz default now(), expires_at timestamptz default (now() + interval '24 hours')
);

-- Single-owner server uses service_role; RLS is enabled to prevent accidental client access.
alter table memories enable row level security;
alter table messages enable row level security;
alter table devices enable row level security;
alter table device_commands enable row level security;
alter table tasks enable row level security;
alter table routines enable row level security;
alter table behavior_events enable row level security;
alter table integrations enable row level security;
alter table push_subscriptions enable row level security;
alter table approvals enable row level security;
alter table action_logs enable row level security;
alter table usage_logs enable row level security;
alter table file_index enable row level security;
alter table location_events enable row level security;

create table if not exists routine_reports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  kind text not null check(kind in ('morning','evening','manual')),
  local_date date not null, title text not null, body text not null,
  details jsonb default '{}'::jsonb, created_at timestamptz default now(),
  unique(user_id,kind,local_date)
);
create index if not exists routine_reports_user_idx on routine_reports(user_id,created_at desc);
alter table routine_reports enable row level security;
