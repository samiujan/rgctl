import { data, meta, type MigrationStep } from "../lib/data";
import { Clones } from "./Clones";
import type { RoomId } from "../lib/focus";
import { Badge, Bar, Mono, NotInBundle, Panel, Row, Stat } from "../ui/primitives";

// ─────────────────────────────────────────────────────────────── Orientation
/** "Where do I start?" — decision-shaped, never vanity counts. */
export function Repo({ onGo }: { onGo: (r: RoomId) => void }) {
  const withFlow = data.symbols.filter((s) => s.data_edges > 0).length;
  const cards: { title: string; detail: string; room: RoomId; tone: "blue" | "amber" | "zinc" | "green" }[] = [
    {
      title: `${withFlow} symbols carry data flow`,
      detail: "Start where the code is densest. Each one opens in Understand with its CFG/PDG.",
      room: "understand",
      tone: "blue",
    },
    {
      title: "Security triage is unavailable",
      detail: "No taint index in this bundle. Understand exactly why before trusting an empty findings list.",
      room: "security",
      tone: "amber",
    },
    {
      title: `${data.communities.length} communities, modularity ${meta.modularity?.toFixed(3) ?? "—"}`,
      detail: "How the codebase actually clusters, by label propagation — not Louvain.",
      room: "architecture",
      tone: "zinc",
    },
    {
      title: `${data.migration.length}-step migration order`,
      detail: "Deterministic schedule from coupling, centrality and blast radius.",
      room: "migration",
      tone: "green",
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-prose text-[12px] leading-relaxed text-zinc-400">
        This screen is not a dashboard. It ranks the few things worth attention and links into the room
        that handles each one. Totals live in the graph — they do not tell you where to start.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <button
            key={c.title}
            type="button"
            onClick={() => onGo(c.room)}
            className="rounded-lg border border-white/8 bg-white/[0.02] p-3 text-left transition-colors hover:border-sky-400/30 hover:bg-white/[0.04]"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[13px] font-medium text-zinc-100">{c.title}</span>
              <Badge tone={c.tone}>{c.room}</Badge>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">{c.detail}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── Review
export function Review() {
  return (
    <div className="flex flex-col gap-3">
      <NotInBundle
        what="No review change-set in this bundle"
        why="This room renders .rgctl/workflows/review.json — the composed artifact from `rgctl review export`. It is deliberately a contract, not a UI: review paths, policy result and the violation timeline in one versioned file, with provenance and truncation recorded so a truncated report cannot be mistaken for a complete one."
        command="rgctl -r <repo> review export --base-ref origin/main --head-ref HEAD"
      />
      <Panel title="What this room will show" subtitle="the shape it consumes">
        <div className="space-y-1.5 text-[11px] text-zinc-400">
          {[
            "change_summary — changed symbols, added/removed/retargeted call edges, files in scope",
            "symbols[] — path_before and path_after call spines, plus classified path_delta",
            "policy — passed? violations by class (new / existing / resolved / regression)",
            "timeline — the append-only violation ledger, so age is visible",
            "truncation — explicit flags; a capped report says so rather than looking complete",
            "provenance — the exact commands and graph digests behind every number",
          ].map((t) => (
            <div key={t} className="flex gap-2">
              <span className="text-zinc-600">·</span>
              <span>{t}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── Security
export function Security() {
  return (
    <div className="flex flex-col gap-3">
      <NotInBundle
        what="Taint analysis was not built for this repository"
        why="The Taint room needs a taint index, which discover only writes with an explicit flag. This is the difference between 'no findings' and 'nothing was analysed' — a security surface that renders green here would be lying."
        command="rgctl -r <repo> discover . --with-taint"
      />
      <Panel title="Limits you must know before trusting this room" subtitle="stated where the numbers appear, not in a footnote">
        <ul className="space-y-1.5 text-[11px] leading-relaxed text-zinc-400">
          <li>· <span className="text-zinc-200">Taint is intra-procedural.</span> It does not follow a value through a call boundary.</li>
          <li>· <span className="text-zinc-200">Blast radius traverses Calls edges only.</span> Indirect, virtual and macro call sites are all recorded on the edge, but the traversal does not use them — so impact can under-report in exactly the dynamic-dispatch languages rgctl invests in most.</li>
          <li>· Risk weighting combines severity, centrality and reachability; each input is printed next to the verdict rather than folded into one unexplained score.</li>
        </ul>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── Architecture
export function Architecture() {
  const max = Math.max(...data.communities.map((c) => c.members));
  const px = data.packages.map((p) => p.x);
  const py = data.packages.map((p) => p.y);
  const span = (v: number[], pad = 20) => [Math.min(...v) - pad, Math.max(...v) + pad];
  const [x0, x1] = span(px);
  const [y0, y1] = span(py);
  const sx = (x: number) => ((x - x0) / (x1 - x0)) * 100;
  const sy = (y: number) => ((y - y0) / (y1 - y0)) * 100;

  return (
    <div className="flex flex-col gap-3">
      <Panel
        title="Communities"
        subtitle={`modularity ${meta.modularity?.toFixed(3) ?? "—"} · label propagation (Raghavan 2007) + Newman modularity`}
        right={<Badge tone="zinc">not Louvain</Badge>}
      >
        <div className="space-y-1">
          {data.communities.slice(0, 12).map((c) => (
            <div key={c.id} className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c.color }} />
              <span className="w-56 shrink-0 truncate text-[12px] text-zinc-200">{c.label}</span>
              <span className="w-24"><Bar value={c.members} max={max} /></span>
              <span className="w-14 shrink-0 text-right text-[11px] text-zinc-500">{c.members}</span>
              <span className="shrink-0 text-[10px] text-zinc-600">{c.packages} pkg</span>
            </div>
          ))}
        </div>
        <p className="mt-3 border-t border-white/8 pt-3 text-[11px] leading-relaxed text-zinc-500">
          Names are the greatest common path prefix of the members. The exported field is still called
          <Mono> louvain_community_id</Mono> in the migration payload — kept for compatibility, and wrong.
        </p>
      </Panel>

      <Clones />

      <Panel title="Packages" subtitle="real exported layout coordinates — no client-side force simulation">
        <div className="relative h-52 w-full overflow-hidden rounded border border-white/8 bg-black/30">
          {data.packages.map((p) => (
            <span
              key={p.label}
              title={`${p.label} — ${p.functions} functions`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400/25 ring-1 ring-sky-300/40"
              style={{
                left: `${sx(p.x)}%`,
                top: `${sy(p.y)}%`,
                width: `${Math.max(8, Math.min(30, Math.sqrt(p.size) * 1.6))}px`,
                height: `${Math.max(8, Math.min(30, Math.sqrt(p.size) * 1.6))}px`,
              }}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── Migration
export function Migration() {
  const maxP = Math.max(...data.migration.map((s) => s.priority));
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Migration order" subtitle="deterministic schedule from coupling, centrality and blast radius">
        <div className="space-y-1">
          {data.migration.map((s: MigrationStep) => (
            <Row key={s.step}>
              <span className="w-6 shrink-0 text-right text-[11px] text-zinc-500">{s.step}</span>
              <span className="w-64 shrink-0 truncate text-[12px] text-zinc-200">{s.label}</span>
              <span className="w-24"><Bar value={s.priority} max={maxP} /></span>
              <span className="w-14 shrink-0 text-right font-mono text-[11px] text-zinc-400">{s.priority.toFixed(3)}</span>
              <span className="shrink-0 text-[10px] text-zinc-600">community {s.community}</span>
            </Row>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── Proof
export function Proof() {
  const matrix = [
    { corpus: "Linux kernel", nodes: "3,312,280", functions: "1,862,845", wall: "145 s", rss: "15,256 MB" },
    { corpus: "LLVM (clang/)", nodes: "—", functions: "—", wall: "120 s", rss: "—" },
    { corpus: "VS Code (src/)", nodes: "—", functions: "—", wall: "120 s", rss: "—" },
    { corpus: "metasfresh", nodes: "—", functions: "~128k", wall: "74 s", rss: "—" },
    { corpus: "rustc", nodes: "—", functions: "—", wall: "25 s", rss: "—" },
    { corpus: "ecommerce-java", nodes: "—", functions: "—", wall: "0.31 s", rss: "—" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Speed" subtitle="cold discover, release binary, ref machine Apple M3 Pro (12 cores) · walls are CI-enforced with a +10% tolerance">
        <table className="w-full text-[11px]">
          <thead className="text-zinc-500">
            <tr className="text-left">
              <th className="py-1 font-normal">corpus</th>
              <th className="py-1 text-right font-normal">nodes</th>
              <th className="py-1 text-right font-normal">functions</th>
              <th className="py-1 text-right font-normal">wall</th>
              <th className="py-1 text-right font-normal">peak RSS</th>
            </tr>
          </thead>
          <tbody className="font-mono text-zinc-300">
            {matrix.map((r) => (
              <tr key={r.corpus} className="border-t border-white/6">
                <td className="py-1 font-sans text-zinc-200">{r.corpus}</td>
                <td className="py-1 text-right">{r.nodes}</td>
                <td className="py-1 text-right">{r.functions}</td>
                <td className="py-1 text-right text-emerald-300">{r.wall}</td>
                <td className="py-1 text-right text-zinc-500">{r.rss}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
          Walls come from <Mono>tests/cold_profile_gates.rs</Mono> — a regression fails CI, it does not warn.
        </p>
      </Panel>

      <Panel title="Correctness" subtitle="per-language fixtures assert exact facts, not ranges">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Languages" value="14 + ERB" />
          <Stat label="Exact assertions" value="block / data / control / idom / impact" />
          <Stat label="Severity model" value="required · best_effort · unsupported" />
          <Stat label="QE policy" value="required checks stay red" />
        </div>
      </Panel>

      <Panel title="What this does not do" subtitle="published with the wins, not instead of them">
        <ul className="space-y-1.5 text-[11px] leading-relaxed text-zinc-400">
          <li>· <span className="text-zinc-200">No MCP server.</span> Shipped once, then deliberately removed — the agent surface is CLI JSON plus skills.</li>
          <li>· <span className="text-zinc-200">No Leiden, and no true Louvain.</span> Communities are label propagation with Newman modularity.</li>
          <li>· <span className="text-zinc-200">Taint is intra-procedural</span> — it does not cross call boundaries.</li>
          <li>· <span className="text-zinc-200">Blast radius uses Calls edges only</span>, so indirect/virtual/macro sites under-report impact.</li>
          <li>· <span className="text-zinc-200">No Cypher</span> (GQL plus structured verbs), and no PDF/image/video ingestion.</li>
        </ul>
      </Panel>
    </div>
  );
}
