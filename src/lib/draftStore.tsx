import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { useAdminSession } from "@/lib/adminAuth";

// Automatic draft saving for admin work in progress. Drafts live in this browser's
// localStorage, keyed by the signed-in admin and a page-specific key, so after a
// sign-out, a session expiry or a closed tab, signing in again as the same admin
// puts the work back where it was. Drafts are never sent to the server and expire
// after 14 days. Files (images) cannot be stored here and must be attached again.

const PREFIX = "paperly:draft:v1";
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

type Stored<T> = { value: T; savedAt: number };

function store(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function fullKey(owner: string, key: string) {
  return `${PREFIX}:${owner}:${key}`;
}

export function readDraft<T>(owner: string, key: string): Stored<T> | null {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(fullKey(owner, key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored<T>;
    if (!parsed || typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      s.removeItem(fullKey(owner, key));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeDraft<T>(owner: string, key: string, value: T): number | null {
  const s = store();
  if (!s) return null;
  try {
    const savedAt = Date.now();
    s.setItem(fullKey(owner, key), JSON.stringify({ value, savedAt }));
    return savedAt;
  } catch {
    return null; // storage full or blocked: drafts are best effort
  }
}

export function clearDraft(owner: string, key: string) {
  try {
    store()?.removeItem(fullKey(owner, key));
  } catch {
    /* ignore */
  }
}

export type DraftInfo = {
  /** True when the current value was restored from a saved draft. */
  restored: boolean;
  /** When the draft was last saved (ms since epoch), or null if none yet. */
  savedAt: number | null;
  /** Remove the saved draft and put the value back to its initial state. */
  discard: () => void;
};

/**
 * Like useState, but the value is restored from a saved draft once the admin is known
 * and saved again shortly after every change. Setting the value back to its initial
 * value removes the draft.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
  delayMs = 500,
  shouldRestore?: () => boolean,
): [T, Dispatch<SetStateAction<T>>, DraftInfo] {
  const { admin } = useAdminSession();
  const owner = admin?.id || "";
  const [value, setValue] = useState<T>(initial);
  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const hydratedFor = useRef("");
  const initialJson = useRef(JSON.stringify(initial));
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    if (!owner || !key || hydratedFor.current === `${owner}|${key}`) return;
    const hadOtherKey = hydratedFor.current !== "";
    hydratedFor.current = `${owner}|${key}`;
    if (shouldRestore && !shouldRestore()) return;
    const saved = readDraft<T>(owner, key);
    if (saved && JSON.stringify(saved.value) !== initialJson.current) {
      setValue(saved.value);
      setRestored(true);
      setSavedAt(saved.savedAt);
    } else if (hadOtherKey) {
      // The key changed (for example another user was opened): do not carry the old text over.
      setValue(JSON.parse(initialJson.current) as T);
      setRestored(false);
      setSavedAt(null);
    }
  }, [owner, key]);

  useEffect(() => {
    if (!owner || !key || hydratedFor.current !== `${owner}|${key}`) return;
    const timer = window.setTimeout(() => {
      if (JSON.stringify(latest.current) === initialJson.current) {
        clearDraft(owner, key);
        setSavedAt(null);
      } else {
        setSavedAt(writeDraft(owner, key, latest.current));
      }
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [value, owner, key, delayMs]);

  useEffect(() => {
    if (!owner || !key) return;
    function flush() {
      if (hydratedFor.current !== `${owner}|${key}`) return;
      if (JSON.stringify(latest.current) !== initialJson.current) writeDraft(owner, key, latest.current);
    }
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [owner, key]);

  const discard = useCallback(() => {
    if (owner && key) clearDraft(owner, key);
    setValue(JSON.parse(initialJson.current) as T);
    setRestored(false);
    setSavedAt(null);
  }, [owner, key]);

  return [value, setValue, { restored, savedAt, discard }];
}

function timeLabel(ms: number) {
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "earlier";
  }
}

/** Small line under a form: "Draft saved" and, after a restore, a discard button. */
export function DraftStatus({ info, className = "" }: { info: DraftInfo; className?: string }) {
  if (!info.savedAt && !info.restored) return null;
  return (
    <p className={`text-xs font-semibold text-slate-500 ${className}`} role="status">
      {info.restored ? "Draft restored. " : ""}
      {info.savedAt ? `Saved automatically ${timeLabel(info.savedAt)}.` : ""}
      {" "}
      <button type="button" className="underline hover:text-slate-800" onClick={info.discard}>
        Discard draft
      </button>
    </p>
  );
}
