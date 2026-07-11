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
  email: "hello@compassabroad.com",
};
const FORMSPREE_ID = "xvzvqbae";
const SPONSOR = {
  name: "New Uzbekistan University",
  city: "Tashkent, Uzbekistan 🇺🇿",
  pitch: "World-class STEM education at home — English-taught programmes, international faculty, and scholarships for top applicants.",
  cta: "Explore programmes",
  url: "https://newuu.uz",
};
const FOUNDER = {
  name: "Abdulaziz Ruzmatov",
  role: "Researcher & Ex-Founder · 🇺🇿 Uzbekistan → 🇬🇧 London",
  photo: "/founder.jpg", // put your photo at public/founder.jpg (or paste any image URL here)
  bio: "Researcher and ex-founder. Former marketing agency owner, now a London-based researcher on education and startup ecosystems. Built Compass so students never have to pay a consultant to find their path — because every rejection is just redirection.",
  stats: [["6+ Years", "Marketing & Business"], ["2 Countries", "UK & Uzbekistan"], ["Active", "Researcher"]],
};
const BLOG_POSTS = [];
/* ======================================================= */

const FIELDS = ["🎮 Game Design", "🩺 Medicine", "🤖 AI & Robotics", "💼 Business", "⚖️ Law", "🎬 Film & Media", "🌱 Environment", "🚀 Aerospace"];
const REGIONS = ["UK & Ireland 🇬🇧", "Europe 🇪🇺", "North America 🇺🇸", "Asia 🌏", "Australia & NZ 🇦🇺", "Middle East 🕌", "Anywhere 🌍"];
const BUDGETS = ["Need full scholarship 🎓", "Under $10k / yr", "$10–25k / yr", "$25–50k / yr", "$50k+ / yr"];
const LEVELS = ["Foundation", "Bachelor's", "Master's", "PhD"];
const STATUSES = ["Not started", "In progress", "Applied", "Offer", "Rejected"];
const STATUS_COLOR = { "Not started": "var(--slate)", "In progress": "var(--amber)", "Applied": "var(--blue)", "Offer": "var(--green)", "Rejected": "var(--red)" };
const FIT_EMOJI = { happy: "😊", mid: "😐", sad: "😢" };

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

/* ---------------- shared profile (used by Advisor, World, Buddy) ---------------- */
const loadProfile = () => { try { return JSON.parse(sessionStorage.getItem("compass-profile") || "{}"); } catch { return {}; } };
const saveProfile = (p) => sessionStorage.setItem("compass-profile", JSON.stringify(p));

/* ---------------- AI ---------------- */
const AI_GUARD = `You are Compass, an expert university-admissions and study-abroad advisor ONLY. You act like a specialist professor of international admissions. You ONLY discuss: universities, degrees, courses, admissions, acceptance chances, scholarships, student visas, application documents, English tests (IELTS/TOEFL), living costs for students, and student work regulations. If asked anything outside study-abroad, politely refuse in one line and steer back. Be accurate, specific and encouraging (failure is a step to success). Never invent fake universities.`;

async function askAI(prompt) {
  prompt = AI_GUARD + "\n\n" + prompt;
  const res = await fetch("/api/advisor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const { text, error } = await res.json();
  if (error) throw new Error(error);
  return text;
}
function parseJSON(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1));
}

function consultPrompt(form) {
  return `A student says: goal "${form.goal}", interests "${form.interests}", level ${form.level}, home ${form.home}, budget ${form.budget}, IELTS ${form.ielts || "none"}, GPA ${form.gpa || "?"}, certificates: ${form.certs || "none"}.
Act like a thoughtful human education consultant meeting them for the first time. Do NOT give universities yet.
Respond ONLY valid JSON:
{"reflection":"4-5 sentences: reflect their goal back, honest pros AND cons of this path for someone like them, one alternative path worth considering","questions":["3 short personal questions a good consultant would ask before recommending (about motivation, constraints, preferences)"]}`;
}

function planPrompt(form, excludeNames) {
  return `You are an expert international education advisor replacing a paid agency. Student profile:
- Wants to become: ${form.goal}
- Interests: ${form.interests}
- Study level: ${form.level}
- Home country: ${form.home}
- Budget: ${form.budget}
- Preferred regions: ${form.regions.join(", ") || "Anywhere"}
- IELTS (or none yet): ${form.ielts || "not taken"}
- GPA / grades: ${form.gpa || "not given"}
- Certificates & achievements: ${form.certs || "none listed"}
${form.answers ? `- Consultation answers (their own words): ${form.answers}` : ""}
${excludeNames.length ? `- Already suggested, DO NOT repeat: ${excludeNames.join("; ")}` : ""}

Recommend exactly 3 real universities, best-fit for this exact profile and budget. Use realistic, current tuition figures. Assess honestly against their scores — like an agency would, but free.

Respond with ONLY valid JSON, no markdown, exactly:
{"direction":{"title":"career title","summary":"2-3 sentences why this path fits their mind and interests","degrees":[{"name":"degree","why":"one line why this degree"}]},
"resources":[{"type":"YouTube","name":"real channel/playlist","why":"one line"},{"type":"Course","name":"real course + platform","why":"one line"},{"type":"Book","name":"real book + author","why":"one line"},{"type":"Community","name":"real community/olympiad","why":"one line"}],
"skills":{"strong":["what already strengthens their application, incl. their certificates"],"gaps":[{"skill":"what is missing","learn":"exactly what to do/learn, with a number or resource"}],"advice":"3 sentences of honest agency-style advice; motivating: failure is a step to success"},
"unis":[{"name":"","country":"","city":"","program":"","rank":"QS ...","fit":"happy|mid|sad","fitWhy":"one line vs their scores","tuition":"$X/yr (realistic)","living":{"rent":"$/mo","weekly":"$ groceries+transport/week"},"work":"work rules for students, one line","visa":{"type":"","funds":"proof of funds","steps":["step1","step2","step3"]},"docs":["required documents"],"sch":[{"n":"scholarship","c":"coverage"}],"apply":"application portal url","web":"official url","email":"admissions email","why":"one line why this uni"}]}`;
}

