# YO'L 🌍 — Study Abroad, Without the Consultant

AI advisor + scholarships + interactive globe + application tracker. React (Vite) · Supabase · Vercel · Anthropic API. Same stack as MistakeMap.

## Features
- 🧭 **AI Advisor** — "Who do you wanna be?" → Claude returns a direction + 5 matched universities (tuition, scholarships, living costs, visa, direct apply link)
- ⏰ **Deadline marquee** — top universities + deadlines scrolling animation (curated in `src/data/universities.js`)
- 🎓 **Scholarships** — 16 major worldwide scholarships (`src/data/scholarships.js`)
- 🌍 **Interactive globe** — spin, tap a country → rent/food/transport/visa (`src/data/countryCosts.js`)
- 📋 **Tracker** — status, deadlines, notes. localStorage for guests, Supabase sync when signed in
- ✉️ **Sign in** — Supabase magic link (no passwords)
- 🤝 **Sponsored slot** — edit `SPONSOR` in `src/App.jsx`
- ✈️ **Telegram / LinkedIn** — edit `LINKS` in `src/App.jsx`

## Deploy — 15 minutes

### 1. GitHub
```bash
cd yol
git init && git add . && git commit -m "YO'L v1"
# create empty repo on github.com, then:
git remote add origin https://github.com/YOUR-USERNAME/yol.git
git push -u origin main
```

### 2. Supabase (free tier)
1. supabase.com → New project
2. SQL Editor → paste `supabase/schema.sql` → Run
3. Authentication → Providers → Email → keep "Magic Link" enabled
4. Authentication → URL Configuration → add your Vercel domain to Redirect URLs (after step 3)
5. Settings → API → copy the **Project URL** and **anon key**

### 3. Vercel
1. vercel.com → New Project → import your GitHub repo (framework auto-detects Vite)
2. Environment Variables:
   - `VITE_SUPABASE_URL` = project URL
   - `VITE_SUPABASE_ANON_KEY` = anon key
   - `ANTHROPIC_API_KEY` = your Anthropic key (server-side only — the `/api/advisor.js` function keeps it hidden)
3. Deploy 🚀

### Local dev
```bash
npm install
cp .env.example .env   # fill values
npx vercel dev         # runs Vite + the /api function together
```
(`npm run dev` also works but `/api/advisor` won't run — use `vercel dev` to test the AI.)

## Honest notes ⚠️
- **QS rankings**: there is **no free live QS API**. `universities.js` is a curated dataset — update it each cycle (10 min/year). "Live" scraping would break QS terms of service.
- **"Apply directly"**: real direct integration into university application systems doesn't exist publicly — the honest version is deep links to each uni's official application portal, which is what `applyUrl` does.
- **Costs/deadlines/visa figures** are estimates; the footer + disclaimers say so. Keep them — it protects you legally as a consultant replacement.
- **Sponsor slot**: mark it "Sponsored" always (it does by default) — required by UK advertising rules (ASA).

## Update checklist (monthly, 15 min)
- [ ] `universities.js` — deadlines for the current cycle
- [ ] `scholarships.js` — deadlines
- [ ] `countryCosts.js` — any big currency shifts
- [ ] Post updates to Telegram/LinkedIn 🔔
