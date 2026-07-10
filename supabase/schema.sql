-- Run this in Supabase → SQL Editor → New query → Run

-- Tracked applications (one row per uni a user tracks)
create table if not exists public.tracked_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  uni jsonb not null,               -- {name, country, city, program, tuition, living, sch, web, email, visa, rank}
  status text not null default 'Not started',
  deadline date,
  notes text default '',
  created_at timestamptz default now()
);

alter table public.tracked_applications enable row level security;

create policy "own rows select" on public.tracked_applications
  for select using (auth.uid() = user_id);
create policy "own rows insert" on public.tracked_applications
  for insert with check (auth.uid() = user_id);
create policy "own rows update" on public.tracked_applications
  for update using (auth.uid() = user_id);
create policy "own rows delete" on public.tracked_applications
  for delete using (auth.uid() = user_id);

-- Saved AI plans (optional history)
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  profile jsonb not null,           -- the form the student filled
  result jsonb not null,            -- direction + unis JSON from AI
  created_at timestamptz default now()
);

alter table public.plans enable row level security;
create policy "own plans select" on public.plans for select using (auth.uid() = user_id);
create policy "own plans insert" on public.plans for insert with check (auth.uid() = user_id);
create policy "own plans delete" on public.plans for delete using (auth.uid() = user_id);
