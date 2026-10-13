import { useEffect, useState, useCallback } from "react";

/**
 * The Focus: one identity-keyed subject, carried across rooms and serialised into the URL.
 *
 * This is the mechanism the whole IA rests on. It is deliberately NOT per-view state — every
 * room reads the same focus, so moving between rooms keeps the subject. In the real product the
 * key is `StableNodeKey = BLAKE3(path, name, type)`; here it is the function_id from the graph,
 * which is that same stable key.
 *
 * URL shape: `?room=understand&lens=cfgpddg&focus=<id>` — a whole view state is a shareable link.
 */

export const ROOMS = [
  { id: "repo", label: "Repo", icon: "◎", blurb: "where do I start?" },
  { id: "review", label: "Review", icon: "◧", blurb: "what changed, what does it touch?" },
  { id: "security", label: "Security", icon: "⚠", blurb: "what is reachable and dangerous?" },
  { id: "architecture", label: "Architecture", icon: "▦", blurb: "how is it structured?" },
  { id: "migration", label: "Migration", icon: "⇥", blurb: "what order should we move it?" },
  { id: "understand", label: "Understand", icon: "⌕", blurb: "what does this symbol do?" },
  { id: "proof", label: "Proof", icon: "✓", blurb: "why should I believe any of this?" },
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
