import { useCallback, useEffect, useRef, useState } from "react";

import { secondaryButton } from "@/components/ui";

type Props = {
  id: string;
  title: string;
  source: string;
};

const MIN_SCALE = 0.2;
const MAX_SCALE = 4;

let mermaidReady: Promise<typeof import("mermaid").default> | null = null;

/** Loads Mermaid once, only when a diagram is first opened, so the rest of the admin panel does not pay for it. */
function loadMermaid() {
  if (!mermaidReady) {
    mermaidReady = import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        maxTextSize: 120000,
        flowchart: { htmlLabels: true, curve: "basis", useMaxWidth: false, nodeSpacing: 36, rankSpacing: 48 },
        sequence: { useMaxWidth: false, mirrorActors: false, wrap: true },
        er: { useMaxWidth: false },
        state: { useMaxWidth: false },
        themeVariables: {
          primaryColor: "#eef0ff",
          primaryBorderColor: "#6168ec",
          primaryTextColor: "#1f2336",
          lineColor: "#565e82",
          secondaryColor: "#f6f7fb",
          tertiaryColor: "#ffffff",
          noteBkgColor: "#fff7d6",
          noteTextColor: "#1f2336",
          fontSize: "14px",
        },
      });
      return mermaid;
    });
  }
  return mermaidReady;
}

const svgCache = new Map<string, string>();
let counter = 0;

