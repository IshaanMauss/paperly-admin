import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";
import { useAdminSession } from "@/lib/adminAuth";
import { requestAdminDataRefresh } from "@/lib/adminRefresh";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/teachers", label: "Users" },
  { href: "/billing", label: "Billing" },
  { href: "/maintenance", label: "Maintenance" },
  { href: "/support", label: "Support" },
  { href: "/backups", label: "Backups" },
  { href: "/health", label: "Health" },
  { href: "/security", label: "Security" },
  { href: "/users", label: "Admin Team" },
];

function AquaPattern() {
  return <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(135deg,#fbfaff_0%,#f4efff_42%,#ece3ff_100%)]" />;
}

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const { ready, admin, signOut } = useAdminSession();

  if (!ready) {
    return (
      <>
        <AquaPattern />
        <main className="grid min-h-screen place-items-center px-4">
          <section className="rounded-3xl border border-violet-100 bg-white/85 p-8 text-center shadow-soft">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-purple-600 font-black text-white">P</div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-purple-800">Checking admin session</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">Opening control plane</h1>
          </section>
        </main>
      </>
    );
  }

  if (!admin) {
    void router.replace(`/login?next=${encodeURIComponent(router.asPath || "/")}`);
    return (
      <>
        <AquaPattern />
        <main className="grid min-h-screen place-items-center px-4">
          <section className="rounded-3xl border border-violet-100 bg-white/85 p-8 text-center shadow-soft">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-purple-600 font-black text-white">P</div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-purple-800">Admin sign-in required</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">Redirecting securely</h1>
          </section>
        </main>
      </>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    void router.replace("/login");
  };

  return (
    <>
      <AquaPattern />
      <main className="mx-auto max-w-7xl px-4 py-6 text-slate-700 sm:px-6 lg:px-8 lg:py-8">
        <nav className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 font-black text-white shadow-soft">P</span>
            <span>
              <span className="block text-lg font-extrabold text-slate-950">Paperly Admin Control</span>
              <span className="block text-sm text-slate-500">Signed in as {admin.name} · {admin.role}</span>
            </span>
          </Link>
          <div className="flex flex-wrap gap-2">
            {navItems.map((item) => {
              const active = router.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full border px-3 py-2 text-sm font-bold transition-colors ${
                    active
                      ? "border-violet-200 bg-white/80 text-purple-800 shadow-soft"
                      : "border-transparent text-slate-600 hover:border-violet-200 hover:bg-white/70 hover:text-purple-800"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <button onClick={requestAdminDataRefresh} className="rounded-full border border-violet-200 bg-white/80 px-3 py-2 text-sm font-black text-purple-800 transition-colors hover:bg-violet-50">
              Refresh
            </button>
            <button onClick={handleSignOut} className="rounded-full border border-rose-100 bg-white/80 px-3 py-2 text-sm font-black text-rose-700 transition-colors hover:bg-rose-50">
              Sign out
            </button>
          </div>
        </nav>

        <header className="mb-6 rounded-3xl border border-violet-100 bg-white/75 p-6 shadow-soft">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-purple-800">Admin control plane</p>
          <h1 className="mb-3 max-w-4xl text-4xl font-black tracking-normal text-slate-950 sm:text-5xl">{title}</h1>
          <p className="max-w-3xl text-base font-semibold leading-7 text-slate-600">
            This panel monitors the business and platform layer. Template ingestion, JSON review, approval, and QA sample generation remain inside the existing Paperly backoffice dashboard.
          </p>
        </header>

        {children}
      </main>
    </>
  );
}
