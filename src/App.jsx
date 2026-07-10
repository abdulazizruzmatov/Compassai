import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { supabase } from "./lib/supabase.js";
import { UNIVERSITIES } from "./data/universities.js";
import { SCHOLARSHIPS } from "./data/scholarships.js";
import { COUNTRY_COSTS } from "./data/countryCosts.js";

const Globe = lazy(() => import("react-globe.gl"));

/* ================= CONFIG — edit these ================= */
const LINKS = {
  telegram: "https://t.me/compassabroad",
  linkedin: "https://linkedin.com/company/compassabroad",
};
const SPONSOR = {
  name: "New Uzbekistan University",
  city: "Tashkent, Uzbekistan 🇺🇿",
  pitch: "World-class STEM education at home — English-taught programmes, international faculty, and scholarships for top applicants.",
  cta: "Explore programmes",
  url: "https://newuu.uz",
};
/* ======================================================= */

const REGIONS = ["UK & Ireland 🇬🇧", "Europe 🇪🇺", "North America 🇺🇸", "Asia 🌏", "Australia & NZ 🇦🇺", "Middle East 🕌", "Anywhere 🌍"];
const BUDGETS = ["Need full scholarship 🎓", "Under $10k / yr", "$10–25k / yr", "$25–50k / yr", "$50k+ / yr"];
const LEVELS = ["Foundation", "Bachelor's", "Master's", "PhD"];
const STATUSES = ["Not started", "In progress", "Applied", "Offer", "Rejected"];
const STATUS_COLOR = { "Not started": "var(--slate)", "In progress": "var(--amber)", "Applied": "var(--blue)", "Offer": "var(--green)", "Rejected": "var(--red)" };

const code3 = (s) => (s || "???").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "???";

