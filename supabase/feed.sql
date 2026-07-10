-- Live scholarship feed (filled by your Telegram collector, read by the site)
create table if not exists public.scholarship_feed (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source text,          -- e.g. channel name
  url text,             -- t.me/... post link
  coverage text,        -- e.g. "Full ride", "€1000/mo"
  posted_at timestamptz default now()
);

alter table public.scholarship_feed enable row level security;
-- anyone can read the feed
create policy "public read feed" on public.scholarship_feed for select using (true);
-- writes only via service role key (your collector script) — no public insert policy.
