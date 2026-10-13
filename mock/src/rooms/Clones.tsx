import { useMemo, useState } from "react";
import { data } from "../lib/data";
import { Badge, Mono, Panel, Stat } from "../ui/primitives";

/**
 * Exact-clone view (Type-1, BLAKE3 `code_hash`).
 *
 * The visual is a **chord diagram**: files on a circle, one chord per clone group, thickness by lines
 * of code. A thick chord means "these two files are copy-paste siblings", which is exactly the thing
 * you want to see before refactoring. The layout is computed from the clone groups themselves — no
 * force simulation, no invented structure.
 *
 * Each group also gets an **identicon derived from its BLAKE3 hash**, so a group has a stable visual
 * fingerprint that survives re-indexing. It is a hash of the group, not decoration.
 */

type Group = (typeof data)["clones"]["groups"][number];

/** Deterministic 5×5 symmetric identicon from the group hash — a fingerprint, not ornament. */
function Identicon({ hash, size = 18 }: { hash: string; size?: number }) {
  const cells = useMemo(() => {
    const bytes: number[] = [];
    for (let i = 0; i < 15; i++) bytes.push(parseInt(hash.slice(i * 2, i * 2 + 2), 16));
    const hue = parseInt(hash.slice(0, 2), 16) * (360 / 256);
    return { bytes, hue };
  }, [hash]);
  const grid = 5;
  const cell = size / grid;
  const rects: { x: number; y: number; k: string }[] = [];
  let b = 0;
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < Math.ceil(grid / 2); x++) {
      const on = cells.bytes[b++ % cells.bytes.length] % 2 === 0;
      if (!on) continue;
      rects.push({ x, y, k: `${x}-${y}` });
      if (x !== grid - 1 - x) rects.push({ x: grid - 1 - x, y, k: `${grid - 1 - x}-${y}` });
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 rounded-[3px]">
      <rect width={size} height={size} fill="#12161c" />
      {rects.map((r) => (
        <rect key={r.k} x={r.x * cell} y={r.y * cell} width={cell} height={cell}
              fill={`hsl(${cells.hue} 65% 55%)`} />
      ))}
    </svg>
  );
}

function ChordDiagram({ groups, files }: { groups: Group[]; files: string[] }) {
  const R = 128;
  const C = 160;
  const [hover, setHover] = useState<string | null>(null);

  const angle = (f: string) => (files.indexOf(f) / files.length) * Math.PI * 2 - Math.PI / 2;
  const pt = (f: string, r = R) => ({ x: C + r * Math.cos(angle(f)), y: C + r * Math.sin(angle(f)) });

  const chords = useMemo(() => {
    const out: { from: string; to: string; loc: number; hash: string; key: string }[] = [];
    for (const g of groups) {
      const fs = [...new Set(g.members.map((m) => m.file))];
      for (let i = 0; i < fs.length; i++)
        for (let j = i + 1; j < fs.length; j++)
          out.push({ from: fs[i], to: fs[j], loc: g.loc, hash: g.hash, key: `${g.hash}-${fs[i]}-${fs[j]}` });
    }
    return out.sort((a, b) => b.loc - a.loc);
  }, [groups]);

  const maxLoc = Math.max(...chords.map((c) => c.loc), 1);

  return (
    <svg viewBox={`0 0 ${C * 2} ${C * 2}`} className="h-[320px] w-full">
      {chords.map((c) => {
        const a = pt(c.from);
        const b = pt(c.to);
        const active = hover === null || hover === c.from || hover === c.to;
        return (
          <path
            key={c.key}
            d={`M ${a.x} ${a.y} Q ${C} ${C} ${b.x} ${b.y}`}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={0.6 + (c.loc / maxLoc) * 4.4}
            opacity={active ? 0.5 : 0.06}
          />
        );
      })}
      {files.map((f) => {
        const p = pt(f);
        const node = pt(f, R);
        const active = hover === null || hover === f;
        const short = f.split("/").slice(-1)[0].replace(/\.(tsx|ts|js|mjs|py|java)$/, "");
        const anchor = p.x > C + 4 ? "start" : p.x < C - 4 ? "end" : "middle";
        return (
          <g key={f} onMouseEnter={() => setHover(f)} onMouseLeave={() => setHover(null)}>
            <circle cx={node.x} cy={node.y} r={3.2} fill={active ? "#7dd3fc" : "#334155"} />
            <text
              x={p.x + (anchor === "start" ? 6 : anchor === "end" ? -6 : 0)}
              y={p.y + 3}
              textAnchor={anchor}
              className={active ? "fill-zinc-400" : "fill-zinc-700"}
              style={{ fontSize: 8.5, fontFamily: "ui-monospace, monospace" }}
            >
              {short}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Clones() {
  const c = data.clones;
  const files = useMemo(
    () => [...new Set(c.groups.flatMap((g) => g.members.map((m) => m.file)))].sort(),
    [c],
  );
  const worst = c.groups[0];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Exact clone groups" value={c.group_count} hint={`min ${c.min_loc} LOC`} />
        <Stat label="Lines recoverable" value={`~${c.recoverable_loc}`} hint="extract each group once" />
        <Stat label="Files involved" value={c.files_involved} />
        <Stat label="Largest group" value={`${worst.loc} LOC`} hint={`×${worst.members.length}`} />
      </div>

      <Panel
        title="Duplication map"
        subtitle="files on the circle; a chord is one exact-clone group, thickness = lines of code"
        right={<Badge tone="zinc">BLAKE3 code_hash</Badge>}
      >
        <ChordDiagram groups={c.groups} files={files} />
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          A thick chord is a copy-paste sibling pair. Hover a file name to isolate its duplication.
        </p>
      </Panel>

      <Panel title="Groups" subtitle="identical by content hash — every match is exact, not similar">
        <div className="space-y-2">
          {c.groups.map((g) => (
            <div key={g.hash} className="rounded border border-white/8 bg-white/[0.015] p-2">
              <div className="flex items-center gap-2">
                <Identicon hash={g.hash} />
                <span className="font-mono text-[10px] text-zinc-500" title={g.hash}>
                  {g.hash.slice(0, 16)}
                </span>
                <Badge tone={g.loc >= 30 ? "amber" : "zinc"}>{g.loc} LOC</Badge>
                <Badge>{g.members.length}×</Badge>
                {g.confidence === 1 && <Badge tone="green">exact</Badge>}
              </div>
              <div className="mt-1.5 space-y-0.5 pl-[26px]">
                {g.members.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Mono>{m.file}</Mono>
                    <span className="text-[10px] text-zinc-600">
                      L{m.start}–{m.end}
                    </span>
                    <span className="truncate text-[10px] text-zinc-500">{m.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
