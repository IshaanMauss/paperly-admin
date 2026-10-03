import { useCallback, useEffect, useState, type FormEvent } from "react";

import { input, panel, primaryButton, secondaryButton } from "@/components/ui";
import { api } from "@/lib/apiClient";
import type { AuthOutboxMessage, AuthProbeResult, AuthStatus } from "@/lib/apiTypes";

const STATUS_CLS: Record<string, string> = {
  mock: "bg-indigo-100 text-indigo-800",
  sent: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-700",
};
const STATUS_TEXT: Record<string, string> = { mock: "Recorded only (nothing sent)", sent: "Sent", failed: "Failed" };
const PURPOSE_TEXT: Record<string, string> = {
  email_verify: "Email sign-up code",
  password_reset: "Password reset code",
  phone_login: "Phone sign-in code",
  phone_link: "Add-phone code",
  admin_probe: "Test message from here",
};

function errorText(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
  } catch {
    // not JSON
  }
  return raw;
}

function when(value: string | null): string {
  if (!value) return "";
  const d = new Date(value.endsWith("Z") || value.includes("+") ? value : value + "Z");
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

/** Run Tests > Sign-in codes: is the server able to send email / text codes, and did a code go out? */
export function SignInCodesPanel() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [messages, setMessages] = useState<AuthOutboxMessage[]>([]);
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AuthProbeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, o] = await Promise.all([api.getAuthStatus(), api.getAuthOutbox(undefined, 30)]);
      setStatus(s);
      setMessages(o.messages);
      setError(null);
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!recipient.trim()) return;
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      setResult(await api.sendAuthProbe(channel, recipient.trim()));
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={panel} data-testid="sign-in-codes-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">Sign-in codes (email and phone)</h3>
          <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-600">
            Send a test code to an email address or phone number and see what happened. Nothing here touches a user account. While there is no mail server or SMS provider, codes are only recorded below (never sent), so you can still confirm the code was created and read it.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className={secondaryButton}>Refresh</button>
      </div>

      {status ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-extrabold">
          <span className={`rounded-full px-3 py-1 ${status.email.mode === "smtp" ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-800"}`}>Email: {status.email.mode === "smtp" ? "real mail server" : "recorded only (no mail server)"}</span>
          <span className={`rounded-full px-3 py-1 ${status.sms.provider !== "mock" && status.sms.configured ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-800"}`}>Text messages: {status.sms.provider === "mock" ? "recorded only (mock)" : status.sms.configured ? `${status.sms.provider} ready` : `${status.sms.provider} not fully set up`}</span>
          <span className={`rounded-full px-3 py-1 ${status.sms.phone_login_enabled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>Phone sign-in: {status.sms.phone_login_enabled ? "on" : "off for users"}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Code lasts {status.otp.minutes} min, {status.otp.max_attempts} tries</span>
        </div>
      ) : null}

      <form onSubmit={send} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs font-extrabold text-slate-600">
          Send to
          <select value={channel} onChange={(e) => { setChannel(e.target.value as "sms" | "email"); setRecipient(""); setResult(null); }} className={input}>
            <option value="sms">Phone number (text message)</option>
            <option value="email">Email address</option>
          </select>
        </label>
        <label className="grid min-w-[16rem] flex-1 gap-1 text-xs font-extrabold text-slate-600">
          {channel === "sms" ? "Phone number" : "Email address"}
          <input className={input} value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder={channel === "sms" ? "98765 43210" : "you@example.com"} type={channel === "sms" ? "tel" : "email"} />
        </label>
        <button type="submit" disabled={busy || !recipient.trim()} className={primaryButton}>{busy ? "Sending..." : "Send test code"}</button>
      </form>

      {result ? (
        <div className={`mt-3 rounded-xl border px-3 py-2 text-sm font-semibold ${result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-800"}`} role="status">
          {result.ok
            ? result.code_visible && result.message?.body
              ? <>Code created and recorded (nothing was sent). The message reads: <span className="font-mono">{result.message.body}</span></>
              : <>The provider accepted the message ({result.message?.status ?? "sent"}). Check the phone or inbox; for safety the code itself is not stored.</>
            : <>It could not be sent: {result.error}</>}
        </div>
      ) : null}
      {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800" role="alert">{error}</p> : null}

      <div className="mt-5">
        <h4 className="text-sm font-extrabold text-slate-900">Recent messages the server tried to send</h4>
        {messages.length === 0 ? (
          <p className="mt-2 text-sm font-semibold text-slate-500">Nothing yet. Ask for a code on the sign-in screen, or send a test code above.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                <tr><th className="py-1 pr-3">When</th><th className="py-1 pr-3">Kind</th><th className="py-1 pr-3">To</th><th className="py-1 pr-3">Result</th><th className="py-1">Message</th></tr>
              </thead>
              <tbody className="align-top font-semibold text-slate-700">
                {messages.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap py-1.5 pr-3">{when(m.created_at)}</td>
                    <td className="py-1.5 pr-3">{m.channel === "sms" ? "Text" : "Email"} - {PURPOSE_TEXT[m.purpose] ?? m.purpose}</td>
                    <td className="break-all py-1.5 pr-3">{m.recipient}</td>
                    <td className="py-1.5 pr-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${STATUS_CLS[m.status] ?? "bg-slate-100"}`}>{STATUS_TEXT[m.status] ?? m.status}</span>{m.error ? <span className="ml-1 text-xs text-rose-700">{m.error}</span> : null}</td>
                    <td className="whitespace-pre-wrap break-words py-1.5 font-mono text-xs">{m.body}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
