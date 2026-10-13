import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-white/8 bg-white/[0.02] ${className}`}>
      {(title || right) && (
        <header className="flex items-baseline justify-between gap-3 border-b border-white/8 px-3 py-2">
          <div className="min-w-0">
            {title && <h2 className="truncate text-[12px] font-medium tracking-wide text-zinc-200">{title}</h2>}
            {subtitle && <p className="mt-0.5 truncate text-[11px] text-zinc-500">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

export function Badge({ children, tone = "zinc" }: { children: ReactNode; tone?: "zinc" | "amber" | "green" | "red" | "blue" }) {
  const tones: Record<string, string> = {
    zinc: "bg-white/6 text-zinc-400 border-white/10",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/25",
    green: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
    red: "bg-rose-500/10 text-rose-300 border-rose-500/25",
    blue: "bg-sky-500/10 text-sky-300 border-sky-500/25",
  };
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] leading-none tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Mono({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span title={title} className="font-mono text-[11px] text-zinc-400">
      {children}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-0.5 truncate text-[15px] font-medium text-zinc-100">{value}</div>
      {hint && <div className="truncate text-[10px] text-zinc-500">{hint}</div>}
    </div>
  );
}

export function Bar({ value, max, tone = "sky" }: { value: number; max: number; tone?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
      <div className={`h-full rounded-full bg-${tone}-400/70`} style={{ width: `${pct}%`, background: "currentColor" }} />
    </div>
  );
}

/**
 * Rule 5 + rule 6 in one component: when a lens or room has no data, say so plainly and show the
 * command that would produce it. No spinner pretending to work, no empty box, no silent zero.
 */
export function NotInBundle({
  what,
  why,
  command,
}: {
  what: string;
  why: string;
  command?: string;
}) {
  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-4">
      <div className="flex items-center gap-2">
        <Badge tone="amber">not in this bundle</Badge>
        <span className="text-[12px] font-medium text-amber-200/90">{what}</span>
      </div>
      <p className="mt-2 max-w-prose text-[11px] leading-relaxed text-zinc-400">{why}</p>
      {command && (
        <pre className="mt-2 overflow-x-auto rounded border border-white/8 bg-black/40 px-2 py-1.5 font-mono text-[11px] text-emerald-300">
          {command}
        </pre>
      )}
    </div>
  );
}

export function Row({ children, onClick, active }: { children: ReactNode; onClick?: () => void; active?: boolean }) {
  const cls = `flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors ${
    active ? "bg-sky-500/12 text-sky-100" : "hover:bg-white/[0.04] text-zinc-300"
  }`;
  return onClick ? (
    <button type="button" className={cls} onClick={onClick}>
      {children}
    </button>
  ) : (
    <div className={cls}>{children}</div>
  );
}

export function KeyHint({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-white/12 bg-white/6 px-1 py-0.5 font-mono text-[10px] text-zinc-400">{children}</kbd>
  );
}
