/**
 * Compiler-IR view of one function.
 *
 * Every visual property encodes real data — none of it is decoration:
 *
 *   vertical position = dominator depth, walked from the entry block via `idom`
 *   edge colour       = control-flow edge type
 *   amber dot         = the block appears in a dominance frontier (where a φ would be placed)
 *   hover             = the block's dominator chain, i.e. what must execute before it
 *   mute on hover     = everything not on that chain, so the chain is read by exclusion
 *
 * The vertical axis is the whole point: the layout *is* the analysis. A block lower down is dominated by
 * everything on the amber path above it. Ported from the retired prototype, which is where this was
 * worked out; the prototype showed a static dataset, this draws a live one.
 *
 * Selection is controlled from the parent so the source pane and this pane share one selection rather
 * than each keeping its own — two selections for one Focus is the failure this design exists to avoid.
 */
import { useMemo, useState } from "react";
import type { CfgDetail } from "../data";
import { Chip } from "../shell";

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
const MAX_DEPTH_GUARD = 512;

/** A block with no source lines: `start_line: 0` is the absence of a line, not line zero. */
export function hasLines(b: { start_line: number; end_line: number }): boolean {
  return b.start_line > 0 || b.end_line > 0;
}

export function lineLabel(b: { start_line: number; end_line: number }): string {
  if (!hasLines(b)) return "—";
  return b.start_line === b.end_line ? `L${b.start_line}` : `L${b.start_line}–${b.end_line}`;
}

/**
 * Dominator depth per block id, walked from `idom`.
 *
 * Memoized, with a depth guard: `idom` can contain a cycle in malformed input, and a walk that trusts it
 * would hang the render rather than draw a wrong picture.
 */
function dominatorDepths(idom: number[] | undefined, ids: number[]): Map<number, number> {
  const depth = new Map<number, number>();
  if (!idom) return depth;
  const walk = (x: number, guard = 0): number => {
    const known = depth.get(x);
    if (known !== undefined) return known;
    if (guard > MAX_DEPTH_GUARD) return 0;
    const parent = idom[x];
    const value = parent === undefined || parent === x || parent < 0 ? 0 : walk(parent, guard + 1) + 1;
    depth.set(x, value);
    return value;
  };
  for (const id of ids) walk(id);
  return depth;
}

