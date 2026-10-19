-- Formkurve: Tabelle für die Daten je Account (einmal im Supabase SQL-Editor ausführen)
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

-- Jeder Account sieht und ändert nur seine eigenen Daten
drop policy if exists "eigene Daten" on public.user_data;
create policy "eigene Daten" on public.user_data
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
