import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/router";

import { AppShell } from "@/components/AppShell";
import { panel, planLabel } from "@/components/ui";
import { api, UserResolveHit, UserThreeSixty, UserThreeSixtyTimelineItem } from "@/lib/apiClient";
import { usePersistedState } from "@/lib/draftStore";
import { requestAdminDataRefresh } from "@/lib/adminRefresh";

function formatDateTime(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Never";
  return date.toLocaleString();
}

const KIND_LABELS: Record<UserThreeSixtyTimelineItem["kind"], string> = {
  account: "Account",
  payment: "Payment",
  promo: "Promo code",
  support: "Support",
  usage: "Product usage",
  security: "Security",
  activity: "Activity",
  request: "API request",
  admin_action: "Admin action",
};

const STATUS_STYLES: Record<UserThreeSixtyTimelineItem["status"], string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
};

const KIND_FILTERS: Array<{ key: "all" | UserThreeSixtyTimelineItem["kind"]; label: string }> = [
  { key: "all", label: "Everything" },
  { key: "payment", label: "Payments" },
  { key: "promo", label: "Promo codes" },
  { key: "support", label: "Support" },
  { key: "usage", label: "Product usage" },
  { key: "security", label: "Security" },
  { key: "request", label: "API requests" },
  { key: "account", label: "Account" },
  { key: "activity", label: "Other activity" },
  { key: "admin_action", label: "Admin actions taken" },
];

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" | "warning" | "default" }) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-violet-200 bg-violet-50/60 text-slate-800";
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}

function ActionCard({
  title,
  description,
  busy,
  error,
  success,
  onSubmit,
  children,
  submitLabel,
  confirmMessage,
}: {
  title: string;
  description: string;
  busy: boolean;
  error: string | null;
  success: string | null;
  onSubmit: () => void;
  children: ReactNode;
  submitLabel: string;
  confirmMessage: string;
}) {
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-4">
      <p className="text-sm font-extrabold text-slate-900">{title}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{description}</p>
      <div className="mt-3 space-y-2">{children}</div>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (window.confirm(confirmMessage)) onSubmit();
        }}
        className="mt-3 rounded-xl bg-purple-700 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Working..." : submitLabel}
      </button>
      {error && <p className="mt-2 text-xs font-bold text-rose-700">{error}</p>}
      {success && <p className="mt-2 text-xs font-bold text-emerald-700">{success}</p>}
    </div>
  );
}

