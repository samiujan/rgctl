import { useMemo, useState } from "react";
import type { GraphData } from "../lib/data";
import { Badge, Mono, NotInBundle, Stat } from "../ui/primitives";

/**
 * Compiler-IR view of one function.
 *
 * Every visual property encodes real data — nothing here is decorative:
 *
 *   vertical position  = dominator depth, walked from the entry block via `idom`
 *   edge colour        = control-flow edge type (next / if_true / if_false / return / exception)
 *   amber dot          = the block appears in a dominance frontier (where a φ would be placed)
 *   hover              = the block's dominator chain, i.e. what must execute before it
 *
 * Vertical dominance depth is the whole point: the layout *is* the analysis. A block further
 * down is dominated by everything on the amber path above it.
 */

type Cfg = GraphData["cfgs"][string];

const EDGE_COLOR: Record<string, string> = {
  next: "#6b7280",
  if_true: "#22c55e",
  if_false: "#ef4444",
  return: "#3b82f6",
  exception: "#a855f7",
  jump: "#f59e0b",
};

const ROW_H = 40;
const NODE_H = 24;
const NODE_W = 158;
const PAD_X = 28;
const PAD_Y = 22;

function depths(idom: number[], blocks: { id: number }[]): Map<number, number> {
  const d = new Map<number, number>();
  const walk = (x: number, guard = 0): number => {
    if (d.has(x)) return d.get(x)!;
    if (guard > 512) return 0;
    const p = idom[x];
    const v = p === undefined || p === x || p < 0 ? 0 : walk(p, guard + 1) + 1;
    d.set(x, v);
    return v;
  };
  for (const b of blocks) walk(b.id);
  return d;
}