export function CfgGraph({
  cfg,
  selected,
  onSelect,
}: {
  cfg: CfgDetail;
  selected: number | null;
  onSelect: (id: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const layout = useMemo(() => {
    const ids = cfg.blocks.map((b) => b.id);
    const depth = dominatorDepths(cfg.idom, ids);

    const rows = new Map<number, typeof cfg.blocks>();
    for (const b of cfg.blocks) {
      const d = depth.get(b.id) ?? 0;
      if (!rows.has(d)) rows.set(d, []);
      rows.get(d)!.push(b);
    }

    const maxDepth = Math.max(...rows.keys(), 0);
    const widest = Math.max(...[...rows.values()].map((r) => r.length), 1);
    const width = Math.max(880, widest * (NODE_W + 26) + PAD_X * 2);
    const height = (maxDepth + 1) * ROW_H + PAD_Y * 2;

    const pos = new Map<number, { x: number; y: number }>();
    for (const [d, list] of rows) {
      list.sort((a, b) => a.id - b.id);
      const usable = width - PAD_X * 2;
      list.forEach((b, i) => {
        pos.set(b.id, { x: PAD_X + (usable * (i + 0.5)) / list.length, y: PAD_Y + d * ROW_H });
      });
    }
    return { pos, width, height, maxDepth };
  }, [cfg]);

  /** Blocks that must execute before `hover`: the reverse of the idom walk. */
  const chain = useMemo(() => {
    const s = new Set<number>();
    if (hover === null || !cfg.idom) return s;
    let x: number | undefined = hover;
    let guard = 0;
    while (x !== undefined && !s.has(x) && guard++ < MAX_DEPTH_GUARD) {
      s.add(x);
      // Explicitly typed: inside the loop `cfg.idom` is optional, and letting TypeScript infer from a
      // self-referential reassignment makes it `any` rather than `number | undefined`.
      const parent: number | undefined = cfg.idom[x];
      if (parent === x || parent === undefined || parent < 0) break;
      x = parent;
    }
    return s;
  }, [hover, cfg]);

  /** Blocks in a dominance frontier — indexed by block id, matching `idom`. */
  const frontier = useMemo(() => {
    const s = new Set<number>();
    cfg.dominance_frontiers?.forEach((list, id) => {
      if (list && list.length) s.add(id);
    });
    return s;
  }, [cfg]);

  const edges = cfg.edges ?? [];

  const edgeKinds = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of edges) counts[e.edge_type] = (counts[e.edge_type] ?? 0) + 1;
    return counts;
  }, [edges]);

  const withLines = cfg.blocks.filter(hasLines).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {edges.length === 0 && (
          <span className="text-[10px] text-amber-300/90">
            no control-flow edges in this bundle — blocks are drawn unconnected
          </span>
        )}
        {Object.entries(edgeKinds).map(([kind, n]) => (
          <span key={kind} className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded" style={{ background: EDGE_COLOR[kind] ?? "#888" }} />
            <span className="text-[10px] text-zinc-400">
              {kind} <span className="text-zinc-600">{n}</span>
            </span>
          </span>
        ))}
        <Chip tone="amber">dominance frontier {frontier.size}</Chip>
        <span className="ml-auto text-[10px] text-zinc-600">
          depth {layout.maxDepth} · {withLines}/{cfg.blocks.length} blocks carry source lines
        </span>
      </div>

      <div className="max-h-[52vh] overflow-auto rounded border border-white/8 bg-black/30">
        <svg width={layout.width} height={layout.height} className="block">
          <defs>
            {Object.entries(EDGE_COLOR).map(([kind, color]) => (
              <marker
                key={kind}
                id={`rgctl-arrow-${kind}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
              </marker>
            ))}
          </defs>

          {edges.map((e, i) => {
            const from = layout.pos.get(e.from);
            const to = layout.pos.get(e.to);
            if (!from || !to) return null;
            const y1 = from.y + NODE_H;
            const y2 = to.y;
            const dim = hover !== null && !chain.has(e.from) && !chain.has(e.to);
            return (
              <path
                key={i}
                d={
                  y2 > y1
                    ? `M ${from.x} ${y1} C ${from.x - 70} ${y1 + 26}, ${to.x - 70} ${y2 - 26}, ${to.x} ${y2}`
                    : `M ${from.x} ${y1} C ${from.x} ${y1 + (y2 - y1) / 2}, ${to.x} ${y2 - (y2 - y1) / 2}, ${to.x} ${y2}`
                }
                fill="none"
                stroke={EDGE_COLOR[e.edge_type] ?? "#888"}
                strokeWidth={1}
                strokeDasharray={e.edge_type === "exception" ? "2 3" : undefined}
                markerEnd={`url(#rgctl-arrow-${e.edge_type})`}
                opacity={dim ? 0.1 : 0.7}
              />
            );
          })}

          {cfg.blocks.map((b) => {
            const p = layout.pos.get(b.id);
            if (!p) return null;
            const isEntry = b.id === cfg.entry;
            const isExit = cfg.exits.includes(b.id);
            const onChain = chain.has(b.id);
            const isSelected = selected === b.id;
            const dim = hover !== null && !onChain && !isSelected;
            const lines = hasLines(b);
            return (
              <g
                key={b.id}
                transform={`translate(${p.x - NODE_W / 2}, ${p.y})`}
                onMouseEnter={() => setHover(b.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect(isSelected ? null : b.id)}
                style={{ cursor: "pointer" }}
                opacity={dim ? 0.2 : 1}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={5}
                  fill={isSelected ? "#1b2836" : onChain ? "#2a2313" : "#141a21"}
                  stroke={isSelected ? "#7dd3fc" : onChain ? "#f59e0b" : isEntry ? "#22c55e" : isExit ? "#3b82f6" : "#2b323b"}
                  strokeWidth={isSelected || onChain ? 1.4 : 1}
                />
                <text x={9} y={16} className="fill-zinc-300" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}>
                  B{b.id}
                </text>
                <text x={44} y={16} className="fill-zinc-500" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}>
                  {/* A block with no lines points at no source, so it says so rather than claiming L0. */}
                  {lines ? lineLabel(b) : "no source line"}
                  {` · ${b.stmts_total ?? b.statements.length} stmt`}
                </text>
                {isEntry && (
                  <text x={NODE_W - 30} y={16} className="fill-emerald-400" style={{ fontSize: 9 }}>
                    entry
                  </text>
                )}
                {isExit && !isEntry && (
                  <text x={NODE_W - 24} y={16} className="fill-sky-400" style={{ fontSize: 9 }}>
                    exit
                  </text>
                )}
                {frontier.has(b.id) && <circle cx={NODE_W - 8} cy={7} r={2.6} className="fill-amber-400" />}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="text-[10px] leading-relaxed text-zinc-600">
        Vertical position is dominator depth from <code className="text-zinc-500">idom</code> — the layout
        is the dominance relation, not a force simulation. Hover a block to light up its dominator chain;
        click to read its statements and highlight its lines.
      </p>
    </div>
  );
}
