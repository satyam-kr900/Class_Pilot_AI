"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isServerFault, myInstitutes, registerWithBackend, verifyWithBackend } from "@/lib/api";

// Dummy demo account — testing ke liye pre-filled.
// Pehli baar Demo Login dabane par auto-signup ho jayega,
// uske baad seedha login hoga.
const DEMO_EMAIL = "demo@classpilot.ai";
const DEMO_PASSWORD = "Demo1234!";

// Prod me demo login band karna ho to Vercel env me NEXT_PUBLIC_ALLOW_DEMO=0 set karo.
const ALLOW_DEMO = process.env.NEXT_PUBLIC_ALLOW_DEMO !== "0";

const ROLE_BANNERS: Record<string, string> = {
  owner: "🏛️ Owner login — full control: students, batches, fees, staff, reports.",
  teacher: "👩‍🏫 Teacher login — assigned batches, attendance, homework, marks. Institute se invite/link chahiye.",
  parent: "👨‍👩‍👧 Parent login — linked bacchon ki attendance, results, fees. Institute se linking chahiye.",
  student: "🎓 Student login — apni learning: homework, materials, results. Institute se linking chahiye.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4"><p className="text-sm">Loading...</p></main>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const wantRole = search.get("role") || "";
  const roleHint = ROLE_BANNERS[wantRole] ?? "";
  const [email, setEmail] = useState(search.get("email") || (ALLOW_DEMO ? DEMO_EMAIL : ""));
  const [password, setPassword] = useState(ALLOW_DEMO ? DEMO_PASSWORD : "");
  const [msg, setMsg] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  function friendlyAuthError(message: string): string {
    if (/email rate limit exceeded/i.test(message)) {
      return "Email limit full ho gayi hai (Supabase hourly limit). 30–60 min ruko, phir SAME email se dobara try karo. Ya Supabase Dashboard → Authentication → Providers → Email me 'Confirm email' OFF kar do.";
    }
    if (/signups not allowed|signup.*disabled/i.test(message)) {
      return "Naye signup band hain. Supabase Dashboard → Authentication me 'Allow new users to sign up' ON karo.";
    }
    if (/password.*short|password.*weak/i.test(message)) {
      return "Password kam se kam 6 characters ka rakho.";
    }
    if (/invalid login credentials/i.test(message)) {
      return "Email ya password galat hai. Pehle 'New account banao' se signup karo.";
    }
    if (/email not confirmed|not confirmed/i.test(message)) {
      return "Email confirm nahi hui. Inbox ka link kholo, ya backend wale ko 'Confirm email' OFF karne bolo. Phir SAME email se login karo.";
    }
    return message;
  }

  /** Login ke baad: institute hai → dashboard, nahi hai → onboarding (naam wala page). */
  async function nextRoute(accessToken: string): Promise<string> {
    try {
      const res = await myInstitutes(accessToken);
      if (res.memberships.length > 0) return "/dashboard";
      // Naya user + role card se aaya (teacher/student/parent) → onboarding ko hint do
      if (wantRole && wantRole !== "owner" && ROLE_BANNERS[wantRole]) return `/onboarding?role=${wantRole}`;
      return "/onboarding";
    } catch {
      return "/dashboard";
    }
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Logging in...");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMsg(friendlyAuthError(error.message));
      return;
    }
    // Backend se verify — 401 (token kharab) ho to BLOCK,
    // backend down/500 ho to user ki galti nahi → warning ke saath aage jao.
    const token = data.session?.access_token;
    if (!token) {
      setMsg("Session nahi mila. Email confirm kiya hai? Phir try karo.");
      return;
    }
    try {
      await verifyWithBackend(token);
    } catch (err) {
      if (isServerFault(err)) {
        sessionStorage.setItem(
          "cp_backend_warn",
          err instanceof Error ? err.message : "Backend verify pending."
        );
      } else {
        await supabase.auth.signOut();
        setMsg(err instanceof Error ? err.message : "Backend verification failed.");
        return;
      }
    }
    router.push(await nextRoute(token));
  }

  async function onSignup() {
    setMsg("Account ban raha hai...");
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setMsg(friendlyAuthError(error.message));
      return;
    }
    // Email-confirmation OFF ho to session turant milta hai → backend verify + institute
    const token = data.session?.access_token;
    if (!token) {
      setMsg("Signup ho gaya! Email confirm karo, phir SAME email se Login dabao.");
      return;
    }
    try {
      await registerWithBackend(token);
      setMsg("Signup + backend verification ho gaya! Ab Login dabao (same email).");
    } catch (err) {
      // Supabase account BAN gaya hai — sirf backend verify pending hai
      const detail = err instanceof Error ? err.message : "Backend verification failed.";
      if (/failed to fetch|network|ECONNREFUSED/i.test(detail)) {
        setMsg("Account ban gaya! Par backend :8000 chal nahi raha — backend start karo, phir Login dabao.");
      } else {
        setMsg(`Account ban gaya! Backend verify pending: ${detail} — phir bhi Login try karo.`);
      }
    }
  }

  async function onDemoLogin() {
    setDemoLoading(true);
    setMsg("Demo login ho raha hai...");
    try {
      setEmail(DEMO_EMAIL);
      setPassword(DEMO_PASSWORD);
      // 1. Try login
      let res = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      // 2. Pehli baar user nahi hoga → signup, phir backend register (verify + institute)
      if (res.error && /invalid login credentials/i.test(res.error.message)) {
        const signUpRes = await supabase.auth.signUp({
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
        });
        if (signUpRes.error && !/already registered|already exists/i.test(signUpRes.error.message)) {
          setMsg(friendlyAuthError(signUpRes.error.message));
          return;
        }
        if (signUpRes.data.session?.access_token) {
          try {
            await registerWithBackend(signUpRes.data.session.access_token);
          } catch (err) {
            // Account ban gaya — backend pending ho to bhi aage badho
            if (!isServerFault(err)) {
              setMsg(err instanceof Error ? err.message : "Backend verification failed.");
              return;
            }
          }
        }
        res = await supabase.auth.signInWithPassword({
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
        });
      }
      if (res.error) {
        // Email confirmation ON ho to session nahi milta — phir bhi message dikhao
        setMsg(friendlyAuthError(res.error.message));
        return;
      }
      const token = res.data.session?.access_token;
      if (!token) {
        setMsg("Session nahi mila. Email confirm karo phir try karo.");
        return;
      }
      try {
        await verifyWithBackend(token);
      } catch (err) {
        if (isServerFault(err)) {
          sessionStorage.setItem(
            "cp_backend_warn",
            err instanceof Error ? err.message : "Backend verify pending."
          );
        } else {
          await supabase.auth.signOut();
          setMsg(err instanceof Error ? err.message : "Backend verification failed.");
          return;
        }
      }
      router.push(await nextRoute(token));
    } finally {
      setDemoLoading(false);
    }
  }

  async function onResend() {
    if (!email.trim()) {
      setMsg("Pehle email likho, phir resend dabao.");
      return;
    }
    setMsg("Confirmation email dobara bhej rahe hain...");
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
    setMsg(error ? friendlyAuthError(error.message) : "Email bhej di! Inbox (aur spam) check karo, link kholo, phir SAME email se login karo.");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4">
      <form onSubmit={onLogin} className="glass-strong w-full max-w-md space-y-3 p-5 sm:p-8">
        <h1 className="text-xl font-extrabold sm:text-2xl">Welcome back</h1>
        <p className="text-sm text-slate-500">Coaching centre login</p>
        {roleHint && (
          <div className="rounded-2xl border border-blue-300/60 bg-blue-50/70 px-4 py-2.5 text-xs font-medium text-slate-700">
            {roleHint}
          </div>
        )}
        {ALLOW_DEMO && (
          <div className="rounded-2xl border border-dashed border-red-400/60 bg-red-50/60 px-4 py-2.5 text-xs text-slate-600">
            <p className="font-bold text-red-700">⚡ Demo account (testing ke liye)</p>
            <p className="mt-0.5 break-all font-mono">{DEMO_EMAIL} • {DEMO_PASSWORD}</p>
          </div>
        )}
        <input className="glass-input" placeholder="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="relative">
          <input className="glass-input w-full pr-16" placeholder="Password" type={showPw ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
            {showPw ? "Hide" : "Show"}
          </button>
        </div>
        <button className="btn-primary w-full" type="submit">Login</button>
        {ALLOW_DEMO && (
          <button
            className="w-full rounded-2xl bg-[#0a1633] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-90 active:scale-[0.98]"
            type="button"
            onClick={onDemoLogin}
            disabled={demoLoading}
          >
            {demoLoading ? "Demo login..." : "⚡ 1-Tap Demo Login"}
          </button>
        )}
        <button className="btn-ghost w-full" type="button" onClick={onSignup}>New account banao</button>
        <Link
          href={wantRole === "student" ? "/find-account?who=student" : "/find-account?who=parent"}
          className="block w-full rounded-2xl border border-dashed border-blue-300/70 bg-blue-50/50 px-5 py-2.5 text-center text-xs font-bold text-blue-700"
        >
          📱 Email yaad nahi? Mobile se account dhoondo
        </Link>
        <button className="w-full text-xs font-semibold text-slate-500 underline" type="button" onClick={onResend}>
          Email confirm nahi hui? Confirmation dobara bhejo
        </button>
        {msg && <p className="text-xs text-slate-600">{msg}</p>}
      </form>
    </main>
  );
}
