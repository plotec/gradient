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

-- Rangliste: jeder angemeldete Account sieht alle Einträge, schreibt aber nur seinen eigenen
create table if not exists public.leaderboard (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  total integer not null default 0,
  week integer not null default 0,
  week_key text,
  month integer not null default 0,
  month_key text,
  updated_at timestamptz not null default now()
);

alter table public.leaderboard enable row level security;

drop policy if exists "Rangliste lesen" on public.leaderboard;
create policy "Rangliste lesen" on public.leaderboard
  for select to authenticated using (true);

drop policy if exists "eigenen Eintrag anlegen" on public.leaderboard;
create policy "eigenen Eintrag anlegen" on public.leaderboard
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "eigenen Eintrag ändern" on public.leaderboard;
create policy "eigenen Eintrag ändern" on public.leaderboard
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
