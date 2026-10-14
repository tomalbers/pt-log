-- PT Log: phase 1 + 2 schema. All objects prefixed ptl_ to avoid conflicts.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.ptl_profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'client' check (role in ('trainer','client')),
  created_at timestamptz not null default now()
);
create table if not exists public.ptl_config(key text primary key, value text);

-- Generic document tables (offline-first sync, last-write-wins on updated_at)
create table if not exists public.ptl_clients(
  id text primary key,
  trainer_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}',
  email text generated always as (lower(nullif(trim(data->>'email'),''))) stored,
  share_plan boolean generated always as (coalesce((data->'share'->>'plan')::boolean,false)) stored,
  share_sessions boolean generated always as (coalesce((data->'share'->>'sessions')::boolean,false)) stored,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
do $$ declare t text; begin
  foreach t in array array['ptl_schemas','ptl_blocks','ptl_routines','ptl_strippen','ptl_sessions'] loop
    execute format('create table if not exists public.%I(
      id text primary key,
      trainer_id uuid not null references auth.users(id) on delete cascade,
      client_id text not null,
      data jsonb not null default ''{}'',
      updated_at timestamptz not null default now(),
      deleted boolean not null default false)', t);
    execute format('create index if not exists %I on public.%I(trainer_id, updated_at)', t||'_tu', t);
    execute format('create index if not exists %I on public.%I(client_id)', t||'_c', t);
  end loop;
end $$;
create table if not exists public.ptl_trainer_settings(
  id text primary key, trainer_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}', updated_at timestamptz not null default now(), deleted boolean not null default false);
create index if not exists ptl_clients_tu on public.ptl_clients(trainer_id, updated_at);
create index if not exists ptl_clients_email on public.ptl_clients(email);

-- Sets: derived from session documents by trigger (read model for queries/charts)
create table if not exists public.ptl_sets(
  id bigint generated always as identity primary key,
  session_id text not null references public.ptl_sessions(id) on delete cascade,
  trainer_id uuid not null, client_id text not null, date date,
  exercise text, set_no int, kg numeric, reps int, rir numeric);
create index if not exists ptl_sets_s on public.ptl_sets(session_id);
create index if not exists ptl_sets_c on public.ptl_sets(client_id, exercise);

-- Helpers
create or replace function public.ptl_is_trainer() returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from ptl_profiles where id=auth.uid() and role='trainer') $$;
create or replace function public.ptl_my_client_ids(need text) returns setof text language sql stable security definer set search_path=public as
$$ select id from ptl_clients where not deleted and email is not null
     and email=lower(auth.jwt()->>'email') and coalesce((auth.jwt()->>'email_verified')::boolean, true)
     and (need='any' or (need='plan' and share_plan) or (need='sessions' and share_sessions)) $$;

create or replace function public.ptl_new_user() returns trigger language plpgsql security definer set search_path=public as
$$ begin insert into ptl_profiles(id,email) values(new.id,new.email) on conflict do nothing; return new; end $$;
drop trigger if exists ptl_on_auth_user on auth.users;
create trigger ptl_on_auth_user after insert on auth.users for each row execute function public.ptl_new_user();
insert into public.ptl_profiles(id,email) select id,email from auth.users on conflict do nothing;

-- One-time trainer claim with a code (hash stored in ptl_config 'trainer_code_sha256')
create or replace function public.ptl_claim_trainer(code text) returns boolean language plpgsql security definer set search_path=public,extensions as
$$ declare h text; begin
  select value into h from ptl_config where key='trainer_code_sha256';
  if auth.uid() is null or h is null or encode(digest(code,'sha256'),'hex')<>h then return false; end if;
  update ptl_profiles set role='trainer' where id=auth.uid();
  return true; end $$;
revoke all on function public.ptl_claim_trainer(text) from public, anon;
grant execute on function public.ptl_claim_trainer(text) to authenticated;

