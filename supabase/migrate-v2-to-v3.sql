-- Run this ONLY if you already used JARVIS v2/v2.1 schema.
create extension if not exists pgcrypto;

alter table if exists memories add column if not exists source text default 'conversation';
alter table if exists memories add column if not exists updated_at timestamptz default now();
alter table if exists memories drop constraint if exists memories_kind_check;
alter table if exists memories add constraint memories_kind_check check (kind in ('preference','habit','workflow','fact','person','project'));

alter table if exists devices add column if not exists capabilities jsonb default '[]'::jsonb;

alter table if exists device_commands add column if not exists payload jsonb default '{}'::jsonb;
alter table if exists device_commands add column if not exists requires_confirmation boolean default false;
alter table if exists device_commands add column if not exists confirmation_token text;
alter table if exists device_commands drop constraint if exists device_commands_status_check;
alter table if exists device_commands add constraint device_commands_status_check check (status in ('queued','running','completed','failed','cancelled','waiting_confirmation'));

-- The rest are new v3 tables.
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, title text not null, notes text default '',
  due_at timestamptz, recurrence text, status text default 'open' check(status in ('open','done','cancelled')),
  notify boolean default true, last_notified_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists routines (id uuid primary key default gen_random_uuid(),user_id uuid not null,name text not null,trigger_type text not null default 'manual' check(trigger_type in ('manual','time','location','event')),trigger_config jsonb default '{}'::jsonb,steps jsonb default '[]'::jsonb,enabled boolean default true,learned boolean default false,confidence double precision default .8,created_at timestamptz default now(),updated_at timestamptz default now());
create table if not exists behavior_events (id uuid primary key default gen_random_uuid(),user_id uuid not null,event_type text not null,metadata jsonb default '{}'::jsonb,created_at timestamptz default now());
create table if not exists integrations (id uuid primary key default gen_random_uuid(),user_id uuid not null,provider text not null,access_token text,refresh_token text,expires_at timestamptz,scopes text,metadata jsonb default '{}'::jsonb,enabled boolean default true,created_at timestamptz default now(),updated_at timestamptz default now(),unique(user_id,provider));
create table if not exists push_subscriptions (id uuid primary key default gen_random_uuid(),user_id uuid not null,endpoint text not null unique,p256dh text not null,auth text not null,created_at timestamptz default now());
create table if not exists approvals (id uuid primary key default gen_random_uuid(),user_id uuid not null,action text not null,details jsonb default '{}'::jsonb,token text not null unique,status text default 'pending' check(status in ('pending','approved','denied','expired')),expires_at timestamptz not null,created_at timestamptz default now(),resolved_at timestamptz);
create table if not exists action_logs (id uuid primary key default gen_random_uuid(),user_id uuid not null,source text not null,action text not null,details jsonb default '{}'::jsonb,success boolean,result text,created_at timestamptz default now());
create table if not exists usage_logs (id uuid primary key default gen_random_uuid(),user_id uuid not null,model text,input_tokens bigint default 0,output_tokens bigint default 0,total_tokens bigint default 0,estimated_cost_usd numeric(12,6) default 0,created_at timestamptz default now());
create table if not exists file_index (id uuid primary key default gen_random_uuid(),user_id uuid not null,device_id uuid references devices(id) on delete cascade,path text not null,name text not null,extension text,size bigint default 0,modified_at timestamptz,excerpt text default '',searchable_text text default '',indexed_at timestamptz default now(),unique(device_id,path));
create table if not exists location_events (id uuid primary key default gen_random_uuid(),user_id uuid not null,latitude double precision not null,longitude double precision not null,accuracy double precision,label text,created_at timestamptz default now());

alter table tasks enable row level security;alter table routines enable row level security;alter table behavior_events enable row level security;alter table integrations enable row level security;alter table push_subscriptions enable row level security;alter table approvals enable row level security;alter table action_logs enable row level security;alter table usage_logs enable row level security;alter table file_index enable row level security;alter table location_events enable row level security;
