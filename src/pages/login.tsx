import { FormEvent, useState } from "react";
import { useRouter } from "next/router";
import { useAdminSession } from "@/lib/adminAuth";
import { errorNotice, input, label, primaryButton } from "@/components/ui";

function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#f4efff]">
      <div className="absolute inset-x-0 top-[36%] h-[30%] bg-violet-200/45" />
      <div className="absolute inset-x-0 bottom-0 h-[36%] bg-violet-300/35" />
      <div className="absolute left-[22%] top-[-10%] h-[130%] w-[30rem] -skew-x-[24deg] bg-white/45" />
      <div className="absolute right-[-12%] top-[-10%] h-[120%] w-[26rem] skew-x-[24deg] bg-violet-300/20" />
    </div>
  );
}

function safeNext(value: unknown) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) return "/";
  return value;
}

export default function LoginPage() {
  const router = useRouter();
  const { ready, admin, signIn } = useAdminSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (ready && admin) {
    void router.replace(safeNext(router.query.next));
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await signIn(email, password);
      await router.replace(safeNext(router.query.next));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Background />
      <main className="grid min-h-screen place-items-center px-4 py-10">
        <section className="w-full max-w-md rounded-3xl border border-violet-100 bg-white/90 p-7 shadow-soft">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-purple-500 to-violet-700 font-black text-white shadow-lg shadow-violet-200">P</span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-purple-800">Paperly Admin</p>
              <h1 className="text-2xl font-black text-slate-950">Sign in to control plane</h1>
            </div>
          </div>
          {error ? <div className={errorNotice}>{error}</div> : null}
          <form onSubmit={onSubmit} className="grid gap-4">
            <label className={label}>
              Email
              <input className={input} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" type="email" required />
            </label>
            <label className={label}>
              Password
              <div className="relative mt-1">
                <input className={`${input} pr-20`} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" type={showPassword ? "text" : "password"} required />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1 text-xs font-extrabold text-purple-800 transition hover:bg-violet-50"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <button className={primaryButton} disabled={submitting}>{submitting ? "Signing in..." : "Sign in"}</button>
          </form>
          <p className="mt-5 text-sm font-semibold leading-6 text-slate-500">
            Use the admin account created from backend bootstrap credentials. This panel should also sit behind Cloudflare Access or Tailscale before hosted production exposure.
          </p>
        </section>
      </main>
    </>
  );
}
