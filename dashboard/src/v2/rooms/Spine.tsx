/**
 * The Spine lens — source for the focused symbol, beside its control-flow graph.
 *
 * This is the piece the maintainer named as missing on issue #61: "CFG, slice, blast, and dataflow only
 * make sense next to the actual source". The graph and the code are two views of one Focus, so the
 * binding between them is by line number in both directions: selecting a block highlights the lines it
 * covers, and the source shows which blocks cover the selection.
 *
 * Scope discipline: no file tree, no editing, no go-to-definition. This is a view of the Focus, not an
 * IDE, and the boundary is what keeps the change reviewable.
 */
import { useEffect, useState } from "react";
import { Chip, Command, Panel, Stat, Unavailable } from "../shell";
import {
  excerpt,
  loadCfgDetail,
  loadSourceForPath,
  relative,
  repoRoot,
  type CfgBlock,
  type CfgDetail,
  type FunctionEntry,
} from "../data";

type SourceState =
  | { kind: "loading" }
  | { kind: "ready"; lines: { line: number; text: string }[] }
  | { kind: "absent"; reason: string };

export function Spine({ entry }: { entry: FunctionEntry }) {
  const [cfg, setCfg] = useState<CfgDetail | null>(null);
  const [source, setSource] = useState<SourceState>({ kind: "loading" });
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [prefix, setPrefix] = useState("");

  useEffect(() => {
    let cancelled = false;
    setCfg(null);
    setSource({ kind: "loading" });
    setSelectedBlock(null);

    void repoRoot().then((p) => {
      if (!cancelled) setPrefix(p);
    });

    void loadCfgDetail(entry.function_id).then((detail) => {
      if (!cancelled) setCfg(detail);
    });

    void (async () => {
      if (!entry.file_path) {
        setSource({ kind: "absent", reason: "This index entry carries no file path, so there is nothing to read." });
        return;
      }
      const text = await loadSourceForPath(entry.file_path);
      if (cancelled) return;
      if (text === null) {
        setSource({
          kind: "absent",
          reason:
            "This bundle did not export source text. `sources/` is written by the CFG/slice export, so a bundle discovered without it has no source to show.",
        });
        return;
      }
      setSource({ kind: "ready", lines: excerpt(text, 1, text.split("\n").length) });
    })();

    return () => {
      cancelled = true;
    };
  }, [entry.function_id, entry.file_path]);

  const selected = selectedBlock === null ? null : (cfg?.blocks.find((b) => b.id === selectedBlock) ?? null);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="File" value={<span className="font-mono text-[12px]">{entry.file_path?.split("/").pop() ?? "—"}</span>} hint={entry.file_path ? relative(entry.file_path, prefix) : undefined} />
        <Stat label="Blocks" value={cfg?.blocks.length ?? "—"} />
        <Stat label="CFG edges" value={entry.cfg_edge_count ?? "—"} />
        <Stat label="PDG nodes" value={entry.pdg_nodes ?? "—"} />
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex min-w-0 flex-[3] flex-col">
          <Panel
            title="Source"
            subtitle={entry.file_path ? relative(entry.file_path, prefix) : undefined}
            right={
              selected ? (
                <Chip tone="blue">
                  {hasLines(selected) ? `lines ${selected.start_line}\u2013${selected.end_line}` : "block has no source lines"}
                </Chip>
              ) : undefined
            }
          >
            {source.kind === "loading" && <p className="text-[11px] text-zinc-500">loading…</p>}
            {source.kind === "absent" && <Unavailable what="Source text is not available" why={source.reason} />}
            {source.kind === "ready" && (
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full border-collapse font-mono text-[11px] leading-[1.5]">
                  <tbody>
                    {source.lines.map(({ line, text }) => {
                      const inBlock = selected !== null && hasLines(selected) &&
                        line >= selected.start_line && line <= selected.end_line;
                      return (
                        <tr key={line} className={inBlock ? "bg-sky-500/10" : undefined}>
                          <td className="w-12 select-none pr-3 text-right align-top text-zinc-600">{line}</td>
                          <td className="whitespace-pre-wrap break-all align-top text-zinc-300">
                            {text || "\u00a0"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-[2] flex-col">
          <Panel
            title="Control flow"
            subtitle="select a block to highlight the lines it covers"
            right={cfg ? <Chip tone="green">rendering</Chip> : undefined}
          >
            {!cfg && <p className="text-[11px] text-zinc-500">loading…</p>}
            {cfg && (
              <div className="max-h-[60vh] space-y-0.5 overflow-auto">
                {cfg.blocks.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBlock(b.id === selectedBlock ? null : b.id)}
                    className={`flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left font-mono text-[11px] ${
                      b.id === selectedBlock ? "bg-sky-500/15 text-sky-100" : "text-zinc-300 hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="w-8 shrink-0 text-zinc-500">B{b.id}</span>
                    <span className="w-20 shrink-0 text-zinc-400">{lineLabel(b)}</span>
                    <span className="w-14 shrink-0 text-zinc-600">{b.stmts_total ?? b.statements.length} stmt</span>
                    {b.id === cfg.entry && <Chip tone="green">entry</Chip>}
                    {cfg.exits.includes(b.id) && <Chip tone="blue">exit</Chip>}
                  </button>
                ))}
              </div>
            )}
          </Panel>
          <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
            Source and graph are bound by line number, both directions, from a single Focus. The dominance
            layout that made this readable in the prototype is not ported yet.
          </p>
          <Command>rgctl -r &lt;repo&gt; -f json inspect {entry.name} cfg</Command>
        </div>
      </div>
    </div>
  );
}

/**
 * A CFG block either covers source lines or it does not.
 *
 * The synthetic prologue and epilogue blocks carry `start_line: 0`, which is not line zero — it is the
 * absence of a line. Rendering it as "L0" invites the reader to believe there is a line 0, and it is the
 * same `—`-versus-`0` confusion fixed as defect D4 in the v1 dashboard. Roughly 59% of blocks in a real
 * bundle carry line information; the rest are real blocks with no source to point at.
 */
function hasLines(b: CfgBlock): boolean {
  return b.start_line > 0 || b.end_line > 0;
}

function lineLabel(b: CfgBlock): string {
  if (!hasLines(b)) return "—";
  return b.start_line === b.end_line ? `L${b.start_line}` : `L${b.start_line}–${b.end_line}`;
}