/* ---------------- hash router ---------------- */
function usePage() {
  const get = () => (window.location.hash.replace(/^#\/?/, "") || "home");
  const [page, setPage] = useState(get);
  useEffect(() => {
    const on = () => { setPage(get()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return page;
}
const go = (p) => (window.location.hash = `/${p}`);

/* ---------------- AI call ---------------- */
function buildPrompt(form, excludeNames) {
  return `You are an expert international education advisor replacing a paid consultation. Student profile:
- Wants to become: ${form.goal}
- Interests: ${form.interests}
- Study level: ${form.level}
- Home country: ${form.home}
- Budget: ${form.budget}
- Preferred regions: ${form.regions.join(", ") || "Anywhere"}
${excludeNames.length ? `- Already suggested, DO NOT repeat: ${excludeNames.join("; ")}` : ""}

Recommend exactly 5 real universities from the world's top ~1000, best-fit for this profile and budget. Real scholarships only. Be terse.

Respond with ONLY valid JSON, no markdown, no backticks, exactly this shape:
{"direction":{"title":"career title","summary":"2 sentences: what this path is and why it fits","degrees":["degree 1","degree 2","degree 3"]},"unis":[{"name":"","country":"","city":"","program":"specific degree title","rank":"e.g. QS Top 150","tuition":"e.g. $14k/yr","sch":[{"n":"scholarship","c":"coverage"}],"living":"e.g. $950/mo","web":"official url","apply":"direct application portal url","email":"admissions email","visa":"visa type + proof-of-funds figure for ${form.home} citizens, one line","why":"one line why this fits"}]}`;
}

async function fetchPlan(form, excludeNames) {
  const res = await fetch("/api/advisor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: buildPrompt(form, excludeNames) }),
  });
  const { text, error } = await res.json();
  if (error) throw new Error(error);
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1));
}

/* ---------------- compass hero ---------------- */
function CompassHero() {
  const orbitUnis = UNIVERSITIES.slice(0, 8);
  const R = 48; // % radius for orbit chips
  return (
    <div className="compass-wrap" aria-hidden="true">
      <div className="orbit">
        {orbitUnis.map((u, i) => {
          const a = (i / orbitUnis.length) * 2 * Math.PI;
          const x = 50 + R * Math.cos(a);
          const y = 50 + R * Math.sin(a);
          return (
            <div key={u.name} className="orbit-chip" style={{ top: `${y}%`, left: `${x}%` }}>
              <span>{u.qs ? `#${u.qs} ` : ""}{u.name}</span>
            </div>
          );
        })}
      </div>
      <div className="compass-face">
        <span className="compass-letter" style={{ top: 10 }}>N</span>
        <span className="compass-letter" style={{ right: 12 }}>E</span>
        <span className="compass-letter" style={{ bottom: 10 }}>S</span>
        <span className="compass-letter" style={{ left: 12 }}>W</span>
        <div className="needle">
          <svg width="150" height="150" viewBox="0 0 100 100">
            <polygon points="50,6 57,50 43,50" fill="#16a34a" />
            <polygon points="50,94 57,50 43,50" fill="#DCEAE2" />
            <circle cx="50" cy="50" r="5.5" fill="#fff" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ---------------- auth modal ---------------- */
function AuthModal({ onClose }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const send = async () => {
    setErr("");
    if (!supabase) { setErr("Auth not configured yet."); return; }
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) setErr(error.message); else setSent(true);
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(11,61,46,0.55)", display: "grid", placeItems: "center", zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "min(420px, 92vw)", padding: 26 }}>
        <div className="display" style={{ fontWeight: 700, fontSize: 22 }}>Sign in ✉️</div>
        <p style={{ color: "var(--slate)", fontSize: 14, lineHeight: 1.5 }}>We'll email you a magic link — no password needed. Your tracked applications sync to your account.</p>
        {sent ? (
          <div style={{ background: "#EAF5EF", border: "1.5px solid var(--green)", color: "var(--green)", borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 14 }}>
            ✅ Check your inbox — link sent to {email}
          </div>
        ) : (
          <>
            <input className="input" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            {err && <div style={{ color: "var(--red)", fontSize: 13, fontWeight: 700, marginTop: 8 }}>{err}</div>}
            <button className="btn btn-accent" style={{ width: "100%", marginTop: 12 }} onClick={send} disabled={!email.includes("@")}>Send magic link →</button>
          </>
        )}
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--slate)", cursor: "pointer", marginTop: 12, fontSize: 13 }}>Close</button>
      </div>
    </div>
  );
}

/* ---------------- marquee ---------------- */
function DeadlineMarquee() {
  const items = [...UNIVERSITIES, ...UNIVERSITIES];
  return (
    <div className="marquee" aria-label="Top universities and application deadlines">
      <div className="marquee-track">
        {items.map((u, i) => (
          <a key={i} href={u.web} target="_blank" rel="noreferrer" className="marquee-item" style={{ color: "#fff", textDecoration: "none" }}>
            <span style={{ color: "#4ade80", fontWeight: 700 }}>{u.qs ? `QS #${u.qs}` : "NEW"}</span>
            <span style={{ fontWeight: 600 }}>{u.name}</span>
            <span style={{ color: "#A9C6B7" }}>{u.country}</span>
            <span style={{ color: "#A9C6B7" }}>⏰ {u.deadline}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ---------------- boarding pass ---------------- */
function BoardingPass({ u, home, idx, tracked, onTrack }) {
  const isTracked = tracked.some((t) => (t.uni?.name || t.name) === u.name);
  return (
    <div className="card" style={{ overflow: "hidden", boxShadow: "0 2px 10px rgba(11,61,46,0.07)", animation: `rise .5s ${idx * 0.08}s both ease-out` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "var(--ink)", color: "#fff" }}>
        <div className="mono" style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.05em" }}>
          {code3(home)} <span style={{ color: "#4ade80" }}>→</span> {code3(u.city)}
        </div>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", color: "#A9C6B7", textTransform: "uppercase" }}>{u.rank || "Ranked"}</div>
      </div>
      <div style={{ padding: "16px 18px 6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <div className="display" style={{ fontWeight: 700, fontSize: 19, lineHeight: 1.2 }}>{u.name}</div>
            <div style={{ color: "var(--slate)", fontSize: 13.5, marginTop: 3 }}>📍 {u.city}, {u.country} · {u.program}</div>
          </div>
          <button onClick={() => onTrack(u)} disabled={isTracked} style={{
            flexShrink: 0, padding: "9px 13px", borderRadius: 8, cursor: isTracked ? "default" : "pointer",
            border: `1.5px solid ${isTracked ? "var(--green)" : "var(--ink)"}`,
            background: isTracked ? "var(--green)" : "transparent", color: isTracked ? "#fff" : "var(--ink)",
            fontWeight: 700, fontSize: 12.5, fontFamily: "Inter, sans-serif",
          }}>{isTracked ? "✓ Tracked" : "⭐ Track"}</button>
        </div>
        <div style={{ fontSize: 14, marginTop: 10, lineHeight: 1.45 }}>{u.why}</div>
        <div style={{ display: "flex", gap: 22, marginTop: 14, flexWrap: "wrap" }}>
          <div><div className="label">💰 Tuition</div><div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{u.tuition}</div></div>
          <div><div className="label">🏠 Living cost</div><div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{u.living}</div></div>
        </div>
        {u.sch?.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="label">🎓 Scholarships</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {u.sch.map((s, i) => (
                <span key={i} style={{ border: "1.5px solid var(--green)", color: "var(--green)", borderRadius: 8, padding: "5px 10px", fontSize: 12.5, fontWeight: 700 }}>{s.n} · {s.c}</span>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginTop: 14, padding: "10px 12px", background: "#EFF6F1", borderRadius: 8, fontSize: 13.5 }}>
          <span className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", color: "var(--accent)", fontWeight: 700 }}>🛂 VISA </span>{u.visa}
        </div>
      </div>
      <div style={{ borderTop: "2px dashed var(--line)", margin: "14px 0 0" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px 16px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 120, height: 44, borderRadius: 3, opacity: 0.85, background: "repeating-linear-gradient(90deg, var(--ink) 0 2px, transparent 2px 5px, var(--ink) 5px 6px, transparent 6px 11px, var(--ink) 11px 14px, transparent 14px 17px)" }} />
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          <a className="btn btn-accent" style={{ padding: "10px 14px", fontSize: 13 }} href={u.apply || u.web} target="_blank" rel="noreferrer">Apply now ↗</a>
          <a className="btn btn-ghost" style={{ padding: "10px 14px", fontSize: 13 }} href={u.web} target="_blank" rel="noreferrer">Website</a>
          <a className="btn btn-ghost" style={{ padding: "10px 14px", fontSize: 13 }} href={`mailto:${u.email}`}>Email</a>
        </div>
      </div>
    </div>
  );
}

/* ---------------- pages ---------------- */

function HomePage() {
  return (
    <>
      <section className="section" style={{ padding: "64px 0 40px" }}>
        <div className="container grid2" style={{ alignItems: "center" }}>
          <div>
            <div className="mono" style={{ fontSize: 12, letterSpacing: "0.18em", color: "var(--accent)", fontWeight: 700 }}>🇺🇿 → 🌍 FOR STUDENTS EVERYWHERE</div>
            <h1 className="hero-h1" style={{ fontWeight: 700, fontSize: 54, lineHeight: 1.02, letterSpacing: "-0.03em", margin: "14px 0" }}>
              Find your direction.<br /><span style={{ color: "var(--accent)" }}>Study anywhere.</span>
            </h1>
            <p style={{ color: "var(--slate)", fontSize: 17, maxWidth: 480, margin: "0 0 26px", lineHeight: 1.55 }}>
              Compass turns "I want to be a game developer 🎮" into real universities, scholarships, living costs, visas and direct application links — free, no consultant.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button className="btn btn-accent" style={{ fontSize: 16, padding: "16px 26px" }} onClick={() => go("advisor")}>🧭 Who do you wanna be? →</button>
              <button className="btn btn-ghost" onClick={() => go("scholarships")}>Scholarships 🎓</button>
            </div>
          </div>
          <CompassHero />
        </div>
      </section>

      <DeadlineMarquee />

      <section className="section">
        <div className="container">
          <div className="grid4">
            {[["1,000+", "universities matched"], [String(SCHOLARSHIPS.length), "major scholarships"], [String(COUNTRY_COSTS.length), "countries mapped"], ["$0", "consultant fees"]].map(([n, l]) => (
              <div key={l} className="card" style={{ padding: "18px 16px", textAlign: "center" }}>
                <div className="display" style={{ fontWeight: 700, fontSize: 28, color: "var(--accent)" }}>{n}</div>
                <div className="label" style={{ marginBottom: 0 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container grid3">
          {[
            ["🧭", "AI Advisor", "Describe who you want to become — get matched universities with costs, scholarships and visas.", "advisor"],
            ["🎓", "Scholarships", "The big fully-funded ones worldwide, with coverage and typical deadlines.", "scholarships"],
            ["🌍", "Cost Globe", "Spin the planet, tap a country, see rent, food, transport and the visa you'd need.", "globe"],
          ].map(([e, t, d, p]) => (
            <button key={t} onClick={() => go(p)} className="card" style={{ padding: 22, textAlign: "left", cursor: "pointer", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: 30 }}>{e}</div>
              <div className="display" style={{ fontWeight: 700, fontSize: 19, margin: "8px 0 6px" }}>{t}</div>
              <div style={{ color: "var(--slate)", fontSize: 14, lineHeight: 1.5 }}>{d}</div>
              <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14, marginTop: 10 }}>Open →</div>
            </button>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="card" style={{ padding: 24, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", borderLeft: "4px solid var(--accent)" }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: "0.16em", color: "var(--slate)" }}>SPONSORED 🤝</div>
              <div className="display" style={{ fontWeight: 700, fontSize: 22, marginTop: 4 }}>{SPONSOR.name}</div>
              <div style={{ color: "var(--slate)", fontSize: 13.5 }}>{SPONSOR.city}</div>
              <p style={{ fontSize: 14.5, lineHeight: 1.5, margin: "10px 0 0" }}>{SPONSOR.pitch}</p>
            </div>
            <a className="btn btn-accent" href={SPONSOR.url} target="_blank" rel="noreferrer">{SPONSOR.cta} ↗</a>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "#ECF3EE", textAlign: "center" }}>
        <div className="container">
          <h2 className="section-title">Never miss a deadline 🔔</h2>
          <p className="section-sub" style={{ margin: "0 auto 24px" }}>New scholarships, deadline alerts and admission tips — follow the channels.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a className="btn btn-ink" href={LINKS.telegram} target="_blank" rel="noreferrer">✈️ Telegram channel</a>
            <a className="btn btn-ghost" href={LINKS.linkedin} target="_blank" rel="noreferrer">💼 LinkedIn</a>
          </div>
        </div>
      </section>
    </>
  );
}

function AdvisorPage({ tracked, track, session }) {
  const [form, setForm] = useState({ goal: "", interests: "", level: "Bachelor's", home: "", budget: BUDGETS[2], regions: [] });
  const [phase, setPhase] = useState("form");
  const [plan, setPlan] = useState(null);
  const [unis, setUnis] = useState([]);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleRegion = (r) => setForm((f) => ({ ...f, regions: f.regions.includes(r) ? f.regions.filter((x) => x !== r) : [...f.regions, r] }));
  const ready = form.goal.trim() && form.interests.trim() && form.home.trim();

  const run = async () => {
    setError(""); setPhase("loading");
    try {
      const p = await fetchPlan(form, []);
      setPlan(p.direction); setUnis(p.unis || []); setPhase("results");
      if (supabase && session) await supabase.from("plans").insert({ user_id: session.user.id, profile: form, result: p });
    } catch (e) { console.error(e); setError("Couldn't build your plan — try again 🙏"); setPhase("form"); }
  };

  const loadMore = async () => {
    setMore(true); setError("");
    try {
      const p = await fetchPlan(form, unis.map((u) => u.name));
      setUnis((prev) => [...prev, ...(p.unis || [])]);
    } catch { setError("Couldn't load more right now."); }
    setMore(false);
  };

  return (
    <section className="section">
      <div className="container">
        <h1 className="section-title">Your AI advisor 🧭</h1>
        <p className="section-sub">Describe yourself like you'd tell a friend. Compass builds your direction, matches universities, and you track them — all in one place.</p>

        {phase === "form" && (
          <div className="card" style={{ padding: "22px 22px 26px", boxShadow: "0 2px 10px rgba(11,61,46,0.06)" }}>
            <div className="label">✈️ Flight plan</div>
            <div style={{ display: "grid", gap: 18, marginTop: 10 }}>
              <div>
                <div className="label">I want to become… 💭</div>
                <input className="input" value={form.goal} onChange={(e) => set("goal", e.target.value)} placeholder="e.g. a game developer, a surgeon, a startup founder" />
              </div>
              <div>
                <div className="label">My interests ❤️</div>
                <textarea className="input" style={{ minHeight: 74, resize: "vertical" }} value={form.interests} onChange={(e) => set("interests", e.target.value)} placeholder="e.g. I love football analytics, coding, and making videos" />
              </div>
              <div className="grid2">
                <div>
                  <div className="label">Home country 🏠</div>
                  <input className="input" value={form.home} onChange={(e) => set("home", e.target.value)} placeholder="e.g. Uzbekistan" />
                </div>
                <div>
                  <div className="label">Study level 📚</div>
                  <select className="input" value={form.level} onChange={(e) => set("level", e.target.value)}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
                </div>
              </div>
              <div>
                <div className="label">Budget 💰</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {BUDGETS.map((b) => <button key={b} className={`chip ${form.budget === b ? "on" : ""}`} onClick={() => set("budget", b)}>{b}</button>)}
                </div>
              </div>
              <div>
                <div className="label">Where in the world 🗺️</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {REGIONS.map((r) => <button key={r} className={`chip ${form.regions.includes(r) ? "on" : ""}`} onClick={() => toggleRegion(r)}>{r}</button>)}
                </div>
              </div>
              {error && <div style={{ color: "var(--red)", fontWeight: 700, fontSize: 14 }}>{error}</div>}
              <button className="btn btn-accent" style={{ padding: "16px 20px", fontSize: 16 }} onClick={run} disabled={!ready}>BUILD MY PLAN →</button>
            </div>
          </div>
        )}

        {phase === "loading" && (
          <div style={{ textAlign: "center", padding: "90px 0" }}>
            <div className="mono" style={{ fontSize: 14, letterSpacing: "0.2em", color: "var(--slate)", animation: "blink 1.1s infinite" }}>SCANNING 1,000 UNIVERSITIES… 🛰️</div>
            <div className="display" style={{ fontWeight: 700, fontSize: 34, marginTop: 14 }}>Plotting your route <span style={{ color: "var(--accent)" }}>→</span></div>
          </div>
        )}

        {phase === "results" && plan && (
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ background: "var(--ink)", color: "#fff", borderRadius: 14, padding: "20px 22px", animation: "rise .5s both" }}>
              <div className="mono" style={{ fontSize: 11, letterSpacing: "0.16em", color: "#4ade80" }}>🎯 YOUR DIRECTION</div>
              <div className="display" style={{ fontWeight: 700, fontSize: 28, margin: "6px 0 8px" }}>{plan.title}</div>
              <div style={{ fontSize: 14.5, lineHeight: 1.55, color: "#DCEAE2", maxWidth: 640 }}>{plan.summary}</div>
              {plan.degrees?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                  {plan.degrees.map((d, i) => <span key={i} className="mono" style={{ border: "1.5px solid #2E5C4A", borderRadius: 8, padding: "5px 10px", fontSize: 12.5 }}>{d}</span>)}
                </div>
              )}
            </div>

            {unis.map((u, i) => <BoardingPass key={u.name + i} u={u} home={form.home} idx={i % 5} tracked={tracked} onTrack={track} />)}
            {error && <div style={{ color: "var(--red)", fontWeight: 700, fontSize: 14, textAlign: "center" }}>{error}</div>}

            <button className="btn btn-ghost" style={{ padding: 15 }} onClick={loadMore} disabled={more}>{more ? "Searching… 🛰️" : "➕ Show 5 more universities"}</button>
            <button onClick={() => { setPhase("form"); setPlan(null); setUnis([]); }} style={{ background: "none", border: "none", color: "var(--slate)", cursor: "pointer", fontSize: 13 }} className="mono">← START A NEW PLAN</button>
            <div style={{ fontSize: 12, color: "var(--slate)", textAlign: "center", lineHeight: 1.5 }}>
              Figures are AI estimates — always confirm tuition, scholarships and visa rules on official sites before applying.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ScholarshipsPage() {
  return (
    <section className="section">
      <div className="container">
        <h1 className="section-title">Scholarships around the world 🎓</h1>
        <p className="section-sub">The big fully-funded ones. Deadlines are typical — always check the official page, they move every year.</p>
        <div className="grid3">
          {SCHOLARSHIPS.map((s) => (
            <a key={s.name} href={s.url} target="_blank" rel="noreferrer" className="card" style={{ padding: 18, textDecoration: "none", display: "block" }}>
              <div style={{ fontSize: 26 }}>{s.emoji}</div>
              <div className="display" style={{ fontWeight: 700, fontSize: 16, marginTop: 6 }}>{s.name}</div>
              <div style={{ color: "var(--slate)", fontSize: 13 }}>{s.country} · {s.level}</div>
              <div style={{ color: "var(--green)", fontWeight: 700, fontSize: 13.5, marginTop: 8 }}>💸 {s.coverage}</div>
              <div className="mono" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700, marginTop: 8 }}>⏰ {s.deadline}</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function GlobePage() {
  const [picked, setPicked] = useState(null);
  const wrapRef = useRef(null);
  const globeRef = useRef(null);
  const [w, setW] = useState(600);

  useEffect(() => {
    const onResize = () => setW(Math.min(wrapRef.current?.offsetWidth || 600, 640));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.6;
    }
  });

  return (
    <section className="section" style={{ background: "var(--ink)", color: "#fff", minHeight: "70vh" }}>
      <div className="container">
        <h1 className="section-title">Spin the globe 🌍</h1>
        <p className="section-sub" style={{ color: "#A9C6B7" }}>Drag to turn it, tap a marker — see estimated rent, food, transport and the visa you'd need there.</p>
        <div className="grid2" style={{ alignItems: "center" }}>
          <div ref={wrapRef} style={{ display: "grid", placeItems: "center", minHeight: 380 }}>
            <Suspense fallback={<div className="mono" style={{ animation: "blink 1.1s infinite", letterSpacing: "0.2em" }}>LOADING EARTH… 🛰️</div>}>
              <Globe
                ref={globeRef}
                width={w}
                height={Math.min(w, 460)}
                backgroundColor="rgba(0,0,0,0)"
                globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg"
                pointsData={COUNTRY_COSTS}
                pointLat="lat" pointLng="lng"
                pointColor={() => "#4ade80"}
                pointAltitude={0.02} pointRadius={0.9}
                pointLabel={(d) => `<b>${d.name}</b><br/>Rent: ${d.rent}/mo`}
                onPointClick={(d) => setPicked(d)}
              />
            </Suspense>
          </div>
          <div>
            {picked ? (
              <div className="card" style={{ padding: 22, color: "var(--ink)", animation: "rise .4s both" }}>
                <div className="display" style={{ fontWeight: 700, fontSize: 24 }}>{picked.name}</div>
                <div className="grid3" style={{ marginTop: 16 }}>
                  <div><div className="label">🏠 Rent /mo</div><div className="mono" style={{ fontWeight: 700 }}>{picked.rent}</div></div>
                  <div><div className="label">🍜 Food /mo</div><div className="mono" style={{ fontWeight: 700 }}>{picked.food}</div></div>
                  <div><div className="label">🚌 Transport</div><div className="mono" style={{ fontWeight: 700 }}>{picked.transport}</div></div>
                </div>
                <div style={{ marginTop: 16, padding: "10px 12px", background: "#EFF6F1", borderRadius: 8, fontSize: 13.5 }}>
                  <span className="mono" style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>🛂 VISA </span>{picked.visa}
                </div>
                <div style={{ marginTop: 10, fontSize: 14, color: "var(--green)", fontWeight: 700 }}>💡 {picked.note}</div>
              </div>
            ) : (
              <div style={{ border: "1.5px dashed #2E5C4A", borderRadius: 14, padding: "40px 24px", textAlign: "center", color: "#A9C6B7" }}>
                👆 Tap a green marker to see costs for that country
              </div>
            )}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#7fa08f", marginTop: 16 }}>Estimates for students, 2026 — always double-check official sources.</div>
      </div>
    </section>
  );
}

function TrackerPage({ tracked, updateTrack, removeTrack, session }) {
  const counts = {
    total: tracked.length,
    progress: tracked.filter((t) => t.status === "In progress").length,
    applied: tracked.filter((t) => t.status === "Applied").length,
    offers: tracked.filter((t) => t.status === "Offer").length,
  };
  return (
    <section className="section">
      <div className="container">
        <h1 className="section-title">My applications 📋</h1>
        <p className="section-sub">{session ? "Synced to your account ✅" : "Saved on this device — sign in to sync across devices 🔄"}</p>

        <div className="grid4" style={{ marginBottom: 18 }}>
          {[["Tracked", counts.total, "var(--ink)"], ["In progress", counts.progress, "var(--amber)"], ["Applied", counts.applied, "var(--blue)"], ["Offers 🎉", counts.offers, "var(--green)"]].map(([l, n, c]) => (
            <div key={l} className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
              <div className="display" style={{ fontWeight: 700, fontSize: 30, color: c }}>{n}</div>
              <div className="label" style={{ marginBottom: 0 }}>{l}</div>
            </div>
          ))}
        </div>

        {tracked.length === 0 ? (
          <div style={{ border: "1.5px dashed var(--line)", borderRadius: 14, padding: "50px 24px", textAlign: "center", background: "var(--card)" }}>
            <div className="display" style={{ fontWeight: 700, fontSize: 18 }}>Nothing tracked yet 👀</div>
            <div style={{ color: "var(--slate)", fontSize: 14, margin: "8px 0 18px" }}>Build your plan with the advisor, then press ⭐ Track on any university.</div>
            <button className="btn btn-accent" onClick={() => go("advisor")}>Find my path →</button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {[...tracked].sort((a, b) => ((a.deadline || "9999") < (b.deadline || "9999") ? -1 : 1)).map((t) => {
              const u = t.uni || t;
              const c = STATUS_COLOR[t.status] || "var(--slate)";
              return (
                <div key={t.id} className="card" style={{ borderLeft: `4px solid ${c}`, padding: "14px 16px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ minWidth: 200, flex: 1 }}>
                      <div className="display" style={{ fontWeight: 700, fontSize: 16 }}>{u.name}</div>
                      <div style={{ color: "var(--slate)", fontSize: 13 }}>📍 {u.city}, {u.country} · {u.program}</div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <select className="input" style={{ width: "auto", padding: "8px 10px", fontSize: 13, fontWeight: 700, color: c, borderColor: c }} value={t.status} onChange={(e) => updateTrack({ ...t, status: e.target.value })}>
                        {STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                      <input className="input" type="date" style={{ width: "auto", padding: "8px 10px", fontSize: 13 }} value={t.deadline || ""} onChange={(e) => updateTrack({ ...t, deadline: e.target.value })} aria-label="Deadline" />
                      <a className="btn btn-ghost" style={{ padding: "8px 12px", fontSize: 12.5 }} href={u.apply || u.web} target="_blank" rel="noreferrer">Apply ↗</a>
                      <button onClick={() => removeTrack(t.id)} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontWeight: 700, fontSize: 12.5 }}>✕</button>
                    </div>
                  </div>
                  {t.deadline && <div className="mono" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700, marginTop: 8 }}>⏰ DEADLINE {t.deadline}</div>}
                  <textarea className="input" style={{ marginTop: 10, minHeight: 44, resize: "vertical", fontSize: 13.5 }} placeholder="My notes… e.g. IELTS booked, need 2 references 📝" value={t.notes || ""} onChange={(e) => updateTrack({ ...t, notes: e.target.value })} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/* ================================================================ */
export default function App() {
  const page = usePage();
  const [session, setSession] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [tracked, setTracked] = useState([]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      if (supabase && session) {
        const { data } = await supabase.from("tracked_applications").select("*").order("created_at");
        setTracked(data || []);
      } else {
        try { setTracked(JSON.parse(localStorage.getItem("compass-tracker") || "[]")); } catch { setTracked([]); }
      }
    })();
  }, [session]);

  const persistLocal = (list) => localStorage.setItem("compass-tracker", JSON.stringify(list));

  const track = async (u) => {
    if (tracked.some((t) => (t.uni?.name || t.name) === u.name)) return;
    if (supabase && session) {
      const { data, error } = await supabase.from("tracked_applications")
        .insert({ user_id: session.user.id, uni: u, status: "Not started", notes: "" }).select().single();
      if (!error && data) setTracked((p) => [...p, data]);
    } else {
      const row = { id: crypto.randomUUID(), uni: u, status: "Not started", deadline: "", notes: "" };
      setTracked((p) => { const n = [...p, row]; persistLocal(n); return n; });
    }
  };

  const updateTrack = async (row) => {
    setTracked((p) => { const n = p.map((t) => (t.id === row.id ? row : t)); if (!session) persistLocal(n); return n; });
    if (supabase && session) {
      await supabase.from("tracked_applications").update({ status: row.status, deadline: row.deadline || null, notes: row.notes }).eq("id", row.id);
    }
  };

  const removeTrack = async (id) => {
    setTracked((p) => { const n = p.filter((t) => t.id !== id); if (!session) persistLocal(n); return n; });
    if (supabase && session) await supabase.from("tracked_applications").delete().eq("id", id);
  };

  const NAV = [["home", "Home"], ["advisor", "🧭 Advisor"], ["scholarships", "🎓 Scholarships"], ["globe", "🌍 Globe"], ["tracker", `📋 Tracker${tracked.length ? ` (${tracked.length})` : ""}`]];

  return (
    <div>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--line)" }}>
        <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px" }}>
          <a href="#/home" className="logo" style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em", textDecoration: "none" }}>
            🧭 Compass<span style={{ color: "var(--accent)" }}>.</span>
          </a>
          <nav className="nav-links" style={{ display: "flex", gap: 4 }}>
            {NAV.map(([id, l]) => (
              <a key={id} href={`#/${id}`} className={`nav-link ${page === id ? "active" : ""}`}>{l}</a>
            ))}
          </nav>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {session ? (
              <>
                <span className="mono" style={{ fontSize: 12, color: "var(--slate)" }}>{session.user.email}</span>
                <button className="btn btn-ghost" style={{ padding: "9px 14px", fontSize: 13 }} onClick={() => supabase.auth.signOut()}>Sign out</button>
              </>
            ) : (
              <button className="btn btn-ink" style={{ padding: "9px 16px", fontSize: 13 }} onClick={() => setAuthOpen(true)}>Sign in</button>
            )}
          </div>
        </div>
      </header>

      {page === "home" && <HomePage />}
      {page === "advisor" && <AdvisorPage tracked={tracked} track={track} session={session} />}
      {page === "scholarships" && <ScholarshipsPage />}
      {page === "globe" && <GlobePage />}
      {page === "tracker" && <TrackerPage tracked={tracked} updateTrack={updateTrack} removeTrack={removeTrack} session={session} />}

      {page !== "advisor" && (
        <a href="#/advisor" className="fab" aria-label="Ask the AI advisor">🧭</a>
      )}

      <footer style={{ background: "var(--ink)", color: "#A9C6B7", padding: "26px 0" }}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, fontSize: 13 }}>
          <div><span className="display" style={{ color: "#fff", fontWeight: 700 }}>🧭 Compass<span style={{ color: "#4ade80" }}>.</span></span> — find your direction 🌍</div>
          <div className="mono" style={{ fontSize: 11 }}>Estimates only — verify on official university & government sites. © {new Date().getFullYear()}</div>
        </div>
      </footer>
    </div>
  );
}
