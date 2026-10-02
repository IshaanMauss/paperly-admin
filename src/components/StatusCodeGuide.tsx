import { useMemo, useState } from "react";

import { input } from "@/components/ui";

type Kind = "good" | "user" | "us" | "outside";

type CodeInfo = {
  code: number;
  name: string;
  kind: Kind;
  meaning: string;
  where: string;
  action: string;
};

const KIND_LABEL: Record<Kind, { label: string; badge: string }> = {
  good: { label: "Good", badge: "bg-emerald-100 text-emerald-800" },
  user: { label: "User-side (not a bug)", badge: "bg-amber-100 text-amber-800" },
  us: { label: "Our bug or setup", badge: "bg-rose-100 text-rose-700" },
  outside: { label: "Outside service", badge: "bg-sky-100 text-sky-800" },
};

// Only codes the Paperly backend really returns (counted from the code), plus the few
// that come from the hosting layer. Wording is specific to our endpoints.
const CODES: CodeInfo[] = [
  { code: 200, name: "OK", kind: "good", meaning: "The request worked and the answer was sent back.", where: "Almost every endpoint: loading pages, lists, billing status, downloading a paper.", action: "Nothing to do." },
  { code: 201, name: "Created", kind: "good", meaning: "Something new was saved successfully.", where: "Creating a template, a support ticket, an institute, a promo code.", action: "Nothing to do." },
  { code: 400, name: "Bad request", kind: "user", meaning: "The request reached us but the details were wrong.", where: "Wrong or expired email verification code, an invalid id in the URL, an unknown plan code, a restore without the confirmation phrase.", action: "Usually the person typed something wrong. Only worry if one path shows hundreds of these." },
  { code: 401, name: "Not signed in", kind: "user", meaning: "The person is not signed in, or their sign-in expired.", where: "'Sign in again' messages on profile, usage, billing and support. Also refresh calls with no cookie (the app answers these itself).", action: "Normal after a long idle time. A sudden spike for many users after a deploy means sign-in cookies or refresh is broken." },
  { code: 402, name: "Plan limit reached", kind: "user", meaning: "The person's plan does not allow this, or their quota is used up.", where: "Generating papers or running AI checking when quota is finished or the plan is not active.", action: "Not a bug. It is the paywall working. Check billing if a paying user gets it." },
  { code: 403, name: "Not allowed", kind: "user", meaning: "Signed in, but this action is not permitted.", where: "Suspended accounts; non-owner admins doing owner-only actions (grant plan, simulate billing); admin API called from outside the gateway.", action: "Check the account status or the admin role. Many 403 on /admin paths means the gateway setting is wrong." },
  { code: 404, name: "Not found", kind: "user", meaning: "The thing asked for does not exist (it is NOT a database error).", where: "User, worksheet, support ticket, institute, checking submission or log entry that was deleted or never existed.", action: "Usually an old link or a deleted item. A database problem shows up as 500 or 503, not 404." },
  { code: 409, name: "Conflict", kind: "user", meaning: "The request clashes with something that already exists.", where: "Email already registered, activation link already used, email linked to another Google account, removing the only owner, seat limit full.", action: "Not a bug. Tell the person what is in the message." },
  { code: 410, name: "Gone", kind: "user", meaning: "This used to be valid but has ended.", where: "Joining an institute whose plan has ended.", action: "Renew or extend the institute in the Organizations page." },
  { code: 413, name: "File too big", kind: "user", meaning: "An uploaded image is larger than 8 MB.", where: "Question paper / mark scheme upload in the dashboard extract flow.", action: "Ask for a smaller image." },
  { code: 415, name: "Wrong file type", kind: "user", meaning: "Upload is not PNG, JPG or WEBP.", where: "Same extract upload.", action: "Ask for a supported image type." },
  { code: 422, name: "Invalid data", kind: "user", meaning: "The data failed our validation rules.", where: "Bad email format, wrong role, a template missing required parts, sample_count above 20 in template preview, 'You cannot deactivate your own account'.", action: "Read the message in the row. A burst on one path after a deploy means the app and backend disagree on the data shape." },
  { code: 429, name: "Too many requests", kind: "user", meaning: "The person (or a script) asked too often and was slowed down.", where: "Requesting or trying email verification codes too often; the general rate limiter.", action: "Normal protection. If real users hit it, the limit may be too tight. Load tests with the bypass token are exempt." },
  { code: 500, name: "Server error (our code)", kind: "us", meaning: "Our own code crashed. This is a bug, or a database problem we did not handle.", where: "Any endpoint. The row shows the error type and message; the Problems list groups repeats and explains them.", action: "Always worth fixing. Open the row to see the error text and the Troubleshoot box." },
  { code: 502, name: "Bad gateway (Razorpay)", kind: "outside", meaning: "We asked Razorpay and its answer failed or was unreachable.", where: "Creating a Razorpay order and confirming a payment on the billing routes.", action: "If a user was charged, the webhook still activates the plan within about a minute. Check Razorpay status and keys." },
  { code: 503, name: "Service unavailable", kind: "us", meaning: "A needed part is not set up or is temporarily off.", where: "Plan-config tables missing (run plan-config-migration.sql), email service not configured, Google sign-in unavailable, draft autosave unavailable, database connection busy.", action: "Usually a missing setting or an SQL file not yet run. Read the message in the row." },
  { code: 504, name: "Timed out (hosting)", kind: "outside", meaning: "The request took too long and the hosting layer gave up. Our code does not send this itself.", where: "Very slow endpoints such as big exports or heavy generation under load.", action: "Look at latency on that path and the worker count." },
];

export function StatusCodeGuide({ counts }: { counts: { status_code: number; count: number }[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const countMap = useMemo(() => new Map(counts.map((entry) => [entry.status_code, entry.count])), [counts]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CODES;
    return CODES.filter((c) => `${c.code} ${c.name} ${c.meaning} ${c.where} ${c.action}`.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="mt-5 rounded-xl border border-slate-100 bg-white/60 p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">What every status code means in Paperly ({CODES.length} codes the API uses)</span>
        <span className="text-xs font-extrabold text-violet-700">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="mt-3">
          <p className="text-sm font-semibold text-slate-600">
            Good = 200s. Codes starting with 4 mean the request was wrong or not allowed (usually the user, not a bug). Codes starting with 5 mean the problem is on our side or a service we depend on. The number on the right is how many times it appears in the recent log window.
          </p>
          <input value={query} onChange={(e) => setQuery(e.target.value)} className={`${input} mt-3`} placeholder="Search a code or word, e.g. 503, Razorpay, email..." />
          <div className="mt-3 space-y-2">
            {rows.map((c) => (
              <div key={c.code} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-extrabold text-slate-900">{c.code}</span>
                  <span className="font-extrabold text-slate-800">{c.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${KIND_LABEL[c.kind].badge}`}>{KIND_LABEL[c.kind].label}</span>
                  <span className="ml-auto text-xs font-extrabold text-slate-500">{countMap.get(c.code) ?? 0} recently</span>
                </div>
                <p className="mt-1 font-semibold text-slate-700">{c.meaning}</p>
                <p className="mt-1 text-slate-600"><span className="font-extrabold">Where in Paperly:</span> {c.where}</p>
                <p className="mt-1 text-slate-600"><span className="font-extrabold">What to do:</span> {c.action}</p>
              </div>
            ))}
            {rows.length === 0 ? <p className="text-sm font-semibold text-slate-500">No code matches that.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