export default function UserThreeSixtyPage() {
  const router = useRouter();
  const teacherIdParam = typeof router.query.teacher_id === "string" ? router.query.teacher_id : "";

  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState<UserResolveHit[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);

  const [data, setData] = useState<UserThreeSixty | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"all" | UserThreeSixtyTimelineItem["kind"]>("all");

  const [planOptions, setPlanOptions] = useState<Record<string, string>>({});
  const [grantPlan, setGrantPlan] = useState("");
  const [grantReason, setGrantReason] = usePersistedState(teacherIdParam ? `user360.${teacherIdParam}.grantReason` : "", "");
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null);

  const [promoCode, setPromoCode] = useState("");
  const [promoReason, setPromoReason] = usePersistedState(teacherIdParam ? `user360.${teacherIdParam}.promoReason` : "", "");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);

  const [sessionReason, setSessionReason] = usePersistedState(teacherIdParam ? `user360.${teacherIdParam}.sessionReason` : "", "");
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionSuccess, setSessionSuccess] = useState<string | null>(null);

  // Added 2026-09-28: suspend/unsuspend, export-on-behalf, delete, and
  // billing-cancel - previously none of these existed for admin at all.
  const [suspendReason, setSuspendReason] = usePersistedState(teacherIdParam ? `user360.${teacherIdParam}.suspendReason` : "", "");
  const [suspendBusy, setSuspendBusy] = useState(false);
  const [suspendError, setSuspendError] = useState<string | null>(null);
  const [suspendSuccess, setSuspendSuccess] = useState<string | null>(null);

  const [exportBusy, setExportBusy] = useState(false);
  const [exportOnBehalfError, setExportOnBehalfError] = useState<string | null>(null);

  const [billingCancelReason, setBillingCancelReason] = usePersistedState(teacherIdParam ? `user360.${teacherIdParam}.billingCancelReason` : "", "");
  const [billingCancelBusy, setBillingCancelBusy] = useState(false);
  const [billingCancelError, setBillingCancelError] = useState<string | null>(null);
  const [billingCancelSuccess, setBillingCancelSuccess] = useState<string | null>(null);
  const [refundReason, setRefundReason] = usePersistedState(teacherIdParam ? `user360.${teacherIdParam}.refundReason` : "", "");
  const [refundAmount, setRefundAmount] = usePersistedState(teacherIdParam ? `user360.${teacherIdParam}.refundAmount` : "", "");
  const [refundCancelPlan, setRefundCancelPlan] = useState(true);
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState<string | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState("");
  const [deleteReason, setDeleteReason] = usePersistedState(teacherIdParam ? `user360.${teacherIdParam}.deleteReason` : "", "");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [exportBusyId, setExportBusyId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const [quotaReason, setQuotaReason] = usePersistedState(teacherIdParam ? `user360.${teacherIdParam}.quotaReason` : "", "");
  const [quotaBusy, setQuotaBusy] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [quotaSuccess, setQuotaSuccess] = useState<string | null>(null);

  const [unstickReason, setUnstickReason] = usePersistedState(teacherIdParam ? `user360.${teacherIdParam}.unstickReason` : "", "");
  const [unstickBusy, setUnstickBusy] = useState(false);
  const [unstickError, setUnstickError] = useState<string | null>(null);
  const [unstickSuccess, setUnstickSuccess] = useState<string | null>(null);

  const [verifyReason, setVerifyReason] = usePersistedState(teacherIdParam ? `user360.${teacherIdParam}.verifyReason` : "", "");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);

  useEffect(() => {
    api.getPromoCodes().then((response) => setPlanOptions(response.plan_options)).catch(() => undefined);
  }, []);

  function reload() {
    if (!teacherIdParam) return;
    api.getUserThreeSixty(teacherIdParam).then((response) => setData(response)).catch(() => undefined);
  }

  async function submitGrantPlan() {
    if (!teacherIdParam || !grantPlan || grantReason.trim().length < 8) {
      setGrantError("Pick a plan and write a reason of at least 8 characters.");
      return;
    }
    setGrantBusy(true);
    setGrantError(null);
    setGrantSuccess(null);
    try {
      await api.grantUserPlan(teacherIdParam, { plan_code: grantPlan, reason: grantReason.trim() });
      setGrantSuccess(`Granted ${grantPlan} to this user.`);
      setGrantReason("");
      reload();
      requestAdminDataRefresh();
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : "Could not grant this plan.");
    } finally {
      setGrantBusy(false);
    }
  }

  async function submitForceRedeem() {
    if (!teacherIdParam || !promoCode.trim() || promoReason.trim().length < 8) {
      setPromoError("Enter the code and write a reason of at least 8 characters.");
      return;
    }
    setPromoBusy(true);
    setPromoError(null);
    setPromoSuccess(null);
    try {
      const result = await api.forceRedeemPromoForUser(teacherIdParam, { code: promoCode.trim(), reason: promoReason.trim() });
      setPromoSuccess(`Redeemed "${promoCode.trim().toUpperCase()}" - now on ${result.promo.plan_label}.`);
      setPromoCode("");
      setPromoReason("");
      reload();
      requestAdminDataRefresh();
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : "Redemption failed - this error is the real diagnosis, it's the same check a real redemption runs.");
    } finally {
      setPromoBusy(false);
    }
  }

  async function submitSessionReset() {
    if (!teacherIdParam || sessionReason.trim().length < 8) {
      setSessionError("Write a reason of at least 8 characters.");
      return;
    }
    setSessionBusy(true);
    setSessionError(null);
    setSessionSuccess(null);
    try {
      const result = await api.resetUserSession(teacherIdParam, { reason: sessionReason.trim() });
      setSessionSuccess(result.lockout_cleared ? "Every session revoked and lockout cleared - they can sign in fresh now." : "Every session revoked - they'll need to sign in again.");
      setSessionReason("");
      reload();
      requestAdminDataRefresh();
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : "Could not reset this user's session.");
    } finally {
      setSessionBusy(false);
    }
  }

  async function submitResetQuota() {
    if (!teacherIdParam || quotaReason.trim().length < 8) {
      setQuotaError("Write a reason of at least 8 characters.");
      return;
    }
    setQuotaBusy(true);
    setQuotaError(null);
    setQuotaSuccess(null);
    try {
      const result = await api.resetUserQuota(teacherIdParam, { reason: quotaReason.trim() });
      setQuotaSuccess(`Reset ${result.counters_reset} quota counter(s) for this user.`);
      setQuotaReason("");
      reload();
      requestAdminDataRefresh();
    } catch (err) {
      setQuotaError(err instanceof Error ? err.message : "Could not reset quota.");
    } finally {
      setQuotaBusy(false);
    }
  }

  async function submitUnstickGeneration() {
    if (!teacherIdParam || unstickReason.trim().length < 8) {
      setUnstickError("Write a reason of at least 8 characters.");
      return;
    }
    setUnstickBusy(true);
    setUnstickError(null);
    setUnstickSuccess(null);
    try {
      const result = await api.unstickUserGeneration(teacherIdParam, { reason: unstickReason.trim() });
      setUnstickSuccess(result.requests_cleared > 0 ? `Cleared ${result.requests_cleared} stuck request(s) - they can retry now.` : "No stuck requests found for this user.");
      setUnstickReason("");
      reload();
      requestAdminDataRefresh();
    } catch (err) {
      setUnstickError(err instanceof Error ? err.message : "Could not clear stuck requests.");
    } finally {
      setUnstickBusy(false);
    }
  }

  async function submitVerifyEmail() {
    if (!teacherIdParam || verifyReason.trim().length < 8) {
      setVerifyError("Write a reason of at least 8 characters.");
      return;
    }
    setVerifyBusy(true);
    setVerifyError(null);
    setVerifySuccess(null);
    try {
      await api.verifyUserEmail(teacherIdParam, { reason: verifyReason.trim() });
      setVerifySuccess("Email marked verified - they can sign in now.");
      setVerifyReason("");
      reload();
      requestAdminDataRefresh();
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Could not verify this user's email.");
    } finally {
      setVerifyBusy(false);
    }
  }

  async function submitSuspend() {
    if (!teacherIdParam || suspendReason.trim().length < 8) {
      setSuspendError("Write a reason of at least 8 characters.");
      return;
    }
    setSuspendBusy(true);
    setSuspendError(null);
    setSuspendSuccess(null);
    try {
      await api.suspendTeacherAccount(teacherIdParam, { reason: suspendReason.trim() });
      setSuspendSuccess("Account suspended - every session was force-logged-out and sign-in is now blocked.");
      setSuspendReason("");
      reload();
      requestAdminDataRefresh();
    } catch (err) {
      setSuspendError(err instanceof Error ? err.message : "Could not suspend this account.");
    } finally {
      setSuspendBusy(false);
    }
  }

  async function submitUnsuspend() {
    if (!teacherIdParam || suspendReason.trim().length < 8) {
      setSuspendError("Write a reason of at least 8 characters.");
      return;
    }
    setSuspendBusy(true);
    setSuspendError(null);
    setSuspendSuccess(null);
    try {
      await api.unsuspendTeacherAccount(teacherIdParam, { reason: suspendReason.trim() });
      setSuspendSuccess("Account unsuspended - they can sign in again.");
      setSuspendReason("");
      reload();
      requestAdminDataRefresh();
    } catch (err) {
      setSuspendError(err instanceof Error ? err.message : "Could not unsuspend this account.");
    } finally {
      setSuspendBusy(false);
    }
  }

  async function submitExportOnBehalf() {
    if (!teacherIdParam) return;
    setExportBusy(true);
    setExportOnBehalfError(null);
    try {
      const result = await api.exportTeacherDataOnBehalf(teacherIdParam);
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${teacherIdParam}-export.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportOnBehalfError(err instanceof Error ? err.message : "Could not export this user's data.");
    } finally {
      setExportBusy(false);
    }
  }

  async function submitCancelBilling() {
    if (!teacherIdParam || billingCancelReason.trim().length < 8) {
      setBillingCancelError("Write a reason of at least 8 characters.");
      return;
    }
    setBillingCancelBusy(true);
    setBillingCancelError(null);
    setBillingCancelSuccess(null);
    try {
      await api.cancelTeacherBilling(teacherIdParam, { reason: billingCancelReason.trim() });
      setBillingCancelSuccess("Subscription cancelled.");
      setBillingCancelReason("");
      reload();
      requestAdminDataRefresh();
    } catch (err) {
      setBillingCancelError(err instanceof Error ? err.message : "Could not cancel this user's subscription.");
    } finally {
      setBillingCancelBusy(false);
    }
  }

  async function submitRefund() {
    if (!teacherIdParam || refundReason.trim().length < 8) {
      setRefundError("Write a reason of at least 8 characters.");
      return;
    }
    const amount = refundAmount.trim() ? Number(refundAmount) : undefined;
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
      setRefundError("Enter a refund amount in rupees, or leave it empty for a full refund.");
      return;
    }
    setRefundBusy(true);
    setRefundError(null);
    setRefundSuccess(null);
    try {
      const out = await api.refundTeacherPayment(teacherIdParam, { reason: refundReason.trim(), amount_rupees: amount, cancel_plan: refundCancelPlan });
      const paid = out.refund.amount_paise != null ? ` of Rs ${(out.refund.amount_paise / 100).toFixed(2)}` : "";
      setRefundSuccess(`Refund${paid} sent (${out.refund.status ?? "requested"}), reference ${out.refund.refund_id}.${out.plan_cancelled ? " Plan cancelled." : ""}`);
      setRefundReason("");
      setRefundAmount("");
      reload();
      requestAdminDataRefresh();
    } catch (err) {
      setRefundError(err instanceof Error ? err.message : "Could not send the refund.");
    } finally {
      setRefundBusy(false);
    }
  }

  async function submitDeleteAccount() {
    if (!teacherIdParam) return;
    if (deleteConfirmId !== teacherIdParam) {
      setDeleteError("Type the exact teacher_id shown above to confirm.");
      return;
    }
    if (deleteReason.trim().length < 8) {
      setDeleteError("Write a reason of at least 8 characters.");
      return;
    }
    if (!window.confirm("This permanently deletes this account and its data. This cannot be undone. Continue?")) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await api.deleteTeacherAccountOnBehalf(teacherIdParam, { reason: deleteReason.trim(), confirm_teacher_id: deleteConfirmId });
      requestAdminDataRefresh();
      window.location.href = "/teachers";
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete this account.");
      setDeleteBusy(false);
    }
  }

  async function submitRegenerateExport(worksheetId: string) {
    const reason = window.prompt("Why are you regenerating this export? (shown in this user's timeline)");
    if (!reason || reason.trim().length < 8) {
      setExportError("A reason of at least 8 characters is required.");
      return;
    }
    setExportBusyId(worksheetId);
    setExportError(null);
    setExportSuccess(null);
    try {
      await api.regenerateWorksheetExport(worksheetId, { reason: reason.trim() });
      setExportSuccess("Export regenerated successfully.");
      reload();
      requestAdminDataRefresh();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Regeneration failed - see the error, it's the real bug to fix.");
    } finally {
      setExportBusyId(null);
    }
  }

  useEffect(() => {
    if (!searchInput.trim() || searchInput.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setSearchBusy(true);
    const timer = setTimeout(() => {
      api
        .resolveUsers(searchInput.trim())
        .then((response) => {
          if (!cancelled) setSuggestions(response.items);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setSearchBusy(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    if (!teacherIdParam) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .getUserThreeSixty(teacherIdParam)
      .then((response) => setData(response))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load this user's history."))
      .finally(() => setLoading(false));
  }, [teacherIdParam]);

  function openUser(teacherId: string) {
    setSearchInput("");
    setSuggestions([]);
    router.push(`/user-360?teacher_id=${encodeURIComponent(teacherId)}`);
  }

  const filteredTimeline = useMemo(() => {
    if (!data) return [];
    if (kindFilter === "all") return data.timeline;
    return data.timeline.filter((row) => row.kind === kindFilter);
  }, [data, kindFilter]);

  return (
    <AppShell title="User 360">
      <section className={panel}>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-purple-700">Customer operations</p>
        <h2 className="mt-1 text-3xl font-extrabold text-slate-950">User 360</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Every real, database-backed event for one user in one place - profile, subscription, every payment attempt,
          every promo redemption, every support ticket, every login/session record, and every failed API request their
          account actually triggered. Nothing here is user-reported - if it's not in this feed, it did not happen on
          the backend, so this is also how you check whether a complaint matches reality.
        </p>

        <div className="relative mt-5 max-w-xl">
          <label className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">
            Find a user by name, email, or user id
            <input
              className="mt-1 w-full min-w-0 rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-purple-400"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="e.g. Satyam, satyam@example.com, or a user id..."
            />
          </label>
          {searchInput.trim().length >= 2 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-violet-200 bg-white shadow-card">
              {searchBusy && <div className="px-4 py-3 text-xs font-bold text-slate-400">Searching...</div>}
              {!searchBusy && suggestions.length === 0 && (
                <div className="px-4 py-3 text-xs font-bold text-slate-400">No matching users.</div>
              )}
              {!searchBusy &&
                suggestions.map((hit) => (
                  <button
                    key={hit.teacher_id}
                    type="button"
                    onClick={() => openUser(hit.teacher_id)}
                    className="block w-full border-b border-violet-50 px-4 py-3 text-left transition last:border-b-0 hover:bg-violet-50"
                  >
                    <p className="text-sm font-extrabold text-slate-900">
                      {hit.name || "Unknown user"}
                      {hit.is_test_account && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-amber-800">Test</span>}
                    </p>
                    <p className="font-mono text-xs text-slate-500">{hit.email} - {hit.teacher_id}</p>
                  </button>
                ))}
            </div>
          )}
        </div>

        {!teacherIdParam && (
          <div className="mt-8 rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-6 text-sm font-bold text-slate-600">
            Search for a user above, or click "View full history" on any row in the Users tab, to open their full
            timeline here.
          </div>
        )}

        {teacherIdParam && loading && <p className="mt-8 text-sm font-bold text-slate-500">Loading this user's full history...</p>}
        {teacherIdParam && error && (
          <div className="mt-8 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>
        )}

        {data && !loading && (
          <div className="mt-8 space-y-6">
            <div className="rounded-xl border border-violet-200 bg-white p-5 shadow-soft">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-2xl font-extrabold text-slate-950">
                    {data.profile.name || "Unknown user"}
                    {data.profile.is_test_account && (
                      <span className="ml-3 rounded-full bg-amber-100 px-2 py-1 align-middle text-[11px] font-extrabold uppercase tracking-wide text-amber-800">Test account</span>
                    )}
                  </h3>
                  <p className="mt-1 font-mono text-xs text-slate-500">{data.profile.teacher_id}</p>
                  <p className="mt-2 text-sm font-bold text-slate-600">
                    {data.profile.email} {data.profile.email_verified ? "(verified)" : "(not verified)"}
                    {data.profile.phone ? ` - ${data.profile.phone}` : ""}
                    {data.profile.school ? ` - ${data.profile.school}` : ""}
                  </p>
                </div>
                <div className="text-right text-xs font-bold text-slate-500">
                  <p>Created {formatDateTime(data.profile.created_at)}</p>
                  <p>Last login {formatDateTime(data.profile.last_login_at)}</p>
                </div>
              </div>

              {data.red_flags.length > 0 ? (
                <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-rose-800">Red flags found in the actual data</p>
                  <ul className="mt-2 space-y-1 text-sm font-bold text-rose-800">
                    {data.red_flags.map((flag) => (
                      <li key={flag}>- {flag}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
                  No red flags in the backend data for this account - no failed payments in the last 30 days, no open
                  tickets, no lockouts, no recorded request failures.
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Plan" value={data.subscription ? `${planLabel(data.subscription.plan_code)} (${data.subscription.status})` : "No subscription row"} />
              <Stat
                label="Failed payments (30d)"
                value={String(data.counts.failed_payments_30d)}
                tone={data.counts.failed_payments_30d > 0 ? "danger" : "default"}
              />
              <Stat
                label="Open support tickets"
                value={String(data.counts.open_support_tickets)}
                tone={data.counts.open_support_tickets > 0 ? "warning" : "default"}
              />
              <Stat
                label="Failed API requests"
                value={String(data.counts.request_errors_recorded)}
                tone={data.counts.request_errors_recorded > 0 ? "warning" : "default"}
              />
              <Stat label="Promo codes redeemed" value={String(data.counts.promo_redemptions)} />
              <Stat label="Papers generated" value={String(data.counts.worksheets_generated)} />
              {data.usage_summary?.usage
                ? ([
                    ["papers_today", "Papers today"],
                    ["papers_month", "Papers this month"],
                    ["topical_today", "Topical today"],
                    ["full_portion_today", "Full Portion today"],
                    ["full_portion_month", "Full Portion this month"],
                    ["ai_checks", "AI checks"],
                  ] as const).map(([key, label]) => {
                    const entry = data.usage_summary?.usage?.[key];
                    if (!entry) return null;
                    const full = entry.limit !== null && entry.used >= entry.limit;
                    return (
                      <Stat
                        key={key}
                        label={label}
                        value={entry.limit === null ? `${entry.used} (no limit)` : `${entry.used} of ${entry.limit}`}
                        tone={full ? "warning" : "default"}
                      />
                    );
                  })
                : null}
              <Stat label="Support tickets (total)" value={String(data.counts.support_tickets)} />
              <Stat
                label="Failed logins on record"
                value={data.auth ? String(data.auth.failed_login_count) : "No auth record"}
                tone={data.auth && data.auth.failed_login_count >= 3 ? "danger" : "default"}
              />
            </div>

            {data.subscription && (
              <div className="rounded-xl border border-violet-200 bg-white p-5 shadow-soft">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Subscription (source of truth, not what the user claims)</p>
                <div className="mt-2 grid gap-2 text-sm font-bold text-slate-700 sm:grid-cols-2">
                  <p>Plan: {planLabel(data.subscription.plan_code)}</p>
                  <p>Status: {data.subscription.status}</p>
                  <p>Gateway: {data.subscription.gateway}</p>
                  <p>Current period: {formatDateTime(data.subscription.current_period_start)} to {formatDateTime(data.subscription.current_period_end)}</p>
                </div>
              </div>
            )}

            {data.auth && (
              <div className="rounded-xl border border-violet-200 bg-white p-5 shadow-soft">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Login / auth record - use this to verify a "login isn't working" claim</p>
                <div className="mt-2 grid gap-2 text-sm font-bold text-slate-700 sm:grid-cols-2">
                  <p>Email verified: {formatDateTime(data.auth.email_verified_at)}</p>
                  <p>Consecutive failed logins: {data.auth.failed_login_count}</p>
                  <p>Locked until: {formatDateTime(data.auth.locked_until)}</p>
                  <p>Session token version: {data.auth.token_version}</p>
                </div>
                {data.active_sessions.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Recent sessions/devices</p>
                    <div className="mt-2 space-y-2">
                      {data.active_sessions.map((sess, index) => (
                        <div key={index} className="rounded-xl border border-violet-50 bg-violet-50/40 px-3 py-2 text-xs font-bold text-slate-600">
                          <p>Started {formatDateTime(sess.created_at)} - Last seen {formatDateTime(sess.last_seen_at)} - {sess.revoked_at ? "Revoked" : "Active"}</p>
                          <p className="mt-1 text-slate-400">{sess.ip_address || "Unknown IP"} - {sess.user_agent || "Unknown device"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-xl border border-violet-200 bg-white p-5 shadow-soft">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Fix this account</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Every action below is logged into this user's own timeline with your admin email and the reason you
                give - and every other tab (Users, Billing, Promo Codes) reflects the change the moment you reopen it,
                because they all read the same database tables this page does. Only use these once User 360 has shown
                you the real problem is on our side, not the user's bank or a dead promo code.
              </p>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <ActionCard
                  title="Grant / fix this user's plan"
                  description="Owner-only. Use when payment or webhook evidence shows they should already be on a different plan."
                  busy={grantBusy}
                  error={grantError}
                  success={grantSuccess}
                  submitLabel="Grant plan"
                  confirmMessage={`Grant "${grantPlan || "(pick a plan)"}" to this user right now?`}
                  onSubmit={submitGrantPlan}
                >
                  <select
                    className="w-full min-w-0 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                    value={grantPlan}
                    onChange={(event) => setGrantPlan(event.target.value)}
                  >
                    <option value="">Choose a plan...</option>
                    {Object.entries(planOptions).map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                  <textarea
                    className="w-full min-w-0 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                    rows={2}
                    placeholder="Reason (required) - e.g. gateway confirms payment, webhook never applied it"
                    value={grantReason}
                    onChange={(event) => setGrantReason(event.target.value)}
                  />
                </ActionCard>

                <ActionCard
                  title="Force-redeem a promo code for this user"
                  description="Runs the exact same redemption check a real redemption uses. If it fails again, the error is the real bug."
                  busy={promoBusy}
                  error={promoError}
                  success={promoSuccess}
                  submitLabel="Force redeem"
                  confirmMessage={`Redeem "${promoCode || "(no code entered)"}" for this user right now?`}
                  onSubmit={submitForceRedeem}
                >
                  <input
                    className="w-full min-w-0 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold uppercase text-slate-900"
                    placeholder="PROMO CODE"
                    value={promoCode}
                    onChange={(event) => setPromoCode(event.target.value)}
                  />
                  <textarea
                    className="w-full min-w-0 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                    rows={2}
                    placeholder="Reason (required) - e.g. code is active/not expired/not exhausted but redemption failed for this user"
                    value={promoReason}
                    onChange={(event) => setPromoReason(event.target.value)}
                  />
                </ActionCard>

                <ActionCard
                  title="Reset this user's session"
                  description="Force-logs-out every device, invalidates every access token, and clears any lockout so they can sign in fresh."
                  busy={sessionBusy}
                  error={sessionError}
                  success={sessionSuccess}
                  submitLabel="Reset session"
                  confirmMessage="Force-logout every device and clear any lockout for this user right now?"
                  onSubmit={submitSessionReset}
                >
                  <textarea
                    className="w-full min-w-0 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                    rows={2}
                    placeholder="Reason (required) - e.g. stuck in a login refresh loop, confirmed a real session/token bug"
                    value={sessionReason}
                    onChange={(event) => setSessionReason(event.target.value)}
                  />
                </ActionCard>

                <ActionCard
                  title="Reset this user's generation quota"
                  description="Zeroes every quota counter for this user - use when they're wrongly shown as out of papers for the period."
                  busy={quotaBusy}
                  error={quotaError}
                  success={quotaSuccess}
                  submitLabel="Reset quota"
                  confirmMessage="Reset every generation quota counter for this user right now?"
                  onSubmit={submitResetQuota}
                >
                  <textarea
                    className="w-full min-w-0 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                    rows={2}
                    placeholder="Reason (required) - e.g. quota shows exhausted but usage history doesn't support it"
                    value={quotaReason}
                    onChange={(event) => setQuotaReason(event.target.value)}
                  />
                </ActionCard>

                <ActionCard
                  title="Unstick a stuck paper generation"
                  description="Clears any generation/export request stuck mid-flight and releases any quota it reserved, so a retry can start clean."
                  busy={unstickBusy}
                  error={unstickError}
                  success={unstickSuccess}
                  submitLabel="Unstick generation"
                  confirmMessage="Clear any stuck in-progress generation request for this user right now?"
                  onSubmit={submitUnstickGeneration}
                >
                  <textarea
                    className="w-full min-w-0 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                    rows={2}
                    placeholder="Reason (required) - e.g. generation has been spinning with no result"
                    value={unstickReason}
                    onChange={(event) => setUnstickReason(event.target.value)}
                  />
                </ActionCard>

                <ActionCard
                  title="Manually verify this user's email"
                  description="For onboarding stuck on a dead/expired OTP - marks their email verified directly so they can sign in without a working code."
                  busy={verifyBusy}
                  error={verifyError}
                  success={verifySuccess}
                  submitLabel="Verify email"
                  confirmMessage="Mark this user's email as verified right now?"
                  onSubmit={submitVerifyEmail}
                >
                  <textarea
                    className="w-full min-w-0 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                    rows={2}
                    placeholder="Reason (required) - e.g. OTP kept expiring before they could complete onboarding"
                    value={verifyReason}
                    onChange={(event) => setVerifyReason(event.target.value)}
                  />
                </ActionCard>

                {data.profile.is_suspended ? (
                  <ActionCard
                    title="Unsuspend this account"
                    description={`Currently suspended${data.profile.suspended_by ? ` by ${data.profile.suspended_by}` : ""}${data.profile.suspended_at ? ` on ${formatDateTime(data.profile.suspended_at)}` : ""}. Reason on file: "${data.profile.suspended_reason || "-"}"`}
                    busy={suspendBusy}
                    error={suspendError}
                    success={suspendSuccess}
                    submitLabel="Unsuspend account"
                    confirmMessage="Unsuspend this account and let them sign in again?"
                    onSubmit={submitUnsuspend}
                  >
                    <textarea
                      className="w-full min-w-0 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                      rows={2}
                      placeholder="Reason (required) - e.g. dispute resolved, appeal accepted"
                      value={suspendReason}
                      onChange={(event) => setSuspendReason(event.target.value)}
                    />
                  </ActionCard>
                ) : (
                  <ActionCard
                    title="Suspend this account"
                    description="Blocks sign-in immediately (password and Google) and force-logs-out every existing session. Reversible - unsuspend from here any time."
                    busy={suspendBusy}
                    error={suspendError}
                    success={suspendSuccess}
                    submitLabel="Suspend account"
                    confirmMessage="Suspend this account right now? They will be signed out and unable to sign in until unsuspended."
                    onSubmit={submitSuspend}
                  >
                    <textarea
                      className="w-full min-w-0 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                      rows={2}
                      placeholder="Reason (required) - e.g. abuse report confirmed, policy violation"
                      value={suspendReason}
                      onChange={(event) => setSuspendReason(event.target.value)}
                    />
                  </ActionCard>
                )}

                <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-4">
                  <p className="text-sm font-extrabold text-slate-900">Export this user's data</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Same export the user's own self-service "Download my data" produces - downloaded as a JSON file, for a
                    support request or deletion prep where the user can't sign in themselves.
                  </p>
                  <button
                    type="button"
                    disabled={exportBusy}
                    onClick={submitExportOnBehalf}
                    className="mt-3 rounded-xl bg-purple-700 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {exportBusy ? "Exporting..." : "Download data export"}
                  </button>
                  {exportOnBehalfError && <p className="mt-2 text-xs font-bold text-rose-700">{exportOnBehalfError}</p>}
                </div>

                {data.subscription ? (
                  <ActionCard
                    title="Cancel this user's subscription"
                    description="Cancels their real subscription (same effect as their own self-service cancel). Does not move money; use the refund card below to send money back."
                    busy={billingCancelBusy}
                    error={billingCancelError}
                    success={billingCancelSuccess}
                    submitLabel="Cancel subscription"
                    confirmMessage="Cancel this user's subscription right now?"
                    onSubmit={submitCancelBilling}
                  >
                    <textarea
                      className="w-full min-w-0 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                      rows={2}
                      placeholder="Reason (required) - e.g. billing dispute, requested cancellation"
                      value={billingCancelReason}
                      onChange={(event) => setBillingCancelReason(event.target.value)}
                    />
                  </ActionCard>
                ) : null}

                {data.subscription ? (
                  <ActionCard
                    title="Refund this user's payment (Razorpay)"
                    description="Sends real money back for their latest Razorpay payment, once per payment. Needs the refund permission (owner by default). Leave the amount empty for a full refund."
                    busy={refundBusy}
                    error={refundError}
                    success={refundSuccess}
                    submitLabel="Send refund"
                    confirmMessage="Send this refund through Razorpay now? This cannot be undone."
                    onSubmit={submitRefund}
                  >
                    <input
                      className="w-full min-w-0 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                      inputMode="decimal"
                      placeholder="Amount in rupees (empty = full refund)"
                      value={refundAmount}
                      onChange={(event) => setRefundAmount(event.target.value)}
                    />
                    <textarea
                      className="mt-2 w-full min-w-0 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                      rows={2}
                      placeholder="Reason (required) - e.g. charged twice, plan not delivered"
                      value={refundReason}
                      onChange={(event) => setRefundReason(event.target.value)}
                    />
                    <label className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-700">
                      <input type="checkbox" checked={refundCancelPlan} onChange={(event) => setRefundCancelPlan(event.target.checked)} />
                      Also cancel their plan
                    </label>
                  </ActionCard>
                ) : null}

                <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
                  <p className="text-sm font-extrabold text-rose-900">Delete this account permanently</p>
                  <p className="mt-1 text-xs font-semibold text-rose-700">
                    Irreversible. Deletes this user's profile, subscription, worksheets, tickets, and history. Type the
                    exact user id ({teacherIdParam}) below to confirm.
                  </p>
                  <input
                    className="mt-3 w-full min-w-0 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                    placeholder={`Type "${teacherIdParam}" to confirm`}
                    value={deleteConfirmId}
                    onChange={(event) => setDeleteConfirmId(event.target.value)}
                  />
                  <textarea
                    className="mt-2 w-full min-w-0 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                    rows={2}
                    placeholder="Reason (required)"
                    value={deleteReason}
                    onChange={(event) => setDeleteReason(event.target.value)}
                  />
                  <button
                    type="button"
                    disabled={deleteBusy || deleteConfirmId !== teacherIdParam}
                    onClick={submitDeleteAccount}
                    className="mt-3 rounded-xl bg-rose-700 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleteBusy ? "Deleting..." : "Permanently delete account"}
                  </button>
                  {deleteError && <p className="mt-2 text-xs font-bold text-rose-700">{deleteError}</p>}
                </div>

                <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-4">
                  <p className="text-sm font-extrabold text-slate-900">Regenerate a failed PDF/export</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Re-renders the PDF/answer-key/preview from this paper's already-stored data - nothing about the
                    content changes. If it fails again, the error shown is the real bug to go fix.
                  </p>
                  <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
                    {data.worksheets.length === 0 && <p className="text-xs font-bold text-slate-400">No papers generated by this user yet.</p>}
                    {data.worksheets.map((ws) => (
                      <div key={ws.worksheet_id} className="flex items-center justify-between gap-2 rounded-xl border border-violet-50 bg-white px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-extrabold text-slate-800">{ws.title}</p>
                          <p className="text-[11px] font-bold text-slate-400">
                            {formatDateTime(ws.created_at)} - {ws.pdf_ready ? "Export ready" : "Export not ready"}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={exportBusyId === ws.worksheet_id}
                          onClick={() => submitRegenerateExport(ws.worksheet_id)}
                          className="flex-shrink-0 rounded-xl border border-violet-200 bg-white px-3 py-1.5 text-[11px] font-extrabold text-purple-800 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {exportBusyId === ws.worksheet_id ? "Working..." : "Regenerate"}
                        </button>
                      </div>
                    ))}
                  </div>
                  {exportError && <p className="mt-2 text-xs font-bold text-rose-700">{exportError}</p>}
                  {exportSuccess && <p className="mt-2 text-xs font-bold text-emerald-700">{exportSuccess}</p>}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-violet-200 bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Full timeline, newest first</p>
                <div className="flex flex-wrap gap-1.5">
                  {KIND_FILTERS.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setKindFilter(filter.key)}
                      className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
                        kindFilter === filter.key ? "bg-purple-700 text-white" : "bg-violet-50 text-slate-600 hover:bg-violet-100"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 max-h-[32rem] overflow-y-auto pr-1">
                {filteredTimeline.length === 0 ? (
                  <p className="py-6 text-sm font-bold text-slate-400">No events of this kind on record for this user.</p>
                ) : (
                  <ul className="space-y-3">
                    {filteredTimeline.map((item, index) => (
                      <li key={`${item.kind}-${item.at}-${index}`} className="flex gap-3">
                        <span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${STATUS_STYLES[item.status]}`} />
                        <div className="min-w-0 flex-1 border-b border-violet-50 pb-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <p className="text-sm font-extrabold text-slate-900">
                              <span className="mr-2 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-purple-700">
                                {KIND_LABELS[item.kind]}
                              </span>
                              {item.title}
                            </p>
                            <p className="text-xs font-bold text-slate-400">{formatDateTime(item.at)}</p>
                          </div>
                          {item.detail && <p className="mt-1 text-xs font-semibold text-slate-500">{item.detail}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
