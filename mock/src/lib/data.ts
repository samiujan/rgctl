import raw from "../data/graph.json";

export interface Meta {
  repo: string;
  digest: string;
  full_digest: string;
  generated_at: number;
  nodes: number;
  edges: number;
  functions: number;
  classes: number;
  calls: number;
  version: string;
  modularity: number | null;
}

export interface Symbol {
  id: string;
  name: string;
  file: string;
  blocks: number;
  cfg_edges: number;
  pdg_nodes: number;
  data_edges: number;
  source_lines: number;
}

export interface Community {
  id: number;
  label: string;
  color: string;
  members: number;
  packages: number;
}

export interface Package {
  label: string;
  size: number;
  functions: number;
  x: number;
  y: number;
}

export interface MigrationStep {
  step: number;
  label: string;
  community: number;
  priority: number;
  avg_pagerank: number;
  rank: number;
}

export interface Mutation {
  member: string | null;
  local: string | null;
  file: string;
  line: number | null;
  kind: string | null;
}

export interface CfgBlock {
  id: number;
  label: string;
  start: number;
  end: number;
  stmts: string[];
  stmts_total: number;
}

export interface CfgEdge {
  f: number;
  t: number;
  k: string;
}

export interface Cfg {
  entry: number;
  exits: number[];
  blocks: CfgBlock[];
  edges: CfgEdge[];
  /** Flat array indexed by block id: `idom[x]` is x's immediate dominator, and `idom[entry] === entry`. */
  idom: number[];
  /** `df[i]` is the dominance frontier of block i — where a φ would be inserted. */
  df: number[][];
}

export interface CloneMember {
  file: string;
  name: string;
  start: number;
  end: number;
  loc: number;
  id: string;
}

export interface CloneGroup {
  hash: string;
  confidence: number;
  loc: number;
  members: CloneMember[];
}

export interface GraphData {
  meta: Meta;
  symbols: Symbol[];
  communities: Community[];
  packages: Package[];
  migration: MigrationStep[];
  migration_communities: { id: number; label: string; members: number; avg_pagerank: number }[];
  mutations: Record<string, Mutation[]>;
  mutation_meta: { types: string[]; writes: number; indexed: number; type_count: number };
  cfgs: Record<string, Cfg>;
  clones: {
    groups: CloneGroup[];
    group_count: number;
    recoverable_loc: number;
    files_involved: number;
    min_loc: number;
  };
  cfg_meta: {
    total_functions_with_cfg: number;
    included: number;
    with_dominance_frontiers: number;
    richest_blocks: number;
  };
  taint_available: boolean;
  blast_available: boolean;
}

export const data = raw as unknown as GraphData;
export const { meta } = data;

export function findSymbol(id: string | null): Symbol | undefined {
  if (!id) return undefined;
  return data.symbols.find((s) => s.id === id);
}

/** Search across name and file — the omnibox and the command palette both use this. */
export function searchSymbols(q: string, limit = 8): Symbol[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return data.symbols.slice(0, limit);
  return data.symbols
    .filter((s) => s.name.toLowerCase().includes(needle) || s.file.toLowerCase().includes(needle))
    .slice(0, limit);
}

export function mutationsFor(name: string): Mutation[] {
  return data.mutations[name] ?? [];
}

export function relativeTime(unixSeconds: number): string {
  const secs = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (secs < 90) return `${secs}s ago`;
  if (secs < 5400) return `${Math.round(secs / 60)}m ago`;
  if (secs < 172800) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86400)}d ago`;
}

/**
 * Coverage is DERIVED, not asserted. Tier-1 languages require CFG/PDG/taint + call graph +
 * hybrid CPG. What this bundle actually carries decides the dots — a language we cannot
 * evidence is not shown as covered.
 */
export function coverage(): { filled: number; total: number; note: string } {
  const cfg = data.symbols.length > 0;
  const dataflow = data.symbols.some((s) => s.data_edges > 0);
  const slices = data.symbols.some((s) => s.source_lines > 0);
  const cpg = Object.keys(data.mutations).length > 0;
  const taint = data.taint_available;
  const filled = [cfg, dataflow, slices, cpg, taint].filter(Boolean).length;
  return {
    filled,
    total: 5,
    note: taint
      ? "CFG/PDG · dataflow · slices · CPG · taint"
      : "no taint index in this bundle — see Security",
  };
}