function worldPrompt(country, prof) {
  return `You are an expert admissions analyst. Country chosen: ${country}. Student profile:
- Goal: ${prof.goal || "undecided"} | Level: ${prof.level || "Bachelor's"} | Budget: ${prof.budget || "any"}
- IELTS: ${prof.ielts || "not taken"} | GPA: ${prof.gpa || "not given"} | Certificates: ${prof.certs || "none"}

List the 14 best universities in ${country} for this student, ranked by realistic admission chance THEN prestige. Use realistic acceptance rates. Honestly rate their personal chance: happy = likely admit, mid = borderline, sad = needs improvement first.

Respond ONLY valid JSON:
{"gaps":{"now":["their current weak points, specific, e.g. IELTS 5.5"],"target":["what each must become, e.g. IELTS 7.0+"],"plan":["concrete action steps in order"]},
"unis":[{"name":"","city":"","lat":0.0,"lng":0.0,"acceptRate":"~X%","fit":"happy|mid|sad","needs":"one line: what THEY need for THIS uni","docs":"key documents, short","why":"one line"}]}
lat/lng must be the real coordinates of each university campus.`;
}


function FounderBar() {
  return (
    <div style={{ background: "#0e4634", color: "#DCEAE2", borderTop: "1px solid #1d5643" }}>
      <div className="container" style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", flexWrap: "wrap" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, overflow: "hidden", border: "2px solid rgba(255,255,255,0.15)", background: "radial-gradient(circle at 35% 30%, #16523d, #0b3d2e)", display: "grid", placeItems: "center", fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, color: "var(--mint)", fontSize: 15 }}>
          <img src={FOUNDER.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.currentTarget.remove(); }} />
        </div>
        <div style={{ flex: 1, minWidth: 200, fontSize: 13.5, lineHeight: 1.4 }}>
          <b style={{ color: "#fff" }}>Built by {FOUNDER.name}</b> — {FOUNDER.role}
        </div>
        <a href="#/contact" style={{ color: "var(--mint)", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>About me →</a>
      </div>
    </div>
  );
}


/* ---------------- study loading animation ---------------- */
function StudyLoader({ title }) {
  const MSGS = ["Reading your answers… 📖", "Comparing 1,000 universities… 🏛️", "Checking scholarships… 🎓", "Calculating your chances… 🧮", "Checking visa rules… 🛂", "Packing your plan… 🎒"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % MSGS.length), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ textAlign: "center", padding: "70px 0" }}>
      <div className="study-row" aria-hidden="true">
        {["📚", "✍️", "🧮", "💡", "🎓"].map((e, j) => (
          <span key={j} className="study-emoji" style={{ animationDelay: `${j * 0.15}s` }}>{e}</span>
        ))}
      </div>
      <div className="fly-track" aria-hidden="true">
        <span className="fly-plane">✈️</span>
        <span className="fly-goal">🎓</span>
      </div>
      <div className="display" style={{ fontWeight: 700, fontSize: 30, margin: "18px 0 8px" }}>{title} <span style={{ color: "var(--accent)" }}>→</span></div>
      <div className="mono" style={{ fontSize: 13.5, letterSpacing: "0.08em", color: "var(--slate)" }} key={i}>
        <span style={{ animation: "rise .4s both" }}>{MSGS[i]}</span>
      </div>
    </div>
  );
}