export function DiagramViewer({ id, title, source }: Props) {
  const [svg, setSvg] = useState<string | null>(svgCache.get(`${id}:${source.length}`) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [full, setFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const natural = useRef({ w: 0, h: 0 });

  const fit = useCallback(() => {
    const box = frame.current;
    const { w, h } = natural.current;
    if (!box || !w || !h) return;
    const s = Math.max(MIN_SCALE, Math.min(1.6, Math.min((box.clientWidth - 24) / w, (box.clientHeight - 24) / h)));
    setScale(s);
    setOffset({ x: Math.max(12, (box.clientWidth - w * s) / 2), y: Math.max(12, (box.clientHeight - h * s) / 2) });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const key = `${id}:${source.length}`;
    const cached = svgCache.get(key);
    if (cached) {
      setSvg(cached);
      return;
    }
    setSvg(null);
    loadMermaid()
      .then((mermaid) => mermaid.render(`arch-${id}-${counter++}`, source))
      .then(({ svg: out }) => {
        if (cancelled) return;
        svgCache.set(key, out);
        setSvg(out);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "This diagram could not be drawn.");
      });
    return () => {
      cancelled = true;
    };
  }, [id, source]);

  // Measure the drawn diagram and fit it to the frame whenever it changes or the frame is resized.
  useEffect(() => {
    if (!svg || !frame.current) return;
    const holder = frame.current.querySelector("svg");
    if (holder) {
      const box = holder.getBoundingClientRect();
      const vb = holder.viewBox?.baseVal;
      natural.current = { w: vb && vb.width ? vb.width : box.width, h: vb && vb.height ? vb.height : box.height };
      holder.setAttribute("width", String(natural.current.w));
      holder.setAttribute("height", String(natural.current.h));
      holder.style.maxWidth = "none";
    }
    fit();
    const observer = new ResizeObserver(() => fit());
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, [svg, full, fit]);

  useEffect(() => {
    if (!full) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFull(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [full]);

  const zoomBy = (factor: number, cx?: number, cy?: number) => {
    const box = frame.current;
    setScale((current) => {
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, current * factor));
      if (box) {
        const px = cx ?? box.clientWidth / 2;
        const py = cy ?? box.clientHeight / 2;
        setOffset((o) => ({ x: px - ((px - o.x) / current) * next, y: py - ((py - o.y) / current) * next }));
      }
      return next;
    });
  };

  const onWheel = (event: React.WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect = frame.current?.getBoundingClientRect();
    zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12, rect ? event.clientX - rect.left : undefined, rect ? event.clientY - rect.top : undefined);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setOffset({ x: d.ox + event.clientX - d.x, y: d.oy + event.clientY - d.y });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = 40;
    if (event.key === "+" || event.key === "=") zoomBy(1.15);
    else if (event.key === "-") zoomBy(1 / 1.15);
    else if (event.key === "0") fit();
    else if (event.key === "ArrowLeft") setOffset((o) => ({ ...o, x: o.x + step }));
    else if (event.key === "ArrowRight") setOffset((o) => ({ ...o, x: o.x - step }));
    else if (event.key === "ArrowUp") setOffset((o) => ({ ...o, y: o.y + step }));
    else if (event.key === "ArrowDown") setOffset((o) => ({ ...o, y: o.y - step }));
    else return;
    event.preventDefault();
  };

  const download = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${id}.svg`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setShowSource(true);
    }
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 border-b border-violet-200 bg-violet-50 px-3 py-2">
      <button type="button" className={`${secondaryButton} !px-3 !py-1.5`} onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out">-</button>
      <span className="w-12 text-center text-xs font-extrabold text-slate-600" aria-live="polite">{Math.round(scale * 100)}%</span>
      <button type="button" className={`${secondaryButton} !px-3 !py-1.5`} onClick={() => zoomBy(1.2)} aria-label="Zoom in">+</button>
      <button type="button" className={`${secondaryButton} !px-3 !py-1.5`} onClick={fit}>Fit</button>
      <span className="mx-1 hidden h-5 w-px bg-violet-200 sm:inline-block" aria-hidden="true" />
      <button type="button" className={`${secondaryButton} !px-3 !py-1.5`} onClick={() => setFull((v) => !v)}>{full ? "Close full screen" : "Full screen"}</button>
      <button type="button" className={`${secondaryButton} !px-3 !py-1.5`} onClick={download} disabled={!svg}>Download SVG</button>
      <button type="button" className={`${secondaryButton} !px-3 !py-1.5`} onClick={() => void copy()}>{copied ? "Copied" : "Copy Mermaid"}</button>
      <button type="button" className={`${secondaryButton} !px-3 !py-1.5`} onClick={() => setShowSource((v) => !v)} aria-pressed={showSource}>{showSource ? "Hide source" : "Source"}</button>
      <span className="ml-auto hidden text-xs font-semibold text-slate-500 md:inline">Drag to move. Ctrl or Cmd plus wheel to zoom. Keys: + - 0 and arrows.</span>
    </div>
  );

  const canvas = (
    <div
      ref={frame}
      role="img"
      aria-label={`Diagram: ${title}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`relative cursor-grab touch-none overflow-hidden bg-white outline-none focus-visible:ring-4 focus-visible:ring-purple-100 active:cursor-grabbing ${full ? "h-full" : "h-[62vh] min-h-[360px]"}`}
      style={{ backgroundImage: "radial-gradient(#e0e3ee 1px, transparent 1px)", backgroundSize: "20px 20px" }}
    >
      {svg ? (
        <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: "0 0", width: "max-content" }} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : error ? (
        <div className="m-4 rounded-xl border border-rose-200 border-l-4 border-l-rose-600 bg-rose-50 p-4 text-sm text-rose-700">
          <p className="font-extrabold">This diagram could not be drawn.</p>
          <p className="mt-1 font-mono text-xs">{error}</p>
          <p className="mt-2 text-xs font-semibold">The Mermaid source is available under Source.</p>
        </div>
      ) : (
        <div className="grid h-full place-items-center text-sm font-bold text-slate-500">Drawing diagram...</div>
      )}
    </div>
  );

  const sourceBox = showSource ? (
    <pre className="max-h-72 overflow-auto border-t border-violet-200 bg-slate-950 p-4 text-xs leading-5 text-slate-100">{source}</pre>
  ) : null;

  if (full) {
    return (
      <div className="fixed inset-0 z-[400] flex flex-col bg-white" role="dialog" aria-modal="true" aria-label={`${title}, full screen`}>
        <div className="flex items-center justify-between gap-3 border-b border-violet-200 px-4 py-2">
          <p className="truncate text-sm font-extrabold text-slate-900">{title}</p>
        </div>
        {toolbar}
        <div className="min-h-0 flex-1">{canvas}</div>
        {sourceBox}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-soft">
      {toolbar}
      {canvas}
      {sourceBox}
    </div>
  );
}
