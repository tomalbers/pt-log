-- PT Log platform (round 2): exercise library, programs, client-writable data, chat, products & payments
do $$ declare t text; begin
  foreach t in array array['ptl_exercises','ptl_programs'] loop
    execute format('create table if not exists public.%I(
      id text primary key, trainer_id uuid not null references auth.users(id) on delete cascade,
      client_id text not null default '''', data jsonb not null default ''{}'',
      updated_at timestamptz not null default now(), deleted boolean not null default false,
      synced_at timestamptz not null default clock_timestamp())', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop trigger if exists ptl_guard_t on public.%I', t);
    execute format('create trigger ptl_guard_t before insert or update on public.%I for each row execute function public.ptl_guard()', t);
    execute format('drop policy if exists trainer_all on public.%I', t);
    execute format('create policy trainer_all on public.%I for all to authenticated using (trainer_id=auth.uid() and public.ptl_is_trainer()) with check (trainer_id=auth.uid() and public.ptl_is_trainer())', t);
    execute format('create index if not exists %I on public.%I(trainer_id, synced_at)', t||'_ts', t);
    execute format('grant select,insert,update,delete on public.%I to authenticated', t);
  end loop;
end $$;
-- clients may read the exercise library of their own trainer (cues/video)
create or replace function public.ptl_my_trainer_ids() returns setof uuid language sql stable security definer set search_path=public as
$$ select trainer_id from ptl_clients where id in (select public.ptl_my_client_ids('any')) $$;
drop policy if exists client_read on public.ptl_exercises;
create policy client_read on public.ptl_exercises for select to authenticated using (not deleted and trainer_id in (select public.ptl_my_trainer_ids()));

-- is the current user the trainer that owns this client?
create or replace function public.ptl_owns_client(cid text) returns boolean language sql stable security definer set search_path=public as
$$ select public.ptl_is_trainer() and exists(select 1 from ptl_clients where id=cid and trainer_id=auth.uid()) $$;

-- Client-writable tables: home workouts, body metrics, check-ins
do $$ declare t text; begin
  foreach t in array array['ptl_home_workouts','ptl_body','ptl_checkins'] loop
    execute format('create table if not exists public.%I(
      id text primary key, client_id text not null references public.ptl_clients(id) on delete cascade,
      user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
      date date not null default current_date, data jsonb not null default ''{}'',
      updated_at timestamptz not null default now(), deleted boolean not null default false)', t);
    execute format('create index if not exists %I on public.%I(client_id, date)', t||'_cd', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists client_own on public.%I', t);
    execute format('create policy client_own on public.%I for all to authenticated using (user_id=auth.uid() and client_id in (select public.ptl_my_client_ids(''any''))) with check (user_id=auth.uid() and client_id in (select public.ptl_my_client_ids(''any'')))', t);
    execute format('drop policy if exists trainer_read on public.%I', t);
    execute format('create policy trainer_read on public.%I for select to authenticated using (public.ptl_owns_client(client_id))', t);
    execute format('grant select,insert,update,delete on public.%I to authenticated', t);
  end loop;
end $$;

-- 1:1 chat
create table if not exists public.ptl_messages(
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.ptl_clients(id) on delete cascade,
  sender uuid not null default auth.uid() references auth.users(id) on delete cascade,
  from_trainer boolean not null default false,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now(), read_at timestamptz);
create index if not exists ptl_messages_c on public.ptl_messages(client_id, created_at);
alter table public.ptl_messages enable row level security;
drop policy if exists msg_read on public.ptl_messages;
create policy msg_read on public.ptl_messages for select to authenticated using (public.ptl_owns_client(client_id) or client_id in (select public.ptl_my_client_ids('any')));
drop policy if exists msg_trainer_ins on public.ptl_messages;
create policy msg_trainer_ins on public.ptl_messages for insert to authenticated with check (sender=auth.uid() and from_trainer and public.ptl_owns_client(client_id));
drop policy if exists msg_client_ins on public.ptl_messages;
create policy msg_client_ins on public.ptl_messages for insert to authenticated with check (sender=auth.uid() and not from_trainer and client_id in (select public.ptl_my_client_ids('any')));
drop policy if exists msg_mark_read on public.ptl_messages;
create policy msg_mark_read on public.ptl_messages for update to authenticated using (public.ptl_owns_client(client_id) or client_id in (select public.ptl_my_client_ids('any')));
grant select,insert on public.ptl_messages to authenticated;
grant update(read_at) on public.ptl_messages to authenticated;
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='ptl_messages') then
    alter publication supabase_realtime add table public.ptl_messages; end if;
end $$;

-- Products (editable by trainer, readable by clients when active)
create table if not exists public.ptl_products(
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null, description text not null default '',
  price_cents int not null check (price_cents between 100 and 1000000),
  strips int not null default 0 check (strips between 0 and 100),
  active boolean not null default true, sort int not null default 0,
  updated_at timestamptz not null default now());
alter table public.ptl_products enable row level security;
drop policy if exists trainer_all on public.ptl_products;
create policy trainer_all on public.ptl_products for all to authenticated using (trainer_id=auth.uid() and public.ptl_is_trainer()) with check (trainer_id=auth.uid() and public.ptl_is_trainer());
drop policy if exists client_read on public.ptl_products;
create policy client_read on public.ptl_products for select to authenticated using (active and trainer_id in (select public.ptl_my_trainer_ids()));
grant select,insert,update,delete on public.ptl_products to authenticated;

-- Payments: written only by Edge Functions (service role); read by trainer and the paying client
create sequence if not exists public.ptl_invoice_seq;
create table if not exists public.ptl_payments(
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.ptl_clients(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  product_id uuid references public.ptl_products(id) on delete set null,
  description text not null, amount_cents int not null, strips int not null default 0,
  status text not null default 'open', method text, mollie_id text unique, test_mode boolean not null default true,
  invoice_no text unique, created_at timestamptz not null default now(), paid_at timestamptz,
  updated_at timestamptz not null default now());
create index if not exists ptl_payments_c on public.ptl_payments(client_id, created_at);
alter table public.ptl_payments enable row level security;
drop policy if exists pay_read on public.ptl_payments;
create policy pay_read on public.ptl_payments for select to authenticated using ((trainer_id=auth.uid() and public.ptl_is_trainer()) or client_id in (select public.ptl_my_client_ids('any')));
grant select on public.ptl_payments to authenticated;
revoke insert,update,delete on public.ptl_payments from authenticated, anon;

-- Webhook state transition (service role only). Idempotent; assigns invoice number once on paid.
create or replace function public.ptl_payment_status(p_mollie_id text, p_status text, p_method text, p_paid_at timestamptz)
returns public.ptl_payments language plpgsql security definer set search_path=public as
$$ declare r ptl_payments; begin
  update ptl_payments set status=p_status, method=coalesce(p_method,method), updated_at=now(),
    paid_at=case when p_status='paid' then coalesce(paid_at,p_paid_at,now()) else paid_at end,
    invoice_no=case when p_status='paid' and invoice_no is null
      then 'PT'||to_char(now(),'YYYY')||'-'||lpad(nextval('ptl_invoice_seq')::text,4,'0') else invoice_no end
  where mollie_id=p_mollie_id and status<>'paid' returning * into r;
  if r.id is null then select * into r from ptl_payments where mollie_id=p_mollie_id; end if;
  return r; end $$;
revoke all on function public.ptl_payment_status(text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.ptl_payment_status(text,text,text,timestamptz) to service_role;
grant all on public.ptl_payments, public.ptl_products to service_role;
grant usage on sequence public.ptl_invoice_seq to service_role;
notify pgrst, 'reload schema';
