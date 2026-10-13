import { useEffect } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { CommandPalette } from "./CommandPalette";
import { coverage, findSymbol, meta, relativeTime } from "./lib/data";
import { LENSES, ROOMS, type LensId, type RoomId } from "./lib/focus";
import { useView } from "./lib/view";
import { Architecture, Migration, Proof, Repo, Review, Security } from "./rooms/OtherRooms";
import { Understand } from "./rooms/Understand";
import { Badge, KeyHint, Mono } from "./ui/primitives";

const LENSES_WITH_DATA: LensId[] = ["code", "cfgpddg", "dataflow", "slice"];

function Coverage() {
  const c = coverage();
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <span className="flex cursor-help items-center gap-1">
          {Array.from({ length: c.total }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${i < c.filled ? "bg-emerald-400" : "bg-zinc-700"}`}
            />
          ))}
          <span className="ml-1 text-[10px] text-zinc-500">{c.note}</span>
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          className="z-50 max-w-xs rounded border border-white/12 bg-[#15181e] px-2 py-1.5 text-[11px] text-zinc-300 shadow-xl"
        >
          Derived from what this bundle actually carries — CFG/PDG, dataflow, slices, CPG, taint. A
          capability we cannot evidence is not shown as covered.
          <Tooltip.Arrow className="fill-[#15181e]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function App() {
  const v = useView();
  const focused = findSymbol(v.focus);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        v.setPalette(!v.palette);
      }
      if (e.key === "Escape" && v.palette) v.setPalette(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [v]);

  const room = ROOMS.find((r) => r.id === v.room)!;

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className="flex h-screen flex-col overflow-hidden">
        {/* ── INSTRUMENT — persistent, never a destination ───────────────── */}
        <header className="shrink-0 border-b border-white/8 bg-[#0e1116]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
            <span className="flex items-center gap-2">
              <span className="text-[13px] font-semibold tracking-tight text-sky-300">rgctl</span>
              <span className="text-zinc-600">/</span>
              <span className="text-[12px] text-zinc-300">{meta.repo}</span>
            </span>

            <Coverage />

            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <span className="cursor-help">
                  <Mono title={meta.full_digest}>{meta.digest}</Mono>
                </span>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content sideOffset={6} className="z-50 rounded border border-white/12 bg-[#15181e] px-2 py-1.5 font-mono text-[11px] text-zinc-300 shadow-xl">
                  {meta.full_digest}
                  <Tooltip.Arrow className="fill-[#15181e]" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>

            <span className="text-[11px] text-zinc-500">indexed {relativeTime(meta.generated_at)}</span>
            <span className="text-[11px] text-zinc-600">v{meta.version}</span>

            {/* The Focus is ambient: it constrains rooms, it never gates them. */}
            <span className="ml-auto flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">focus</span>
              {focused ? (
                <span className="flex items-center gap-1.5 rounded border border-sky-400/30 bg-sky-500/10 px-2 py-0.5">
                  <span className="text-[11px] text-sky-100">{focused.name}</span>
                  <button
                    type="button"
                    onClick={() => v.setFocus(null)}
                    className="text-sky-300/70 hover:text-sky-100"
                    aria-label="clear focus"
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <span className="rounded border border-white/10 px-2 py-0.5 text-[11px] text-zinc-500">none</span>
              )}
            </span>
          </div>

          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={() => v.setPalette(true)}
              className="flex w-full items-center gap-2 rounded border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-left text-[12px] text-zinc-500 hover:border-white/20 hover:text-zinc-300"
            >
              <span>⌕</span>
              <span>Search symbols, communities, or jump to a room…</span>
              <span className="ml-auto flex items-center gap-1">
                <KeyHint>⌘</KeyHint>
                <KeyHint>K</KeyHint>
              </span>
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* ── ROOMS — jobs, not features ──────────────────────────────── */}
          <nav className="w-52 shrink-0 overflow-y-auto border-r border-white/8 bg-[#0c0f13] p-2">
            <div className="px-2 pb-1.5 text-[10px] uppercase tracking-wider text-zinc-600">rooms</div>
            {ROOMS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => v.setRoom(r.id)}
                className={`mb-0.5 flex w-full items-start gap-2 rounded px-2 py-1.5 text-left ${
                  v.room === r.id ? "bg-sky-500/12 text-sky-100" : "text-zinc-300 hover:bg-white/[0.04]"
                }`}
              >
                <span className="mt-px w-3 text-center text-zinc-500">{r.icon}</span>
                <span className="min-w-0">
                  <span className="block text-[12px]">{r.label}</span>
                  <span className="block truncate text-[10px] text-zinc-500">{r.blurb}</span>
                </span>
              </button>
            ))}
          </nav>

          {/* ── MAIN ────────────────────────────────────────────────────── */}
          <main className="flex min-w-0 flex-1 flex-col">
            {/* LENS — a control over the current subject, never a destination */}
            <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-white/8 bg-[#0e1116] px-3 py-1.5">
              <span className="mr-1 text-[10px] uppercase tracking-wider text-zinc-600">lens</span>
              {LENSES.map((l) => {
                const hasData = LENSES_WITH_DATA.includes(l.id) || v.room !== "understand";
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => v.setLens(l.id)}
                    title={hasData ? undefined : "no data in this bundle — the room will say why"}
                    className={`rounded px-2 py-0.5 text-[11px] ${
                      v.lens === l.id
                        ? "bg-white/10 text-zinc-100"
                        : hasData
                          ? "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
                          : "text-zinc-600 hover:bg-white/[0.03]"
                    }`}
                  >
                    {l.label}
                  </button>
                );
              })}
              <span className="ml-auto flex items-center gap-2 text-[10px] text-zinc-600">
                <span>{room.label}</span>
                {focused && <Badge tone="blue">subject: {focused.name}</Badge>}
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {v.room === "repo" && <Repo onGo={v.setRoom} />}
              {v.room === "understand" && (
                <Understand focus={v.focus} lens={v.lens} onCarry={v.carryTo} />
              )}
              {v.room === "review" && <Review />}
              {v.room === "security" && <Security />}
              {v.room === "architecture" && <Architecture />}
              {v.room === "migration" && <Migration />}
              {v.room === "proof" && <Proof />}
            </div>
          </main>
        </div>

        <CommandPalette
          open={v.palette}
          onOpenChange={v.setPalette}
          onPick={(s) => v.setFocus(s.id)}
        />
      </div>
    </Tooltip.Provider>
  );
}
