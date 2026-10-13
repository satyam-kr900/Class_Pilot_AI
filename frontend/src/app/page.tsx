import Link from "next/link";

const ROLES = [
  {
    title: "Institute Owner",
    role: "owner",
    cta: "Login as Owner →",
    desc: "Complete control of your coaching business.",
    points: ["Dashboard & Analytics", "Student & Batch Management", "Fee Collection", "Staff Management"],
    top: "bg-blue-600",
    soft: "bg-blue-50 border-blue-200",
    text: "text-blue-700",
    icon: "🏛️",
  },
  {
    title: "Teacher",
    role: "teacher",
    cta: "Login as Teacher →",
    desc: "Everything you need for smooth teaching.",
    points: ["Class Schedule", "One-tap Attendance", "Homework & Assignments", "Marks Entry"],
    top: "bg-cyan-600",
    soft: "bg-cyan-50 border-cyan-200",
    text: "text-cyan-700",
    icon: "👩‍🏫",
  },
  {
    title: "Parent",
    role: "parent",
    cta: "Login as Parent →",
    desc: "Stay updated about your child's progress.",
    points: ["Child's Attendance", "Fee Dues & Receipts", "Homework Updates", "Announcements"],
    top: "bg-pink-500",
    soft: "bg-pink-50 border-pink-200",
    text: "text-pink-700",
    icon: "👨‍👩‍👧",
  },
  {
    title: "Student",
    role: "student",
    cta: "Login as Student →",
    desc: "Learn, practice, & achieve more.",
    points: ["Study Notes & PDFs", "Practice Tests & Quizzes", "Homework Submission", "Marks & Progress"],
    top: "bg-amber-500",
    soft: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
    icon: "🎓",
  },
];

const STEPS = [
  { n: "1", t: "Institute banao", d: "Naam likho, verify karo — 1 minute me setup. Multiple institutes ek login se.", icon: "🏛️" },
  { n: "2", t: "Students + batches jodo", d: "Student add karo, parent mobile dalo, batch me enrol karo.", icon: "👥" },
  { n: "3", t: "Padhao, track karo, collect karo", d: "Attendance, homework, exams, fees with receipts — sab ek dashboard pe.", icon: "📈" },
];

const FEATURES = [
  ["💰", "Fee + Receipts", "UPI/cash/bank, partial payments, double-click safe receipts, refunds with history."],
  ["✅", "Attendance", "Batch-wise, ek-tap, corrections audited. Parents ko absence updates."],
  ["📝", "Homework & Notes", "Assignments, PDF notes, submissions, grading — mobile pe bhi."],
  ["📊", "Exams & Results", "Draft → marks → publish. Parents/students ko published results hi dikhte hain."],
  ["📱", "Mobile + Web", "Same account everywhere. Parents ke liye simple My Learning view."],
  ["🤖", "AI Workspace", "Quiz generator, concept explain, dues/attendance insights — quota controlled."],
];

const PLANS = [
  { name: "Free", price: "₹0", per: "/month", feats: ["Up to 20 students", "Core records", "Community support"], cta: "Start Free", hl: false },
  { name: "Tutor", price: "₹499", per: "/month", feats: ["Up to 100 students", "Attendance + fees", "Receipts"], cta: "Choose Tutor", hl: false },
  { name: "Growth", price: "₹999", per: "/month", feats: ["Up to 300 students", "Staff access", "Parent reminders"], cta: "Choose Growth", hl: true },
  { name: "Pro", price: "₹1,499", per: "/month", feats: ["Up to 1000 students", "Advanced reports", "AI features"], cta: "Choose Pro", hl: false },
];

