alter table public.ptl_trainer_settings add column if not exists client_id text not null default '';
notify pgrst, 'reload schema';
