import { data, findSymbol, mutationsFor, type Symbol } from "../lib/data";
import { CfgLens } from "./CfgGraph";
import type { LensId, RoomId } from "../lib/focus";
import { Badge, KeyHint, Mono, NotInBundle, Panel, Row, Stat } from "../ui/primitives";

/** Lenses that have real data in THIS bundle, versus ones that need an artifact we do not have. */
function LensBody({ lens, sym }: { lens: LensId; sym: Symbol }) {
  switch (lens) {
    case "code":
      return (
        <Panel title="Code" subtitle={`${sym.file} · ${sym.source_lines} source lines`}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Source lines" value={sym.source_lines} />
            <Stat label="File" value={<Mono>{sym.file.split("/").pop()}</Mono>} hint={sym.file} />
          </div>
        </Panel>
      );

    case "cfgpddg":
      return (
        <Panel
          title="Control-flow graph"
          subtitle="compiler IR — dominators and dominance frontiers computed in-graph"
          right={data.cfgs[sym.id] ? <Badge tone="green">rendering</Badge> : undefined}
        >
          <CfgLens cfg={data.cfgs[sym.id]} name={sym.name} meta={data.cfg_meta} />
        </Panel>
      );

    case "dataflow":
      return (
        <Panel title="Dataflow" subtitle="def-use over the PDG">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Data-dependence edges" value={sym.data_edges} />
            <Stat label="PDG nodes" value={sym.pdg_nodes} />
          </div>
        </Panel>
      );

    case "slice":
      return (
        <Panel title="Slice / Trace" subtitle="statement-level slicing">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Sliceable statements" value={sym.source_lines} hint="from the slice index" />
            <Stat label="PDG nodes" value={sym.pdg_nodes} />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
            Interprocedural slicing crosses function boundaries. Note: on the CLI the trace is currently
            printed after the JSON envelope, so <Mono>-f json</Mono> consumers cannot see it yet.
          </p>
        </Panel>
      );

    case "metrics":
      return (
        <NotInBundle
          what="Per-symbol centrality is not in this bundle"
          why="function_metrics.json is keyed by columnar node index, and this mock only carries the name-keyed indexes — so there is no honest join to show. Zero would be a lie here, not a measurement."
          command={`rgctl -r <repo> -f json metrics --pagerank --betweenness | jq '.nodes[] | select(.name=="${sym.name}")'`}
        />
      );

    case "blast":
      return (
        <NotInBundle
          what="No blast radius for this symbol"
          why="The bulk blast fill was skipped for this repository — the call graph condenses to one giant SCC, so eager reachability is not computed and every score is 0 rather than small. On-demand evaluation is available."
          command={`rgctl -r <repo> -f json blast-radius '${sym.name}' | jq '.metrics'`}
        />
      );

    case "time":
      return (
        <NotInBundle
          what="No temporal history for this symbol"
          why="This is the point of keying on BLAKE3(path, name, type) rather than a row id: the key survives renames, so a snapshot diff can say whether this symbol is new, existing, resolved — or a regression — across revisions."
          command={"rgctl -r <repo> review export --base-ref origin/main --head-ref HEAD"}
        />
      );

    default:
      return (
        <NotInBundle
          what="No representative call spine in this bundle"
          why="A spine needs the caller/callee index; this mock carries the per-function CFG/PDG indexes only."
          command={`rgctl -r <repo> -f json callers '${sym.name}' | jq '.callers[].name'`}
        />
      );
  }
}

export function Understand({
  focus,
  lens,
  onCarry,
}: {
  focus: string | null;
  lens: LensId;
  onCarry: (room: RoomId) => void;
}) {
  const sym = findSymbol(focus);
  if (!sym) {
    return (
      <Panel title="Understand" subtitle="no subject selected">
        <p className="text-[12px] text-zinc-400">
          Press <KeyHint>⌘K</KeyHint> or pick a symbol to give this room a subject. A room never demands a
          selection before rendering — it falls back to a useful default rather than an empty state.
        </p>
      </Panel>
    );
  }

  const muts = mutationsFor(sym.name);

  return (
    <div className="flex flex-col gap-3">
      <Panel
        title={sym.name}
        subtitle={sym.file}
        right={<Badge tone="blue">focus</Badge>}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Stable key" value={<Mono title={sym.id}>{sym.id.slice(0, 12)}</Mono>} hint="BLAKE3(path,name,type)" />
          <Stat label="Blocks" value={sym.blocks} />
          <Stat label="PDG nodes" value={sym.pdg_nodes} />
          <Stat label="Data edges" value={sym.data_edges} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">carry this focus to</span>
          {(["review", "security", "architecture", "migration", "proof"] as RoomId[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onCarry(r)}
              className="rounded border border-white/12 bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-300 hover:border-sky-400/40 hover:text-sky-200"
            >
              {r} →
            </button>
          ))}
        </div>
      </Panel>

      <LensBody lens={lens} sym={sym} />

      {muts.length > 0 && (
        <Panel title="Field writes touching this symbol" subtitle={`${muts.length} from the hybrid CPG`}>
          <div className="space-y-0.5">
            {muts.slice(0, 8).map((m, i) => (
              <Row key={i}>
                <Mono>{m.local ?? "?"}</Mono>
                <span className="text-zinc-500">.</span>
                <span className="text-zinc-200">{m.member}</span>
                <span className="ml-auto flex items-center gap-2">
                  <Badge tone={m.kind === "ThisField" ? "blue" : "zinc"}>{m.kind}</Badge>
                  <Mono>{m.file.split("/").pop()}:{m.line}</Mono>
                </span>
              </Row>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
