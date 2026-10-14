/**
 * The Focus — the one model that ties the surfaces together.
 *
 * A single portable identifier for "the thing you are currently looking at", carried across rooms and
 * lenses and serialized into the URL. It is deliberately *not* a per-view selection: that is what makes
 * rooms feel disconnected, and it is the failure mode the maintainer parked issue #61 over.
 *
 * The value is the engine's stable key (the graph's `path \x1f name`), so it does not depend on row
 * order or on a function UUID that a re-index may reassign.
 *
 * It does **not** survive a rename — the key contains the name, so renaming a symbol changes it. The v2
 * design doc claims otherwise ("rename-surviving"); that claim is wrong and is corrected in
 * `docs/design/dashboard-v2.md`. What the key does survive is re-indexing, which is the property the URL
 * actually needs.
 */

export type Focus = string;

export const UNITS = "\u001f";

/**
 * Focus keys are namespaced, because two identifiers are in circulation and they are not interchangeable.
 *
 * - `fn:<function_id>` — the UUID the indexes are keyed by today.
 * - `sk:<stable_key>` — the engine's `path \x1f name` stable key, used once the export carries it.
 *
 * The prefix exists so the two can never be confused: `sk:` keys survive a re-index, `fn:` keys are the
 * current bridge, and a URL written with one still says which it is a year later. Silently treating them
 * as one string would mean a stored link changing meaning the day the export changed shape.
 *
 * **`fn:` is temporary and has an expiry.** It exists only because the exported indexes do not yet carry
 * `stable_key`; once they do, `sk:` is what the UI emits and `fn:` is supported solely to keep links
 * written in the meantime working. The removal condition is not a date, it is a state:
 *
 *   delete `FN_PREFIX` handling once `stable_key` is in every index that feeds a Focus — `cfg_index.json`
 *   and `slice_index.json` — because at that point no reader can produce an `fn:` link and the branch is
 *   dead code pretending to be compatibility.
 *
 * Left unwritten, a compatibility shim outlives the thing it was compatible with. That is how a
 * two-line bridge becomes a permanent second identifier with its own bugs.
 */
export const FN_PREFIX = "fn:";
export const SK_PREFIX = "sk:";

/** Focus key for a function entry, preferring the stable key when the export provides one. */
export function keyOf(entry: { stable_key?: string | null; function_id: string }): Focus {
  return entry.stable_key ? SK_PREFIX + entry.stable_key : FN_PREFIX + entry.function_id;
}

export type FocusKind = "stable" | "function-id";

export function decodeFocus(key: Focus): { kind: FocusKind; value: string } | null {
  if (key.startsWith(SK_PREFIX)) return { kind: "stable", value: key.slice(SK_PREFIX.length) };
  if (key.startsWith(FN_PREFIX)) return { kind: "function-id", value: key.slice(FN_PREFIX.length) };
  return null;
}

/** Resolve a Focus against the loaded index. */
export function resolveFocus<T extends { stable_key?: string | null; function_id: string }>(
  key: Focus,
  entries: T[],
): T | null {
  const decoded = decodeFocus(key);
  if (!decoded) return null;
  return decoded.kind === "stable"
    ? (entries.find((e) => e.stable_key === decoded.value) ?? null)
    : (entries.find((e) => e.function_id === decoded.value) ?? null);
}

/** Human-readable label for a Focus: the symbol name when we can read one, else the raw value. */
export function describeKey(key: Focus): string {
  const decoded = decodeFocus(key);
  if (!decoded) return key;
  if (decoded.kind === "stable") {
    const parts = decoded.value.split(UNITS);
    return parts[1] ?? decoded.value;
  }
  return decoded.value.slice(0, 8);
}

/** Accept only a well-formed key, so a malformed URL cannot put the shell into a broken subject state. */
export function parseFocus(raw: unknown): Focus | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const decoded = decodeFocus(raw);
  if (!decoded || decoded.value.length === 0) return null;
  if (decoded.kind === "stable" && decoded.value.split(UNITS).length < 2) return null;
  return raw;
}

export const ROOMS = [
  { id: "repo", label: "Repo", blurb: "where do I start?" },
  { id: "understand", label: "Understand", blurb: "what does this symbol do?" },
  { id: "review", label: "Review", blurb: "what changed, what does it touch?" },
  { id: "security", label: "Security", blurb: "what is reachable and dangerous?" },
  { id: "architecture", label: "Architecture", blurb: "how is it structured?" },
  { id: "migration", label: "Migration", blurb: "what order should we move it?" },
  { id: "proof", label: "Proof", blurb: "why should I believe any of this?" },
] as const;

export const LENSES = [
  { id: "spine", label: "Spine" },
  { id: "code", label: "Code" },
  { id: "cfgpddg", label: "CFG·PDG" },
  { id: "dataflow", label: "Dataflow" },
  { id: "slice", label: "Slice/Trace" },
  { id: "blast", label: "Blast" },
  { id: "metrics", label: "Metrics" },
  { id: "time", label: "Time" },
] as const;

export type RoomId = (typeof ROOMS)[number]["id"];
export type LensId = (typeof LENSES)[number]["id"];

export const isRoom = (v: unknown): v is RoomId => ROOMS.some((r) => r.id === v);
export const isLens = (v: unknown): v is LensId => LENSES.some((l) => l.id === v);