-- updated_at must never be in the future more than 5 min (clock skew guard) and owner fixed
create or replace function public.ptl_guard() returns trigger language plpgsql as
$$ begin
  new.trainer_id := auth.uid();
  if new.updated_at is null or new.updated_at > now()+interval '5 minutes' then new.updated_at := now(); end if;
  if tg_op='UPDATE' and old.updated_at > new.updated_at then return null; end if; -- last write wins
  return new; end $$;

create or replace function public.ptl_sync_sets() returns trigger language plpgsql security definer set search_path=public as
$$ begin
  delete from ptl_sets where session_id=new.id;
  if not new.deleted then
    insert into ptl_sets(session_id,trainer_id,client_id,date,exercise,set_no,kg,reps,rir)
    select new.id,new.trainer_id,new.client_id,nullif(new.data->>'date','')::date,e->>'n',s.ord::int,
           (s.v->>'kg')::numeric,(s.v->>'reps')::numeric::int,(s.v->>'rir')::numeric
    from jsonb_array_elements(coalesce(new.data->'ex','[]')) e,
         jsonb_array_elements(coalesce(e->'sets','[]')) with ordinality s(v,ord);
  end if; return null; end $$;
drop trigger if exists ptl_sets_t on public.ptl_sessions;
create trigger ptl_sets_t after insert or update on public.ptl_sessions for each row execute function public.ptl_sync_sets();

-- RLS
do $$ declare t text; begin
  foreach t in array array['ptl_clients','ptl_schemas','ptl_blocks','ptl_routines','ptl_strippen','ptl_sessions','ptl_trainer_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop trigger if exists ptl_guard_t on public.%I', t);
    execute format('create trigger ptl_guard_t before insert or update on public.%I for each row execute function public.ptl_guard()', t);
    execute format('drop policy if exists trainer_all on public.%I', t);
    execute format('create policy trainer_all on public.%I for all to authenticated using (trainer_id=auth.uid() and public.ptl_is_trainer()) with check (trainer_id=auth.uid() and public.ptl_is_trainer())', t);
  end loop;
end $$;
alter table public.ptl_profiles enable row level security;
alter table public.ptl_config enable row level security;
alter table public.ptl_sets enable row level security;
drop policy if exists own on public.ptl_profiles;
create policy own on public.ptl_profiles for select to authenticated using (id=auth.uid());
-- (no insert/update policy on profiles: role can only change via ptl_claim_trainer)

-- Client read-only policies
drop policy if exists client_read on public.ptl_clients;
create policy client_read on public.ptl_clients for select to authenticated using (id in (select public.ptl_my_client_ids('any')));
drop policy if exists client_read on public.ptl_schemas;
create policy client_read on public.ptl_schemas for select to authenticated using (not deleted and client_id in (select public.ptl_my_client_ids('plan')));
drop policy if exists client_read on public.ptl_blocks;
create policy client_read on public.ptl_blocks for select to authenticated using (not deleted and client_id in (select public.ptl_my_client_ids('plan')));
drop policy if exists client_read on public.ptl_routines;
create policy client_read on public.ptl_routines for select to authenticated using (not deleted and client_id in (select public.ptl_my_client_ids('plan')));
drop policy if exists client_read on public.ptl_sessions;
create policy client_read on public.ptl_sessions for select to authenticated using (not deleted and client_id in (select public.ptl_my_client_ids('sessions')));
drop policy if exists trainer_read on public.ptl_sets;
create policy trainer_read on public.ptl_sets for select to authenticated using (trainer_id=auth.uid() or client_id in (select public.ptl_my_client_ids('sessions')));
-- ptl_strippen and ptl_trainer_settings: trainer only (administration is not shared)

revoke all on public.ptl_config from anon, authenticated;
revoke all on all tables in schema public from anon;
grant select,insert,update,delete on public.ptl_clients,public.ptl_schemas,public.ptl_blocks,public.ptl_routines,public.ptl_strippen,public.ptl_sessions,public.ptl_trainer_settings to authenticated;
grant select on public.ptl_profiles, public.ptl_sets to authenticated;
revoke insert,update,delete on public.ptl_sets, public.ptl_profiles from authenticated;
