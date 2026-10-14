-- Uniform columns for generic sync: ptl_clients.client_id mirrors id
alter table public.ptl_clients add column if not exists client_id text generated always as (id) stored;
notify pgrst, 'reload schema';