export function CfgGraph({ cfg, name, meta }: { cfg: Cfg; name: string; meta: GraphData["cfg_meta"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [showDf, setShowDf] = useState(true);

  const layout = useMemo(() => {
    const dep = depths(cfg.idom, cfg.blocks);
    const rows = new Map<number, typeof cfg.blocks>();
    for (const b of cfg.blocks) {
      const dd = dep.get(b.id) ?? 0;
      if (!rows.has(dd)) rows.set(dd, []);
      rows.get(dd)!.push(b);
    }
    const maxDepth = Math.max(...rows.keys(), 0);
    const widest = Math.max(...[...rows.values()].map((r) => r.length), 1);
    const width = Math.max(880, widest * (NODE_W + 26) + PAD_X * 2);
    const height = (maxDepth + 1) * ROW_H + PAD_Y * 2;
    const pos = new Map<number, { x: number; y: number; row: number }>();
    for (const [dd, list] of rows) {
      list.sort((a, b) => a.id - b.id);
      const usable = width - PAD_X * 2;
      list.forEach((b, i) => {
        const x = PAD_X + (usable * (i + 0.5)) / list.length;
        pos.set(b.id, { x, y: PAD_Y + dd * ROW_H, row: dd });
      });
    }
    return { pos, width, height, maxDepth, rows };
  }, [cfg]);

  /** Dominator chain: the blocks that must execute before `id`, i.e. the reverse of the idom walk. */
  const chain = useMemo(() => {
    if (hover === null) return new Set<number>();
    const s = new Set<number>();
    let x: number | undefined = hover;
    let guard = 0;
    while (x !== undefined && !s.has(x) && guard++ < 512) {
      s.add(x);
      const p: number = cfg.idom[x];
      if (p === x || p === undefined || p < 0) break;
      x = p;
    }
    return s;
  }, [hover, cfg]);

  const dfSet = useMemo(() => {
    const s = new Set<number>();
    cfg.df.forEach((list, i) => {
      if (list && list.length) s.add(i);
    });
    return s;
  }, [cfg]);

  const edgeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of cfg.edges) c[e.k] = (c[e.k] ?? 0) + 1;
    return c;
  }, [cfg]);

  const sel = selected !== null ? cfg.blocks.find((b) => b.id === selected) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Blocks" value={cfg.blocks.length} hint={`depth ${layout.maxDepth}`} />
        <Stat label="Control-flow edges" value={cfg.edges.length} />
        <Stat label="Dominance frontiers" value={dfSet.size} hint="blocks where a φ belongs" />
        <Stat label="Exit blocks" value={cfg.exits.length} />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {Object.entries(edgeCounts).map(([k, n]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded" style={{ background: EDGE_COLOR[k] ?? "#888" }} />
            <span className="text-[10px] text-zinc-400">
              {k} <span className="text-zinc-600">{n}</span>
            </span>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setShowDf((v) => !v)}
          className={`ml-auto rounded border px-2 py-0.5 text-[10px] ${
            showDf ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-white/10 text-zinc-500"
          }`}
        >
          dominance frontiers {showDf ? "on" : "off"}
        </button>
      </div>

      {sel && (
        <div className="rounded-lg border border-sky-400/25 bg-sky-500/[0.04] p-3">
          <div className="flex items-center gap-2">
            <Badge tone="blue">B{sel.id}</Badge>
            <span className="text-[11px] text-zinc-300">
              {sel.start === sel.end ? `line ${sel.start}` : `lines ${sel.start}–${sel.end}`}
            </span>
            <span className="text-[10px] text-zinc-500">{sel.stmts_total} statement(s) in this block</span>
            {dfSet.has(sel.id) && <Badge tone="amber">in a dominance frontier</Badge>}
          </div>
          <div className="mt-2 space-y-0.5">
            {sel.stmts.length === 0 && <span className="text-[11px] text-zinc-600">no statements recorded for this block</span>}
            {sel.stmts.map((s, i) => (
              <pre key={i} className="overflow-x-auto rounded border border-white/8 bg-black/40 px-2 py-1 font-mono text-[11px] text-emerald-200/90">
                {s}
              </pre>
            ))}
            {sel.stmts_total > sel.stmts.length && (
              <p className="text-[10px] text-zinc-600">
                +{sel.stmts_total - sel.stmts.length} more trimmed from this mock's dataset
              </p>
            )}
          </div>
        </div>
      )}
      <div className="max-h-[70vh] overflow-auto rounded border border-white/8 bg-black/30">
        <svg width={layout.width} height={layout.height} className="block">
          <defs>
            {Object.entries(EDGE_COLOR).map(([k, c]) => (
              <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5"
                      markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
              </marker>
            ))}
          </defs>

          {/* edges first, so nodes sit on top */}
          {cfg.edges.map((e, i) => {
            const a = layout.pos.get(e.f);
            const b = layout.pos.get(e.t);
            if (!a || !b) return null;
            const back = b.y <= a.y;
            const y1 = a.y + NODE_H;
            const y2 = b.y;
            const d = back
              ? `M ${a.x} ${y1} C ${a.x - 70} ${y1 + 26}, ${b.x - 70} ${y2 - 26}, ${b.x} ${y2}`
              : `M ${a.x} ${y1} C ${a.x} ${y1 + (y2 - y1) / 2}, ${b.x} ${y2 - (y2 - y1) / 2}, ${b.x} ${y2}`;
            const dim = hover !== null && e.f !== hover && e.t !== hover;
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={EDGE_COLOR[e.k] ?? "#888"}
                strokeWidth={back ? 1 : 1.2}
                strokeDasharray={back ? "4 3" : e.k === "exception" ? "2 3" : undefined}
                markerEnd={`url(#arrow-${e.k})`}
                opacity={dim ? 0.12 : 0.75}
                className={e.k === "next" || e.k === "if_true" || e.k === "if_false" ? "cfg-flow" : undefined}
              />
            );
          })}

          {/* blocks */}
          {cfg.blocks.map((b) => {
            const p = layout.pos.get(b.id)!;
            const isEntry = b.id === cfg.entry;
            const isExit = cfg.exits.includes(b.id);
            const inChain = chain.has(b.id);
            const isHover = hover === b.id;
            const dim = hover !== null && !inChain && !isHover;
            const hasDf = showDf && dfSet.has(b.id);
            return (
              <g key={b.id}
                 transform={`translate(${p.x - NODE_W / 2},${p.y})`}
                 onMouseEnter={() => setHover(b.id)}
                 onMouseLeave={() => setHover(null)}
                 onClick={() => setSelected(b.id === selected ? null : b.id)}
                 style={{ cursor: "pointer" }}
                 opacity={dim ? 0.22 : 1}>
                <rect
                  width={NODE_W} height={NODE_H} rx={5}
                  fill={isHover ? "#1b2836" : inChain ? "#2a2313" : "#141a21"}
                  stroke={isHover ? "#7dd3fc" : inChain ? "#f59e0b" : isEntry ? "#22c55e" : isExit ? "#3b82f6" : "#2b323b"}
                  strokeWidth={isHover || inChain ? 1.4 : 1}
                />
                <text x={9} y={16} className="fill-zinc-300" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}>
                  B{b.id}
                </text>
                <text x={44} y={16} className="fill-zinc-500" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}>
                  {b.start === b.end ? `L${b.start}` : `L${b.start}–${b.end}`}
                  {b.stmts_total > 0 ? ` · ${b.stmts_total} stmt` : " · 0 stmt"}
                </text>
                {isEntry && <text x={NODE_W - 30} y={16} className="fill-emerald-400" style={{ fontSize: 9 }}>entry</text>}
                {isExit && !isEntry && <text x={NODE_W - 24} y={16} className="fill-sky-400" style={{ fontSize: 9 }}>exit</text>}
                {hasDf && <circle cx={NODE_W - 8} cy={7} r={2.6} className="fill-amber-400" />}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="text-[10px] leading-relaxed text-zinc-600">
        Vertical position is dominator depth, computed from <Mono>idom</Mono> — the layout is the
        dominance relation, not a force simulation. Hover a block to light up its dominator chain; click
        to read its statements.
        {meta.included < meta.total_functions_with_cfg && (
          <> Showing {meta.included} of {meta.total_functions_with_cfg} functions with a CFG; the rest are in{" "}
          <Mono>analysis/cfg_pdg.archive.bin</Mono>.</>
        )}
      </p>

      <p className="text-[10px] leading-relaxed text-zinc-600">
        Vertical position is dominator depth, computed from <Mono>idom</Mono> — the layout is the
        dominance relation, not a force simulation. Hover a block to light up its dominator chain; click
        to read its statements.
        {meta.included < meta.total_functions_with_cfg && (
          <> Showing {meta.included} of {meta.total_functions_with_cfg} functions with a CFG; the rest are in{" "}
          <Mono>analysis/cfg_pdg.archive.bin</Mono>.</>
        )}
      </p>

    </div>
  );
}

export function CfgLens({ cfg, name, meta }: { cfg: Cfg | undefined; name?: string; meta: GraphData["cfg_meta"] }) {
  if (!cfg) {
    return (
      <NotInBundle
        what={name ? `No control-flow graph bundled for ${name}` : "No control-flow graph for this subject"}
        why={`This mock carries ${meta.included} of the ${meta.total_functions_with_cfg} functions that have a CFG, to keep the dataset small. The real dashboard loads any of them on demand from the archive — that is why the old CFG tab rendered blank until you picked something, and why this one does not.`}
        command="rgctl -r <repo> -f json inspect <symbol> cfg"
      />
    );
  }
  return <CfgGraph cfg={cfg} name={name ?? ""} meta={meta} />;
}