/* ---------------- compass hero ---------------- */
function CompassHero() {
  const R = 48;
  return (
    <div className="compass-wrap" aria-hidden="true">
      <div className="compass-ring" />
      <div className="orbit">
        {FIELDS.map((f, i) => {
          const a = (i / FIELDS.length) * 2 * Math.PI;
          return (
            <div key={f} className="orbit-chip" style={{ top: `${50 + R * Math.sin(a)}%`, left: `${50 + R * Math.cos(a)}%` }}>
              <span>{f}</span>
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
            <polygon points="50,6 57,50 43,50" fill="#4ade80" />
            <polygon points="50,94 57,50 43,50" fill="#DCEAE2" />
            <circle cx="50" cy="50" r="5.5" fill="#fff" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Buddy chat (floating) ---------------- */
function Buddy() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ role: "buddy", text: "Hey! I'm your Compass Buddy 🧭 Ask me anything — CAS letters, IELTS, visas, deadlines, documents. Short answers, no fluff." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => { boxRef.current?.scrollTo(0, 999999); }, [msgs, open]);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    const history = [...msgs, { role: "you", text: q }];
    setMsgs(history); setBusy(true);
    try {
      const prof = loadProfile();
      const prompt = `You are Compass Buddy, a friendly study-abroad helper. Student profile (may be empty): IELTS ${prof.ielts || "?"}, GPA ${prof.gpa || "?"}, goal ${prof.goal || "?"}, home ${prof.home || "?"}.
Rules: answer in under 120 words, concrete and practical, encouraging tone (failure is a step to success). If asked about CAS, visas, deadlines, documents — give the short checklist.
Conversation so far:
${history.slice(-6).map((m) => `${m.role === "you" ? "Student" : "Buddy"}: ${m.text}`).join("\n")}
Buddy:`;
      const text = await askAI(prompt);
      setMsgs((p) => [...p, { role: "buddy", text: text.trim() }]);
    } catch {
      setMsgs((p) => [...p, { role: "buddy", text: "Hmm, I couldn't reach base 🛰️ — try again in a moment." }]);
    }
    setBusy(false);
  };

  return (
    <>
      {open && (
        <div style={{ position: "fixed", right: 22, bottom: 96, zIndex: 70, width: "min(360px, 92vw)", background: "#fff", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "0 18px 50px rgba(11,61,46,0.3)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "70vh" }}>
          <div style={{ background: "var(--ink)", color: "#fff", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="display" style={{ fontWeight: 700 }}>🧭 Compass Buddy</div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#A9C6B7", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          <div ref={boxRef} style={{ padding: 14, overflowY: "auto", display: "grid", gap: 10, flex: 1 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{
                justifySelf: m.role === "you" ? "end" : "start",
                background: m.role === "you" ? "var(--accent)" : "#EFF6F1",
                color: m.role === "you" ? "#fff" : "var(--ink)",
                borderRadius: 12, padding: "10px 13px", fontSize: 14, lineHeight: 1.45, maxWidth: "85%", whiteSpace: "pre-wrap",
              }}>{m.text}</div>
            ))}
            {busy && <div className="mono" style={{ fontSize: 12, color: "var(--slate)", animation: "blink 1.1s infinite" }}>Buddy is thinking…</div>}
          </div>
          <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--line)" }}>
            <input className="input" style={{ padding: "10px 12px", fontSize: 14 }} placeholder="e.g. What is a CAS letter?" value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
            <button className="btn btn-accent" style={{ padding: "10px 14px", fontSize: 14 }} onClick={send} disabled={busy}>→</button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(!open)} className="fab" aria-label="Compass Buddy chat" style={{ border: "none", cursor: "pointer" }}>
        {open ? "✕" : "🧭"}
      </button>
    </>
  );
}

/* ---------------- auth modal ---------------- */
function AuthModal({ onClose }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const google = async () => {
    setErr("");
    if (!supabase) { setErr("Auth not configured yet."); return; }
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) setErr(error.message);
  };
  const send = async () => {
    setErr("");
    if (!supabase) { setErr("Auth not configured yet."); return; }
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) setErr(error.message); else setSent(true);
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(11,61,46,0.55)", display: "grid", placeItems: "center", zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "min(420px, 92vw)", padding: 26 }}>
        <div className="display" style={{ fontWeight: 700, fontSize: 22 }}>Sign in</div>
        <p style={{ color: "var(--slate)", fontSize: 14, lineHeight: 1.5 }}>Your tracked applications sync to your account across devices.</p>
        <button onClick={google} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "13px", borderRadius: 10, border: "1.5px solid var(--line)", background: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.6 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.4 35.1 44 30 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
          Continue with Google
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0", color: "var(--slate)", fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} /> or with email <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        </div>
        {sent ? (
          <div style={{ background: "#EAF5EF", border: "1.5px solid var(--green)", color: "var(--green)", borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 14 }}>✅ Check your inbox — link sent to {email}</div>
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

/* ---------------- marquee + slider ---------------- */
function DeadlineMarquee() {
  const items = [...UNIVERSITIES, ...UNIVERSITIES];
  return (
    <div className="marquee">
      <div className="marquee-track">
        {items.map((u, i) => (
          <a key={i} href={u.web} target="_blank" rel="noreferrer" className="marquee-item" style={{ color: "#fff", textDecoration: "none" }}>
            <span style={{ color: "var(--mint)", fontWeight: 700 }}>{u.qs ? `QS #${u.qs}` : "NEW"}</span>
            <span style={{ fontWeight: 600 }}>{u.name}</span>
            <span style={{ color: "#A9C6B7" }}>{u.country}</span>
            <span style={{ color: "#A9C6B7" }}>⏰ {u.deadline}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function UniSlider() {
  const sorted = [...UNIVERSITIES].filter((u) => u.qs).sort((a, b) => a.qs - b.qs);
  const items = [...sorted, ...sorted]; // duplicate for seamless loop
  return (
    <section className="section">
      <div className="container">
        <h2 className="section-title">Top universities right now 🏛️</h2>
        <p className="section-sub">QS World 2026 — hover to pause, click to visit.</p>
      </div>
      <div className="autoslide">
        <div className="autoslide-track">
          {items.map((u, i) => (
            <a key={u.name + i} href={u.web} target="_blank" rel="noreferrer" className="pill-card">
              <img src={`https://logo.clearbit.com/${u.domain}`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "grid"; }} />
              <span className="pill-fallback" style={{ display: "none" }}>🏛️</span>
              <div>
                <div className="mono" style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>QS #{u.qs} · {u.country}</div>
                <div className="display" style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.15 }}>{u.name}</div>
                <div style={{ fontSize: 12, color: "var(--slate)" }}>{u.why}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- rich uni card (advisor v2) ---------------- */
function UniCard({ u, home, idx, tracked, onTrack, session, openAuth }) {
  const isTracked = tracked.some((t) => (t.uni?.name || t.name) === u.name);
  const [open, setOpen] = useState(false);
  return (
    <div className="card" style={{ overflow: "hidden", boxShadow: "0 2px 10px rgba(11,61,46,0.07)", animation: `rise .5s ${idx * 0.08}s both ease-out` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "var(--ink)", color: "#fff" }}>
        <div className="mono" style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.05em" }}>
          {code3(home)} <span style={{ color: "var(--mint)" }}>→</span> {code3(u.city)}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 22 }} title={u.fitWhy}>{FIT_EMOJI[u.fit] || "😐"}</span>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", color: "#A9C6B7", textTransform: "uppercase" }}>{u.rank || "Ranked"}</div>
        </div>
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
        <div style={{ fontSize: 14, marginTop: 8 }}>{u.why}</div>
        <div style={{ fontSize: 13, marginTop: 6, color: "var(--slate)" }}>{FIT_EMOJI[u.fit]} <b>Your chance:</b> {u.fitWhy}</div>

        <div style={{ display: "flex", gap: 22, marginTop: 14, flexWrap: "wrap" }}>
          <div><div className="label">💰 Tuition</div><div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{u.tuition}</div></div>
          <div><div className="label">🏠 Rent</div><div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{u.living?.rent}</div></div>
          <div><div className="label">🛒 Weekly costs</div><div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{u.living?.weekly}</div></div>
        </div>

        {u.sch?.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="label">🎓 Scholarships</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {u.sch.map((s, i) => <span key={i} style={{ border: "1.5px solid var(--green)", color: "var(--green)", borderRadius: 8, padding: "5px 10px", fontSize: 12.5, fontWeight: 700 }}>{s.n} · {s.c}</span>)}
            </div>
          </div>
        )}

        {session ? (
          <button onClick={() => setOpen(!open)} style={{ marginTop: 14, background: "none", border: "none", color: "var(--accent)", fontWeight: 700, cursor: "pointer", fontSize: 14, padding: 0 }}>
            {open ? "▲ Hide" : "▼ Visa steps · documents · work rules"}
          </button>
        ) : (
          <button onClick={openAuth} className="unlock-btn">
            🔒 Unlock visa steps, documents & work rules — <b>free, sign in</b>
          </button>
        )}

        {open && (
          <div style={{ marginTop: 10, display: "grid", gap: 10, animation: "rise .3s both" }}>
            <div style={{ padding: "10px 12px", background: "#EFF6F1", borderRadius: 8, fontSize: 13.5 }}>
              <div className="mono" style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, marginBottom: 6 }}>🛂 VISA — {u.visa?.type} · funds: {u.visa?.funds}</div>
              <ol style={{ margin: 0, paddingLeft: 18 }}>{(u.visa?.steps || []).map((s, i) => <li key={i} style={{ marginBottom: 3 }}>{s}</li>)}</ol>
            </div>
            <div style={{ padding: "10px 12px", background: "#EFF6F1", borderRadius: 8, fontSize: 13.5 }}>
              <div className="mono" style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, marginBottom: 6 }}>📄 DOCUMENTS</div>
              {(u.docs || []).join(" · ")}
            </div>
            <div style={{ padding: "10px 12px", background: "#EFF6F1", borderRadius: 8, fontSize: 13.5 }}>
              <div className="mono" style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, marginBottom: 6 }}>💼 WORKING AS A STUDENT</div>
              {u.work}
            </div>
          </div>
        )}
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

/* ================= PAGES ================= */

function HomePage() {
  return (
    <>
      <section className="hero-dark" style={{ padding: "64px 0 56px" }}>
        <div className="container grid2" style={{ alignItems: "center" }}>
          <div>
            <div className="mono" style={{ fontSize: 12, letterSpacing: "0.18em", color: "var(--mint)", fontWeight: 700 }}>🇺🇿 → 🌍 EVERY REJECTION IS REDIRECTION</div>
            <h1 className="hero-h1" style={{ fontWeight: 700, fontSize: 54, lineHeight: 1.02, letterSpacing: "-0.03em", margin: "14px 0", color: "#fff" }}>
              Find your direction.<br /><span style={{ color: "var(--mint)" }}>Aim higher.</span>
            </h1>
            <p style={{ color: "#C9DED2", fontSize: 17, maxWidth: 480, margin: "0 0 26px", lineHeight: 1.55 }}>
              Compass turns "I want to be a game developer 🎮" into degrees explained, real universities, honest chances, visa steps, living costs and scholarships — free, no agency.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button className="btn btn-accent" style={{ fontSize: 16, padding: "16px 26px" }} onClick={() => go("advisor")}>🧭 Who do you wanna be? →</button>
              <button className="btn btn-ghost-light" onClick={() => go("world")}>🌍 Explore countries</button>
            </div>
          </div>
          <CompassHero />
        </div>
      </section>

      <DeadlineMarquee />

      <section className="section" style={{ paddingBottom: 0 }}>
        <div className="container grid4">
          {[["1,000+", "universities matched"], [String(SCHOLARSHIPS.length) + "+", "major scholarships"], [String(COUNTRY_COSTS.length), "countries mapped"], ["$0", "agency fees"]].map(([n, l]) => (
            <div key={l} className="card" style={{ padding: "18px 16px", textAlign: "center" }}>
              <div className="display" style={{ fontWeight: 700, fontSize: 28, color: "var(--accent)" }}>{n}</div>
              <div className="label" style={{ marginBottom: 0 }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      <UniSlider />

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container grid3">
          {[
            ["🧭", "AI Advisor", "Your mind → degrees explained, matched universities, honest chances, visa steps, full costs.", "advisor"],
            ["🌍", "World Explorer", "Pick a country → top 20 unis by acceptance rate, with your personal 😊/😢 chance and what to improve.", "world"],
            ["🎓", "Scholarships", "The famous ones + a live feed from 100 Telegram scholarship channels.", "scholarships"],
          ].map(([e, t, d, p]) => (
            <button key={t} onClick={() => go(p)} className="card" style={{ padding: 22, textAlign: "left", cursor: "pointer" }}>
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
          <div className="card" style={{ padding: 24, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", background: "var(--ink)", color: "#fff", border: "none" }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: "0.16em", color: "#A9C6B7" }}>SPONSORED 🤝</div>
              <div className="display" style={{ fontWeight: 700, fontSize: 22, marginTop: 4 }}>{SPONSOR.name}</div>
              <div style={{ color: "#A9C6B7", fontSize: 13.5 }}>{SPONSOR.city}</div>
              <p style={{ fontSize: 14.5, lineHeight: 1.5, margin: "10px 0 0", color: "#DCEAE2" }}>{SPONSOR.pitch}</p>
            </div>
            <a className="btn btn-accent" href={SPONSOR.url} target="_blank" rel="noreferrer">{SPONSOR.cta} ↗</a>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "#E6F0E9", textAlign: "center" }}>
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

function AdvisorPage({ tracked, track, session, openAuth }) {
  const saved = loadProfile();
  const [form, setForm] = useState({ goal: saved.goal || "", interests: saved.interests || "", level: saved.level || "Bachelor's", home: saved.home || "", budget: saved.budget || BUDGETS[2], regions: saved.regions || [], ielts: saved.ielts || "", gpa: saved.gpa || "", certs: saved.certs || "" });
  const [phase, setPhase] = useState("form");
  const [plan, setPlan] = useState(null);
  const [skills, setSkills] = useState(null);
  const [resources, setResources] = useState([]);
  const [unis, setUnis] = useState([]);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  const [consult, setConsult] = useState(null);
  const [answers, setAnswers] = useState(["", "", ""]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleRegion = (r) => setForm((f) => ({ ...f, regions: f.regions.includes(r) ? f.regions.filter((x) => x !== r) : [...f.regions, r] }));
  const ready = form.goal.trim() && form.interests.trim() && form.home.trim();

  const run = async () => {
    setError(""); setPhase("thinking"); saveProfile(form);
    try {
      const c = parseJSON(await askAI(consultPrompt(form)));
      setConsult(c); setAnswers((c.questions || []).map(() => "")); setPhase("consult");
    } catch (e) { console.error(e); setError("Couldn't reach your consultant — try again 🙏"); setPhase("form"); }
  };

  const buildPlan = async () => {
    setError(""); setPhase("loading");
    const withAnswers = { ...form, answers: (consult?.questions || []).map((q, i) => `${q} → ${answers[i] || "no answer"}`).join(" | ") };
    try {
      const p = parseJSON(await askAI(planPrompt(withAnswers, [])));
      setPlan(p.direction); setSkills(p.skills); setResources(p.resources || []); setUnis(p.unis || []); setPhase("results");
      if (supabase && session) await supabase.from("plans").insert({ user_id: session.user.id, profile: form, result: p });
    } catch (e) { console.error(e); setError("Couldn't build your plan — try again 🙏"); setPhase("consult"); }
  };

  const loadMore = async () => {
    setMore(true); setError("");
    try {
      const p = parseJSON(await askAI(planPrompt(form, unis.map((u) => u.name))));
      setUnis((prev) => [...prev, ...(p.unis || [])]);
    } catch { setError("Couldn't load more right now."); }
    setMore(false);
  };

  return (
    <section className="section">
      <div className="container">
        <h1 className="section-title">Your AI advisor 🧭</h1>
        <p className="section-sub">Tell it your mind. It answers like an agency would — degrees explained, honest chances against your scores, visa steps, real costs, documents — for free.</p>

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
              <div className="grid2">
                <div>
                  <div className="label">IELTS / English score 🗣️ (or empty)</div>
                  <input className="input" value={form.ielts} onChange={(e) => set("ielts", e.target.value)} placeholder="e.g. 6.5, or 'not taken yet'" />
                </div>
                <div>
                  <div className="label">GPA / grades 📊</div>
                  <input className="input" value={form.gpa} onChange={(e) => set("gpa", e.target.value)} placeholder="e.g. 4.2/5, or A-levels AAB" />
                </div>
              </div>
              <div>
                <div className="label">Certificates & achievements 🏅 (they strengthen you!)</div>
                <textarea className="input" style={{ minHeight: 60, resize: "vertical" }} value={form.certs} onChange={(e) => set("certs", e.target.value)} placeholder="e.g. SAT 1350, olympiad medal, coding bootcamp, volunteering…" />
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

        {phase === "thinking" && <StudyLoader title="Your consultant is thinking" />}

        {phase === "consult" && consult && (
          <div style={{ display: "grid", gap: 18, animation: "rise .4s both" }}>
            <div style={{ background: "var(--ink)", color: "#fff", borderRadius: 14, padding: "22px 24px" }}>
              <div className="mono" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--mint)" }}>🧭 YOUR CONSULTANT THINKS…</div>
              <p style={{ fontSize: 15.5, lineHeight: 1.65, color: "#DCEAE2", margin: "10px 0 0" }}>{consult.reflection}</p>
            </div>
            <div className="card" style={{ padding: 24, borderTop: "4px solid var(--accent)" }}>
              <div className="display" style={{ fontWeight: 700, fontSize: 22 }}>Real talk — 3 quick questions 💬</div>
              <p style={{ color: "var(--slate)", fontSize: 14.5, margin: "6px 0 18px", fontFamily: "Inter, sans-serif" }}>Answer like you're texting a friend. No wrong answers — this just makes your plan actually <i>yours</i>. ✌️</p>
              <div style={{ display: "grid", gap: 14 }}>
                {(consult.questions || []).map((q, i) => (
                  <div key={i} className="q-row">
                    <div className="q-num">{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div className="q-text">{q}</div>
                      <input className="input q-input" value={answers[i] || ""} onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))} placeholder="type it like a text message…" />
                    </div>
                  </div>
                ))}
              </div>
              {error && <div style={{ color: "var(--red)", fontWeight: 700, fontSize: 14, marginTop: 10 }}>{error}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                <button className="btn btn-accent" style={{ padding: "14px 22px" }} onClick={buildPlan}>Now build my plan →</button>
                <button className="btn btn-ghost" onClick={buildPlan}>Skip questions</button>
              </div>
            </div>
          </div>
        )}

        {phase === "loading" && <StudyLoader title="Plotting your direction" />}

        {phase === "results" && plan && (
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ background: "var(--ink)", color: "#fff", borderRadius: 14, padding: "20px 22px", animation: "rise .5s both" }}>
              <div className="mono" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--mint)" }}>🎯 YOUR DIRECTION</div>
              <div className="display" style={{ fontWeight: 700, fontSize: 28, margin: "6px 0 8px" }}>{plan.title}</div>
              <div style={{ fontSize: 14.5, lineHeight: 1.55, color: "#DCEAE2", maxWidth: 680 }}>{plan.summary}</div>
              {plan.degrees?.length > 0 && (
                <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                  {plan.degrees.map((d, i) => (
                    <div key={i} style={{ border: "1.5px solid #2E5C4A", borderRadius: 10, padding: "10px 13px", fontSize: 13.5 }}>
                      <b style={{ color: "var(--mint)" }}>{d.name}</b> — {d.why}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {skills && (
              <div className="grid2">
                <div className="card" style={{ padding: 20, borderTop: "4px solid var(--green)" }}>
                  <div className="label">💪 What already strengthens you</div>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
                    {(skills.strong || []).map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div className="card" style={{ padding: 20, borderTop: "4px solid var(--amber)" }}>
                  <div className="label">📈 What to learn next</div>
                  <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                    {(skills.gaps || []).map((g, i) => (
                      <div key={i} style={{ fontSize: 14, lineHeight: 1.5 }}><b>{g.skill}</b> → {g.learn}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {skills?.advice && (
              <div className="card" style={{ padding: 20, background: "#E6F0E9", border: "none" }}>
                <div className="label">🧭 Honest advice</div>
                <div style={{ fontSize: 15, lineHeight: 1.6 }}>{skills.advice}</div>
              </div>
            )}

            {resources.length > 0 && (
              <div className="card" style={{ padding: 20 }}>
                <div className="display" style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>📚 Learn while you apply</div>
                <div className="grid2">
                  {resources.map((r, i) => (
                    <div key={i} style={{ border: "1.5px solid var(--line)", borderRadius: 12, padding: "12px 14px" }}>
                      <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.12em", color: "var(--accent)", fontWeight: 700 }}>{{ YouTube: "▶️ YOUTUBE", Course: "🎓 COURSE", Book: "📖 BOOK", Community: "🌍 COMMUNITY" }[r.type] || "📌 " + (r.type || "").toUpperCase()}</div>
                      <div style={{ fontWeight: 700, fontSize: 14.5, margin: "4px 0 2px" }}>{r.name}</div>
                      <div style={{ color: "var(--slate)", fontSize: 13 }}>{r.why}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {unis.map((u, i) => <UniCard key={u.name + i} u={u} home={form.home} idx={i % 3} tracked={tracked} onTrack={track} session={session} openAuth={openAuth} />)}
            {error && <div style={{ color: "var(--red)", fontWeight: 700, fontSize: 14, textAlign: "center" }}>{error}</div>}

            <button className="btn btn-ghost" style={{ padding: 15 }} onClick={loadMore} disabled={more}>{more ? "Searching… 🛰️" : "➕ Show 3 more universities"}</button>
            <button onClick={() => { setPhase("form"); setPlan(null); setUnis([]); }} style={{ background: "none", border: "none", color: "var(--slate)", cursor: "pointer", fontSize: 13 }} className="mono">← START A NEW PLAN</button>
            <div style={{ fontSize: 12, color: "var(--slate)", textAlign: "center", lineHeight: 1.5 }}>
              AI estimates — always confirm tuition, scholarships and visa rules on official sites before applying.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function WorldPage() {
  const saved = loadProfile();
  const [prof, setProf] = useState({ goal: saved.goal || "", level: saved.level || "Bachelor's", budget: saved.budget || BUDGETS[2], ielts: saved.ielts || "", gpa: saved.gpa || "", certs: saved.certs || "" });
  const [country, setCountry] = useState(null);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setProf((p) => ({ ...p, [k]: v }));

  const wrapRef = useRef(null);
  const globeRef = useRef(null);
  const [w, setW] = useState(720);

  useEffect(() => {
    const onResize = () => setW(Math.min(wrapRef.current?.offsetWidth || 720, 820));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (globeRef.current) {
      const c = globeRef.current.controls();
      c.autoRotate = true; c.autoRotateSpeed = 0.5;
      c.enableZoom = true; c.minDistance = 180; c.maxDistance = 520;
    }
  });

  const explore = async (c) => {
    setCountry(c); setData(null); setError(""); setBusy(true);
    saveProfile({ ...loadProfile(), ...prof });
    // fly the globe to the clicked country
    const target = COUNTRY_COSTS.find((x) => x.name === c);
    if (globeRef.current && target) globeRef.current.pointOfView({ lat: target.lat, lng: target.lng, altitude: 0.7 }, 1200);
    try { setData(parseJSON(await askAI(worldPrompt(c, prof)))); }
    catch (e) { console.error(e); setError("Couldn't load — try again 🙏"); }
    setBusy(false);
    setTimeout(() => document.getElementById("world-results")?.scrollIntoView({ behavior: "smooth" }), 300);
  };

  return (
    <>
      <section className="hero-dark" style={{ padding: "40px 0 24px" }}>
        <div className="container">
          <h1 className="section-title" style={{ color: "#fff" }}>World Explorer 🌍</h1>
          <p className="section-sub" style={{ color: "#A9C6B7" }}>Spin the globe, zoom in, and click a country. Compass opens its best universities by acceptance rate — with your honest personal chance: 😊 ready · 😐 borderline · 😢 needs work. Sad today just means a plan for tomorrow.</p>

          <div className="card" style={{ padding: 18, marginBottom: 8 }}>
            <div className="label">Your profile (used for the 😊/😢 rating)</div>
            <div className="grid3" style={{ marginTop: 8 }}>
              <input className="input" value={prof.ielts} onChange={(e) => set("ielts", e.target.value)} placeholder="IELTS e.g. 5.5 or 'not taken'" />
              <input className="input" value={prof.gpa} onChange={(e) => set("gpa", e.target.value)} placeholder="GPA e.g. 4.2/5" />
              <select className="input" value={prof.level} onChange={(e) => set("level", e.target.value)}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
            </div>
          </div>
        </div>
      </section>

      <section className="hero-dark" style={{ paddingTop: 0 }}>
        <div className="container">
          <div ref={wrapRef} style={{ display: "grid", placeItems: "center", minHeight: 460, position: "relative" }}>
            <Suspense fallback={<div className="mono" style={{ color: "#A9C6B7", animation: "blink 1.1s infinite", letterSpacing: "0.2em" }}>LOADING EARTH… 🛰️</div>}>
              <Globe
                ref={globeRef}
                width={w}
                height={Math.min(w * 0.72, 560)}
                backgroundColor="rgba(0,0,0,0)"
                globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg"
                atmosphereColor="#4ade80"
                atmosphereAltitude={0.18}
                pointsData={data?.unis?.length ? [...COUNTRY_COSTS, ...(data.unis || []).filter((u) => u.lat && u.lng).map((u) => ({ ...u, isUni: true }))] : COUNTRY_COSTS}
                pointLat="lat" pointLng="lng"
                pointColor={(d) => (d.isUni ? "#facc15" : country === d.name ? "#ffffff" : "#4ade80")}
                pointAltitude={(d) => (d.isUni ? 0.09 : country === d.name ? 0.06 : 0.03)}
                pointRadius={(d) => (d.isUni ? 0.55 : 1.2)}
                pointLabel={(d) => d.isUni ? `<b>${FIT_EMOJI[d.fit] || ""} ${d.name}</b><br/>${d.city} · accept ${d.acceptRate}` : `<b>${d.name}</b><br/>click to explore universities`}
                onPointClick={(d) => { if (!d.isUni) explore(d.name); }}
              />
            </Suspense>
            {!country && (
              <div className="mono" style={{ position: "absolute", bottom: 6, color: "#A9C6B7", fontSize: 12, letterSpacing: "0.14em" }}>
                🖱️ DRAG TO SPIN · SCROLL TO ZOOM · CLICK A GREEN DOT
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section" id="world-results">
        <div className="container">
          {busy && <StudyLoader title={`Scanning ${country || ""} universities`} />}
          {error && <div style={{ color: "var(--red)", fontWeight: 700, textAlign: "center" }}>{error}</div>}

          {data && (
            <div style={{ display: "grid", gap: 18, animation: "rise .4s both" }}>
              <h2 className="section-title" style={{ fontSize: 26 }}>{country} — your honest picture</h2>
              <div className="grid2">
                <div className="card" style={{ padding: 20, borderTop: "4px solid var(--red)" }}>
                  <div className="display" style={{ fontWeight: 700, fontSize: 18 }}>😢 Where you are now</div>
                  <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
                    {(data.gaps?.now || []).map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div className="card" style={{ padding: 20, borderTop: "4px solid var(--green)" }}>
                  <div className="display" style={{ fontWeight: 700, fontSize: 18 }}>😊 Improvement plan</div>
                  <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
                    {(data.gaps?.target || []).map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              </div>
              {data.gaps?.plan?.length > 0 && (
                <div className="card" style={{ padding: 20, background: "#E6F0E9", border: "none" }}>
                  <div className="label">🪜 Your steps from 😢 to 😊</div>
                  <ol style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 14.5, lineHeight: 1.7 }}>
                    {data.gaps.plan.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                </div>
              )}

              <h2 className="section-title" style={{ fontSize: 26 }}>Best universities in {country?.replace(/ .*/, "")} for you</h2>
              <div className="grid3">
                {(data.unis || []).map((u) => (
                  <div key={u.name} className="card" style={{ overflow: "hidden" }}>
                    <div className="sch-head" style={{ padding: "14px 16px" }}>
                      <div className="display" style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>{u.name}</div>
                      <div style={{ fontSize: 26 }}>{FIT_EMOJI[u.fit] || "😐"}</div>
                    </div>
                    <div style={{ padding: 14 }}>
                      <div style={{ color: "var(--slate)", fontSize: 13 }}>📍 {u.city} · accept ~<b>{u.acceptRate}</b></div>
                      <div style={{ fontSize: 13.5, margin: "8px 0" }}>{u.why}</div>
                      <div style={{ fontSize: 13, padding: "8px 10px", background: "#EFF6F1", borderRadius: 8 }}><b>You need:</b> {u.needs}</div>
                      <div className="mono" style={{ fontSize: 11.5, color: "var(--slate)", marginTop: 8 }}>📄 {u.docs}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "var(--slate)", textAlign: "center" }}>Acceptance rates and chances are AI estimates — confirm on official pages.</div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function ScholarshipsPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [feed, setFeed] = useState([]);
  const FILTERS = ["All", "Full ride", "UK 🇬🇧", "Europe 🇪🇺", "Asia 🌏", "Americas 🌎"];
  const fullRide = (s) => /full/i.test(s.coverage);
  const region = (s) => {
    if (/UK/.test(s.country)) return "UK 🇬🇧";
    if (/(Germany|Europe|Hungary|France|Netherlands|Switzerland|Türkiye)/.test(s.country)) return "Europe 🇪🇺";
    if (/(Japan|China|Korea|Australia)/.test(s.country)) return "Asia 🌏";
    if (/USA/.test(s.country)) return "Americas 🌎";
    return "Other";
  };
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from("scholarship_feed").select("*").order("posted_at", { ascending: false }).limit(12);
      setFeed(data || []);
    })();
  }, []);
  const list = SCHOLARSHIPS.filter((s) => {
    if (filter === "Full ride" && !fullRide(s)) return false;
    if (["UK 🇬🇧", "Europe 🇪🇺", "Asia 🌏", "Americas 🌎"].includes(filter) && region(s) !== filter) return false;
    if (q && !`${s.name} ${s.country} ${s.level}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const countFull = SCHOLARSHIPS.filter(fullRide).length;
  const countries = new Set(SCHOLARSHIPS.map((s) => s.country)).size;

  return (
    <>
      <section className="hero-dark" style={{ padding: "48px 0 40px", textAlign: "center" }}>
        <div className="container">
          <h1 className="section-title" style={{ color: "#fff", fontSize: 40 }}>🎓 Scholarships Around the World</h1>
          <p style={{ color: "#C9DED2", margin: "0 auto 26px", maxWidth: 560 }}>{SCHOLARSHIPS.length}+ major programmes · billions in funding · don't pay for what's free</p>
          <div className="grid3" style={{ maxWidth: 640, margin: "0 auto 26px" }}>
            {[[String(SCHOLARSHIPS.length), "programmes"], [String(countFull), "full rides"], [String(countries), "destinations"]].map(([n, l]) => (
              <div key={l} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "16px 12px" }}>
                <div className="display" style={{ fontWeight: 700, fontSize: 26, color: "var(--mint)" }}>{n}</div>
                <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", color: "#A9C6B7", textTransform: "uppercase" }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
            {FILTERS.map((f) => (
              <button key={f} className="chip" style={filter === f ? { background: "#fff", color: "var(--ink)", borderColor: "#fff" } : { background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,0.4)" }} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
          <input className="input" style={{ maxWidth: 480, margin: "0 auto", display: "block" }} placeholder="Search scholarships… 🔎" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </section>

      {/* live feed */}
      <section className="section" style={{ paddingBottom: 0 }}>
        <div className="container">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <h2 className="section-title" style={{ fontSize: 24, margin: 0 }}>🔴 Live from Telegram</h2>
            <span className="mono" style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, animation: "blink 1.6s infinite" }}>● LIVE</span>
          </div>
          {feed.length === 0 ? (
            <div className="card" style={{ padding: 18, fontSize: 14, color: "var(--slate)" }}>
              Feed warming up 🔌 — new scholarships from 100+ Telegram channels will appear here the moment they're posted. Meanwhile, join <a href={LINKS.telegram} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontWeight: 700 }}>our channel</a>.
            </div>
          ) : (
            <div className="grid3">
              {feed.map((f) => (
                <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="card" style={{ padding: 16, textDecoration: "none", display: "block" }}>
                  <div className="mono" style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>@{f.source} · {new Date(f.posted_at).toLocaleDateString()}</div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, margin: "6px 0", lineHeight: 1.4 }}>{f.title}</div>
                  {f.coverage && <div style={{ color: "var(--green)", fontWeight: 700, fontSize: 13 }}>💸 {f.coverage}</div>}
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title" style={{ fontSize: 24 }}>🏆 The famous ones</h2>
          <div style={{ color: "var(--slate)", fontSize: 14, marginBottom: 14 }}>Showing <b>{list.length}</b> of {SCHOLARSHIPS.length}</div>
          <div className="grave-grid">
            {list.map((s, i) => (
              <a key={s.name} href={s.url} target="_blank" rel="noreferrer" className="grave-card">
                <div className="grave-head" style={{ background: ["#101828", "#1e3a8a", "#1d5d75", "#111111", "#5b1a1a", "#173a2a", "#2e1e6b", "#7f1d1d"][i % 8] }}>
                  <div className="grave-name">{s.name}</div>
                  <span className="grave-pill">🎓 {/full/i.test(s.coverage) ? "Full Ride" : "Funded"}</span>
                </div>
                <div style={{ padding: "16px 18px" }}>
                  <div style={{ fontWeight: 800, fontSize: 16.5, fontFamily: "Inter, sans-serif" }}>
                    Why {s.name}: <span style={{ color: "var(--slate)" }}>{s.country}</span>
                  </div>
                  <p style={{ color: "#475467", fontSize: 14, lineHeight: 1.5, margin: "8px 0 12px" }}>{s.coverage} — for {s.level} students.</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="tag-green">{s.level}</span>
                    <span className="tag-red">💸 {/full/i.test(s.coverage) ? "100% funded" : "Partial+"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--line)", marginTop: 14, paddingTop: 12 }}>
                    <span className="mono" style={{ fontSize: 12.5, color: "var(--slate)" }}>⏰ {s.deadline}</span>
                    <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Official page →</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--slate)", textAlign: "center", marginTop: 20 }}>Deadlines are typical — always confirm on the official page.</div>
        </div>
      </section>
    </>
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
        <p className="section-sub">{session ? "Synced to your account ✅" : "Saved on this device — sign in with Google or email to sync across devices 🔄"}</p>
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

function BlogPage() {
  return (
    <section className="section">
      <div className="container blog-layout">
        <aside style={{ display: "grid", gap: 16 }}>
          <div style={{ background: "var(--ink)", color: "#fff", borderRadius: 14, padding: 20 }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: "0.16em", color: "#A9C6B7" }}>SPONSORED 🤝</div>
            <div className="display" style={{ fontWeight: 700, fontSize: 19, margin: "6px 0" }}>{SPONSOR.name}</div>
            <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "#DCEAE2", margin: "0 0 14px" }}>{SPONSOR.pitch}</p>
            <a className="btn btn-accent" style={{ padding: "10px 14px", fontSize: 13 }} href={SPONSOR.url} target="_blank" rel="noreferrer">Learn more →</a>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div className="label">🔔 Updates</div>
            <p style={{ fontSize: 13.5, color: "var(--slate)", lineHeight: 1.5, margin: "0 0 12px" }}>Deadline alerts and new scholarships, weekly.</p>
            <a className="btn btn-ink" style={{ padding: "10px 14px", fontSize: 13, display: "block", textAlign: "center" }} href={LINKS.telegram} target="_blank" rel="noreferrer">✈️ Join Telegram</a>
          </div>
        </aside>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 className="section-title">Blog & Guides 📚</h1>
              <p className="section-sub" style={{ margin: 0 }}>Admissions tips, scholarship breakdowns and stories where failure became the first step to success.</p>
            </div>
            <a className="btn btn-accent" href={`mailto:${LINKS.email}?subject=Blog post for Compass`}>Write a post</a>
          </div>
          {BLOG_POSTS.length === 0 ? (
            <div style={{ textAlign: "center", padding: "90px 0", color: "var(--slate)" }}>
              <div style={{ fontSize: 40 }}>📝</div>
              <div className="display" style={{ fontWeight: 700, fontSize: 20, color: "var(--ink)", marginTop: 8 }}>No blog posts yet.</div>
              <div style={{ fontSize: 14, marginTop: 6 }}>Be the first to share a guide or your admission story.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14, marginTop: 22 }}>
              {BLOG_POSTS.map((p) => (
                <a key={p.title} href={p.url} className="card" style={{ padding: 20, textDecoration: "none", display: "block" }}>
                  <div className="mono" style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>{p.tag} · {p.date}</div>
                  <div className="display" style={{ fontWeight: 700, fontSize: 19, margin: "6px 0" }}>{p.title}</div>
                  <div style={{ color: "var(--slate)", fontSize: 14, lineHeight: 1.5 }}>{p.text}</div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ContactPage() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", country: "", message: "" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setBusy(true);
    try {
      const r = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form),
      });
      if (r.ok) setSent(true);
    } catch (e) { console.error(e); }
    setBusy(false);
  };

  return (
    <>
      <section className="section">
        <div className="container grid2" style={{ alignItems: "start" }}>
          <div>
            <h1 className="section-title">Contact Us 💬</h1>
            <p className="section-sub">Questions, partnership ideas, or a university that wants the sponsored slot?</p>
            <div style={{ display: "grid", gap: 16, marginTop: 10 }}>
              {[["✉️", "Email", LINKS.email], ["⏱️", "Response time", "Within 24 hours"], ["🌍", "Serving", "Students everywhere"]].map(([e, t, d]) => (
                <div key={t} style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: "#E6F0E9", display: "grid", placeItems: "center", fontSize: 20 }}>{e}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{t}</div>
                    <div style={{ color: "var(--slate)", fontSize: 14 }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding: 24 }}>
            <div className="display" style={{ fontWeight: 700, fontSize: 20 }}>Send a message</div>
            <p style={{ color: "var(--slate)", fontSize: 13.5, margin: "4px 0 16px" }}>We read every message.</p>
            {sent ? (
              <div style={{ background: "#EAF5EF", border: "1.5px solid var(--green)", color: "var(--green)", borderRadius: 10, padding: 16, fontWeight: 700 }}>✅ Sent — talk soon!</div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                <div><div className="label">Name *</div><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Your name" /></div>
                <div><div className="label">Email *</div><input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="your@email.com" /></div>
                <div><div className="label">Country</div><input className="input" value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="e.g. Uzbekistan" /></div>
                <div><div className="label">Message *</div><textarea className="input" style={{ minHeight: 110, resize: "vertical" }} value={form.message} onChange={(e) => set("message", e.target.value)} /></div>
                <button className="btn btn-accent" onClick={submit} disabled={busy || !form.name || !form.email.includes("@") || !form.message}>{busy ? "Sending…" : "Send Message →"}</button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="hero-dark" style={{ padding: "56px 0" }}>
        <div className="container" style={{ display: "flex", gap: 30, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: 150, height: 150, borderRadius: "50%", flexShrink: 0, overflow: "hidden", border: "4px solid rgba(255,255,255,0.15)", background: "radial-gradient(circle at 35% 30%, #16523d, #0b3d2e)", display: "grid", placeItems: "center", fontSize: 48, fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, color: "var(--mint)" }}>
            <img src={FOUNDER.photo} alt={FOUNDER.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.currentTarget.remove(); }} />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.16em", color: "#A9C6B7" }}>BUILT & FOUNDED BY</div>
            <div className="display" style={{ fontWeight: 700, fontSize: 32, color: "#fff", margin: "6px 0" }}>{FOUNDER.name}</div>
            <div style={{ color: "var(--mint)", fontWeight: 700, fontSize: 14.5 }}>{FOUNDER.role}</div>
            <p style={{ color: "#DCEAE2", fontSize: 15, lineHeight: 1.6, maxWidth: 640, margin: "12px 0 18px" }}>{FOUNDER.bio}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {FOUNDER.stats.map(([n, l]) => (
                <div key={l} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "12px 18px", textAlign: "center" }}>
                  <div className="display" style={{ fontWeight: 700, fontSize: 18, color: "#fff" }}>{n}</div>
                  <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.1em", color: "#A9C6B7", textTransform: "uppercase" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
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

  const NAV = [["home", "Home"], ["advisor", "🧭 Advisor"], ["world", "🌍 World"], ["scholarships", "🎓 Scholarships"], ["tracker", `📋 Tracker${tracked.length ? ` (${tracked.length})` : ""}`], ["blog", "📚 Blog"], ["contact", "💬 Contact"]];

  return (
    <div>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.94)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--line)" }}>
        <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", gap: 10 }}>
          <a href="#/home" className="logo" style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em", textDecoration: "none" }}>
            🧭 Compass<span style={{ color: "var(--accent)" }}>.</span>
          </a>
          <nav className="nav-links" style={{ display: "flex", gap: 2 }}>
            {NAV.map(([id, l]) => <a key={id} href={`#/${id}`} className={`nav-link ${page === id ? "active" : ""}`}>{l}</a>)}
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
      {page === "advisor" && <AdvisorPage tracked={tracked} track={track} session={session} openAuth={() => setAuthOpen(true)} />}
      {page === "world" && <WorldPage />}
      {page === "scholarships" && <ScholarshipsPage />}
      {page === "tracker" && <TrackerPage tracked={tracked} updateTrack={updateTrack} removeTrack={removeTrack} session={session} />}
      {page === "blog" && <BlogPage />}
      {page === "contact" && <ContactPage />}

      <Buddy />

      <FounderBar />

      <footer style={{ background: "var(--ink)", color: "#A9C6B7", padding: "26px 0" }}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, fontSize: 13 }}>
          <div><span className="display" style={{ color: "#fff", fontWeight: 700 }}>🧭 Compass<span style={{ color: "var(--mint)" }}>.</span></span> — every rejection is redirection 🌍</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <a href="#/blog" style={{ textDecoration: "none" }}>Blog</a>
            <a href="#/contact" style={{ textDecoration: "none" }}>Contact</a>
            <a href={LINKS.telegram} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Telegram</a>
          </div>
          <div className="mono" style={{ fontSize: 11 }}>Estimates only — verify on official sites. © {new Date().getFullYear()}</div>
        </div>
      </footer>
    </div>
  );
}
