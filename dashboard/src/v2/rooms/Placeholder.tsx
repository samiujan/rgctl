/**
 * Rooms that are changes 2–6.
 *
 * They render an explicit, typed absence naming the change that fills them, rather than an empty panel.
 * A reviewer can then tell "not built yet" from "built and found nothing" — the same distinction the
 * shell enforces everywhere else.
 */
import { Panel, Unavailable } from "../shell";
import type { RoomId } from "../focus";

const PENDING: Partial<Record<RoomId, { change: string; what: string; why: string }>> = {
  review: {
    change: "change 2 (add-review-workflow-dashboard)",
    what: "Review room",
    why: "Renders the composed artifact from `rgctl review export` — review paths, policy result and the violation timeline in one versioned file, with provenance and truncation recorded so a truncated report cannot be mistaken for a complete one.",
  },
  security: {
    change: "change 3 (add-security-workflow-dashboard)",
    what: "Security room",
    why: "Risk-weighted triage: severity × centrality × reachability, so the list is ordered by what actually matters rather than by rule id.",
  },
  architecture: {
    change: "change 4 (add-architecture-city-view)",
    what: "Architecture room",
    why: "Communities and coupling, with the 3D Code City arriving here at the earliest — depth has to encode real data or it is decoration.",
  },
  migration: {
    change: "change 6 (add-migration-workflow-dashboard)",
    what: "Migration room",
    why: "The deterministic schedule from coupling, centrality and blast radius, restyled onto the v2 shell.",
  },
  proof: {
    change: "change 5 (add-proof-surface)",
    what: "Proof room",
    why: "The speed matrix, correctness scorecard, determinism checks and published limits — the numbers that justify trusting the rest.",
  },
};

export function Placeholder({ room }: { room: RoomId }) {
  const info = PENDING[room];
  if (!info) return null;
  return (
    <Panel title={info.what} subtitle={`not built yet — ${info.change}`}>
      <Unavailable what={`${info.what} is not implemented in change 1`} why={info.why} />
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
        This is deliberate: change 1 builds the frame and the Focus, and adds no analysis view. The rooms
        arrive as changes 2–6 and are expected to be additive — if one of them needs a new surface rather
        than a new panel, the frame is wrong.
      </p>
    </Panel>
  );
}
