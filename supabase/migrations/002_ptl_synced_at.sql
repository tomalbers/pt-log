-- Server-side change cursor for pulls (independent of device clocks)
do $$ declare t text; begin
  foreach t in array array['ptl_clients','ptl_schemas','ptl_blocks','ptl_routines','ptl_strippen','ptl_sessions','ptl_trainer_settings'] loop
    execute format('alter table public.%I add column if not exists synced_at timestamptz not null default clock_timestamp()', t);
    execute format('create index if not exists %I on public.%I(trainer_id, synced_at)', t||'_ts', t);
  end loop;
end $$;
create or replace function public.ptl_guard() returns trigger language plpgsql as
$$ begin
  new.trainer_id := auth.uid();
  if new.updated_at is null or new.updated_at > now()+interval '5 minutes' then new.updated_at := now(); end if;
  if tg_op='UPDATE' and old.updated_at > new.updated_at then return null; end if; -- last write wins
  new.synced_at := clock_timestamp();
  return new; end $$;