const FAQS = [
  ["Kya mera data safe hai?", "Haan — har institute ka data isolated hai (row-level security + server checks). Dusra institute tumhara data dekh hi nahi sakta, aur roles ke hisaab se access milta hai."],
  ["Parents ko alag app download karni hogi?", "Nahi — wahi website/mobile app, parent login se unko sirf apne bacche ka My Learning + Notices dikhta hai."],
  ["Fee online collect hoti hai?", "Abhi manual tracking (cash/UPI/bank entry + receipts). Razorpay auto-collection jald aa raha hai."],
  ["WhatsApp reminders kaise?", "Approved template provider lagne ke baad — guardian opt-in + delivery logs ke saath. Tab tak in-app notices free me."],
  ["Kitne me shuru kar sakte hain?", "Free plan se — 20 students tak ₹0. Badhne par Tutor/Growth/Pro."],
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-clip bg-[#eef2ff] text-slate-800">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-white/40 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-700 text-xl shadow">🎓</span>
            <span className="text-lg font-extrabold sm:text-xl">ClassPilot <span className="text-red-600">AI</span></span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex">
            <a href="#roles" className="transition hover:text-slate-900">Roles</a>
            <a href="#how" className="transition hover:text-slate-900">How it works</a>
            <a href="#features" className="transition hover:text-slate-900">Features</a>
            <a href="#plans" className="transition hover:text-slate-900">Plans</a>
            <a href="#faq" className="transition hover:text-slate-900">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 sm:block">
              Login
            </Link>
            <Link href="/login" className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:bg-red-500">
              Get Started →
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_450px_at_15%_0%,rgba(16,185,129,0.18),transparent),radial-gradient(800px_450px_at_90%_10%,rgba(37,99,235,0.16),transparent)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300/60 bg-red-50 px-3 py-1 text-xs font-extrabold text-red-700">
              ✨ Coaching institutes ke liye — Web + Mobile + AI
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Poora coaching institute, <span className="bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">ek app me.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Students, batches, attendance, fees with receipts, homework, exams aur parent updates — owner se parent tak, sabka apna dashboard.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="rounded-2xl bg-red-600 px-7 py-3.5 text-center text-sm font-extrabold text-white shadow-xl shadow-red-600/30 transition hover:bg-red-500 active:scale-[0.98]">
                Free me shuru karo →
              </Link>
              <Link href="#roles" className="rounded-2xl border border-slate-300 bg-white/70 px-7 py-3.5 text-center text-sm font-extrabold text-slate-700 backdrop-blur transition hover:bg-white">
                Apna role chuno
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
              <span>✓ Free plan, card nahi chahiye</span>
              <span>✓ Hindi + English</span>
              <span>✓ Phone pe chalta hai</span>
            </div>
          </div>

          {/* APP PREVIEW */}
          <div className="relative">
            <div className="overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl">
              <div className="flex items-center justify-between bg-[#0a1633] px-4 py-3 text-white">
                <p className="text-xs font-extrabold">🎓 ClassPilot AI — Preview</p>
                <span className="rounded-full bg-red-500/25 px-2 py-0.5 text-[10px] font-bold text-red-200">Live after login</span>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
                {["Students", "Fees", "Attendance", "Batches"].map((l) => (
                  <div key={l} className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold text-slate-500">{l}</p>
                    <p className="text-lg font-extrabold text-slate-300">—</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 p-3 pt-0">
                {[
                  ["✅", "Attendance saved — 10th-A, 24/25 present"],
                  ["💰", "Fee collected — receipt R-8X2KQ9 generated"],
                  ["📝", "Homework assigned — Maths Ch.5, due Friday"],
                ].map(([i, t]) => (
                  <div key={t} className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2.5 text-xs font-semibold shadow-sm">
                    <span>{i}</span> {t}
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -left-3 top-8 hidden rounded-2xl border bg-white/90 px-3 py-2 text-[11px] font-bold shadow-xl backdrop-blur sm:block">
              👨‍👩‍👧 Parent: fee due dekha ✓
            </div>
            <div className="absolute -right-3 bottom-8 hidden rounded-2xl border bg-white/90 px-3 py-2 text-[11px] font-bold shadow-xl backdrop-blur sm:block">
              🤖 AI: 5 dues pending hain
            </div>
          </div>
        </div>
      </section>

      {/* ROLES */}
      <section id="roles" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl lg:text-4xl">Apna role chuno, andar jao</h2>
        <p className="mt-2 text-center text-sm text-slate-500 sm:text-base">Har card login pe le jata hai — andar role ke hisaab se dashboard khulta hai.</p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ROLES.map((r) => (
            <Link
              key={r.title}
              href={`/login?role=${r.role}`}
              className={`group block overflow-hidden rounded-3xl border ${r.soft} bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl`}
            >
              <div className={`${r.top} px-5 pb-7 pt-5 text-white`}>
                <p className="text-3xl">{r.icon}</p>
                <p className="mt-2 text-lg font-extrabold">{r.title}</p>
                <p className="text-xs opacity-90">{r.desc}</p>
              </div>
              <div className="p-4">
                <ul className="space-y-1.5">
                  {r.points.map((p) => (
                    <li key={p} className="flex items-start gap-1.5 text-xs font-medium text-slate-600">
                      <span className={`${r.text} font-extrabold`}>✓</span> {p}
                    </li>
                  ))}
                </ul>
                <span className={`mt-4 block rounded-xl px-4 py-2.5 text-center text-xs font-extrabold text-white ${r.top} transition group-hover:opacity-90`}>
                  {r.cta}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <h2 className="text-center text-2xl font-extrabold sm:text-3xl">3 steps me live</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative overflow-hidden rounded-3xl border border-slate-100 bg-slate-50 p-6">
                <span className="absolute -right-2 -top-4 text-7xl font-extrabold text-slate-200">{s.n}</span>
                <p className="text-3xl">{s.icon}</p>
                <p className="mt-3 text-base font-extrabold">{s.t}</p>
                <p className="mt-1 text-sm text-slate-500">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/login" className="inline-block rounded-2xl bg-[#0a1633] px-8 py-3.5 text-sm font-extrabold text-white transition hover:bg-slate-800">
              Step 1 shuru karo →
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Sab kuch, sahi jagah</h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([i, t, d]) => (
            <div key={t} className="rounded-3xl border border-white/50 bg-white/70 p-5 shadow-sm backdrop-blur transition hover:shadow-lg">
              <p className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 text-xl">{i}</p>
              <p className="mt-3 text-sm font-extrabold">{t}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PLANS */}
      <section id="plans" className="scroll-mt-20 bg-[#0a1633]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <h2 className="text-center text-2xl font-extrabold text-white sm:text-3xl">Seedha-saadha pricing</h2>
          <p className="mt-1 text-center text-sm text-slate-300">Free se shuru karo. Jab badho, tab upgrade.</p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((p) => (
              <div key={p.name} className={`relative rounded-3xl p-6 ${p.hl ? "bg-white text-slate-800 ring-4 ring-red-400" : "border border-white/15 bg-white/5 text-white backdrop-blur"}`}>
                {p.hl && <span className="absolute -top-3 right-4 rounded-full bg-red-500 px-3 py-0.5 text-[11px] font-extrabold text-white">Popular</span>}
                <p className="text-base font-extrabold">{p.name}</p>
                <p className="mt-1"><span className="text-3xl font-extrabold">{p.price}</span> <span className={`text-xs ${p.hl ? "text-slate-500" : "text-slate-300"}`}>{p.per}</span></p>
                <ul className="mt-4 space-y-2">
                  {p.feats.map((f) => (
                    <li key={f} className={`flex items-center gap-2 text-sm font-medium ${p.hl ? "text-slate-600" : "text-slate-200"}`}><span className="text-red-500">✓</span> {f}</li>
                  ))}
                </ul>
                <Link href="/login" className={`mt-5 block rounded-xl px-4 py-2.5 text-center text-sm font-bold transition ${p.hl ? "bg-red-600 text-white hover:bg-red-500" : "bg-white/10 text-white hover:bg-white/20"}`}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-4xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Sawaal-jawaab</h2>
        <div className="mt-8 space-y-3">
          {FAQS.map(([q, a]) => (
            <details key={q} className="group rounded-2xl border border-white/50 bg-white/70 px-5 py-4 backdrop-blur">
              <summary className="cursor-pointer text-sm font-extrabold list-none [&::-webkit-details-marker]:hidden">
                <span className="mr-2 text-red-600 transition group-open:inline-block group-open:rotate-90">▶</span>{q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{a}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 rounded-3xl bg-red-600 px-6 py-8 text-center text-white shadow-xl shadow-red-600/25">
          <p className="text-xl font-extrabold sm:text-2xl">Apna coaching smart banao 🚀</p>
          <p className="mt-1 text-sm opacity-90">1 minute me institute banao. Free plan, card nahi chahiye.</p>
          <Link href="/login" className="mt-5 inline-block rounded-2xl bg-white px-8 py-3 text-sm font-extrabold text-red-700 transition hover:bg-red-50">
            Get Started Free →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:px-6">
          <p className="font-bold">🎓 ClassPilot AI — Smarter Coaching. Brighter Future.</p>
          <div className="flex gap-5 font-semibold">
            <Link href="/login" className="hover:text-slate-800">Login</Link>
            <Link href="/find-account" className="hover:text-slate-800">Find Account</Link>
            <Link href="/dashboard" className="hover:text-slate-800">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
