import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, type ReactNode } from "react";
import { useAdminSession } from "@/lib/adminAuth";
import { requestAdminDataRefresh } from "@/lib/adminRefresh";

// Feather-style 24x24 stroke icons, kept inline so the panel has no icon dependency.
const ICONS: Record<string, string> = {
  home: "M3 11l9-8 9 8M5 10v10h14V10",
  users: "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M21 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3",
  building: "M4 21V5l8-2v18M20 21V9l-8-2M8 9h.01M8 13h.01M8 17h.01M16 13h.01M16 17h.01",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  card: "M3 6h18v12H3zM3 10h18",
  tag: "M20 12l-8 8-9-9V3h8zM7.5 7.5h.01",
  spark: "M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  check: "M5 12l5 5L20 7",
  pulse: "M3 12h4l3-8 4 16 3-8h4",
  headset: "M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H5a1 1 0 0 1-1-1zM20 14h-3v5h2a1 1 0 0 0 1-1z",
  wrench: "M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-2.6-.6-.6-2.6z",
  database: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
  menu: "M4 7h16M4 12h16M4 17h16",
  refresh: "M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  close: "M6 6l12 12M18 6L6 18",
};

function Icon({ name, className = "h-[18px] w-[18px]" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={ICONS[name] || ICONS.home} />
    </svg>
  );
}

const navGroups: { heading: string; items: { href: string; label: string; icon: string }[] }[] = [
  { heading: "", items: [{ href: "/", label: "Overview", icon: "home" }] },
  {
    heading: "People",
    items: [
      { href: "/teachers", label: "Users", icon: "users" },
      { href: "/user-360", label: "User 360", icon: "search" },
      { href: "/organizations", label: "Organizations", icon: "building" },
      { href: "/users", label: "Admin Team", icon: "shield" },
    ],
  },
  {
    heading: "Revenue",
    items: [
      { href: "/billing", label: "Billing", icon: "card" },
      { href: "/plans", label: "Plans & Features", icon: "layers" },
      { href: "/offers", label: "Offers", icon: "spark" },
      { href: "/promo-codes", label: "Promo Codes", icon: "tag" },
    ],
  },
  {
    heading: "Product",
    items: [
      { href: "/full-portion", label: "Full Portion", icon: "layers" },
      { href: "/checking", label: "AI Checking", icon: "check" },
      { href: "/variant-health", label: "Variant Health", icon: "pulse" },
    ],
  },
  {
    heading: "Operations",
    items: [
      { href: "/support", label: "Support", icon: "headset" },
      { href: "/maintenance", label: "Maintenance", icon: "wrench" },
      { href: "/backups", label: "Backups", icon: "database" },
      { href: "/health", label: "Health", icon: "pulse" },
      { href: "/logs", label: "Server Logs", icon: "list" },
      { href: "/security", label: "Security", icon: "lock" },
    ],
  },
];

function Splash({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="rounded-2xl border border-violet-200 bg-white p-8 text-center shadow-card">
        <img src="/paperly-mark.png?v=2026-09-04-3" alt="Paperly-NT" className="mx-auto mb-4 h-14 w-14 object-contain" />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-700">{eyebrow}</p>
        <h1 className="mt-2 text-xl font-extrabold text-slate-950">{title}</h1>
      </section>
    </main>
  );
}

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const { ready, admin, signOut } = useAdminSession();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    setDrawer(false);
  }, [router.pathname]);

  if (!ready) return <Splash eyebrow="Checking admin session" title="Opening control plane" />;

  if (!admin) {
    void router.replace(`/login?next=${encodeURIComponent(router.asPath || "/")}`);
    return <Splash eyebrow="Admin sign-in required" title="Redirecting securely" />;
  }

  const handleSignOut = async () => {
    await signOut();
    void router.replace("/login");
  };

  const initials = (admin.name || "A")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/" className="flex items-center gap-3 px-5 py-5">
        <img src="/paperly-mark.png?v=2026-09-04-3" alt="Paperly-NT" className="h-9 w-9 object-contain" />
        <span className="leading-tight">
          <span className="block text-[15px] font-extrabold text-slate-950">Paperly-NT</span>
          <span className="block text-xs font-semibold text-slate-500">Admin control</span>
        </span>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Admin sections">
        {navGroups.map((group) => (
          <div key={group.heading || "top"} className="mb-4">
            {group.heading ? <p className="px-3 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{group.heading}</p> : null}
            {group.items.map((item) => {
              const active = router.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`group mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    active ? "bg-purple-50 text-purple-700" : "text-slate-600 hover:bg-violet-100 hover:text-slate-950"
                  }`}
                >
                  <span className={active ? "text-purple-600" : "text-slate-400 group-hover:text-slate-600"}>
                    <Icon name={item.icon} />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-violet-200 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-purple-100 text-xs font-extrabold text-purple-700">{initials}</span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-bold text-slate-900">{admin.name}</span>
            <span className="block truncate text-xs font-semibold text-slate-500">{admin.role}</span>
          </span>
          <button onClick={handleSignOut} title="Sign out" aria-label="Sign out" className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600">
            <Icon name="logout" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen border-r border-violet-200 bg-white lg:block">{sidebar}</aside>

      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-slate-950/40" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl">{sidebar}</aside>
        </div>
      ) : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-violet-200 bg-white/85 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <button className="rounded-lg p-2 text-slate-600 hover:bg-violet-100 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">{title}</h1>
          <button
            onClick={requestAdminDataRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
          >
            <Icon name="refresh" className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 text-slate-700 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
