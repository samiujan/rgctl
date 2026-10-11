# rgctl Dashboard v2 — design

**Status:** Proposal — design only, nothing implemented yet
**Goal:** Turn the deterministic code knowledge graph into **decisions you can defend** — locally, in milliseconds, with a receipt for every number.
**OpenSpec (local):** umbrella over `openspec/changes/add-dashboard-v2-shell/` and the room changes listed in [Change sequence](#change-sequence)
**Relationship to v1:** Additive. This document does **not** replace [dashboard-design.md](dashboard-design.md), which remains the living design for the shipping Preact dashboard until v2 reaches parity.

**Non-goals (v2.0):** Replacing the WASM engine or the columnar v2 payload; adding a server or cloud tier; a second graph format; making the graph canvas the primary surface.

---

## Why

The engine underneath the dashboard is substantially stronger than the dashboard that exposes it. rgctl computes interprocedural slices, compiler IR (CFG, dominance frontiers, PDG, reaching definitions), SCC-condensed reachability, temporal diffs, and clone groups — all locally, deterministically, in milliseconds. Little of that reaches a user through the current UI.

v2's job is **not** more graph. It is to convert existing, already-correct engine output into answers a reviewer, a security engineer, or an architect can act on and cite.

### Evidence of the gap

A live audit of the shipping dashboard (indexing a 5,345-node / 11,801-edge TypeScript repo) found:

- All six deep-analysis views (**CFG, Dataflow, Slice, Blast, Taint, Kantra**) render blank on arrival and need manual multi-step selection before showing anything.
- The two views that *do* render on load (Graph, Migration) open to unreadable overlapping node piles.
- The always-visible stat row renders **"Filtered Nodes" with an identical value to "Total Nodes"** (`dashboard/src/App.tsx:98` and `:104` both read `manifest?.graph.node_count`).
- The Metrics columns in the Functions table read `—` for every row on a real repo, and the dashboard does not say why.

Net effect: the dashboard currently demonstrates **none** of the engine's differentiating capabilities. The full defect list, with `file:line` receipts, lives in the tracking issue; the individually-fixable ones ship separately and ahead of v2.

---

## Philosophy

Seven rules. Every design decision below must be traceable to one of them.

1. **Answer first, graph second.** Open on a conclusion and its evidence. The graph is one way to inspect that evidence — never the landing page.
2. **Every number carries a receipt.** Any score, count, or verdict exposes its inputs and the command that produced it. No unexplained integers.
3. **Lenses, not tabs.** CFG, Dataflow, Slice, Blast, Metrics, and Time are *ways of looking at the current subject*, not destinations that reset your context.
4. **One focus, many views.** Selection is ambient and portable, not per-view.
5. **Honest about its own limits.** If taint is intra-procedural, if blast traverses only `Calls`, if a metric is an approximation — say so in the surface where the number appears, not in a footnote.
6. **Show the command.** Every view can emit the CLI equivalent that reproduces it.
7. **Local, instant, private.** No CDN, no telemetry, no cloud tier, no network at runtime.

---

## Information architecture

The v1 tab bar treats lenses as destinations and has grown to **11 top-level tabs** (`dashboard/src/tabIcons.ts:10-22`), which wrap to two rows at 1440px. v2 replaces destinations with the following:

```
INSTRUMENT   (persistent; never a destination of its own)
             coverage ●●●○○  ·  digest  ·  freshness  │  ⌘K omnibox  │  ◆ Focus bar

ORIENTATION  (exactly one)
             Repo — decision-shaped: "where do I start?", never vanity counts

ROOMS        (n; each answers one question end-to-end)
             Review ⭐ · Security ⭐ · Architecture · Migration · Understand · Agent · Proof

LENSES       (shared control, never top-level)
             Spine · Code · CFG·PDG · Dataflow · Slice/Trace · Blast · Metrics · Time
```

**Orientation is not a dashboard.** "Repo" answers *where do I start* by ranking the few things worth attention (unreviewed change surface, risk-weighted findings, drift, coverage caveats) and linking into the room that handles each. It does not print totals.

**Rooms are jobs, not features.** Review = "what changed and what does it touch?" Security = "what is exploitable and what is reachable?" Proof = "why should I believe any of this?"

**Lenses are filters on the current focus.** Switching lens never changes what you are looking at.

---

## The Focus mechanism

The core interaction is a single, portable **Focus**: one `StableNodeKey` — `BLAKE3(path, name, type)` — selected once and carried between rooms.

Because the key is derived from stable identity rather than a database row id, it survives renames, moves, and re-indexing. Consequences:

- Select a symbol in **Review**, carry it to **Security** (findings filtered to what that symbol can reach), then to **Architecture** (its coupling), then to **Time** (its drift).
- The Focus serializes into the URL, so any state is a shareable link: `?focus=<key>&room=security&lens=blast`.
- **This is the differentiator.** Tools whose node identity is positional cannot express it, because their selection does not survive the next commit.

Focus is *ambient*: it constrains rooms, it is never a prerequisite to render one. A room with no Focus must still open on a useful default (rule 1).

---

## Stack

| Concern | Choice | Why |
|---|---|---|
| Routing / state | TanStack Router + Query | Search-param state ⇒ shareable URLs; `Query` cache keyed by `graph_digest`, `staleTime: Infinity` for immutable artifacts |
| Tables | TanStack Table + Virtual | 300k-node lists without DOM blowup |
| Components | shadcn/ui + Tailwind + Radix | Accessible primitives, no runtime CDN |
| Client state | Zustand (`useFocus`, `useReviewView`, `usePlayback`, `useUI`) | Stores **references** (keys/ids), never payloads |
| 3D | three.js + `@react-three/fiber` + instancing | Only where depth is genuine data |

### Migration risk: Preact → React

shadcn/ui assumes React. The current dashboard is Preact (`preact/hooks` throughout, e.g. `dashboard/src/DataflowView.tsx:1`) with sigma.js 3 and graphology.

This is the **largest single risk in v2** and must be resolved before the shell change is accepted. Options:

1. **Migrate the app to React** (`preact/compat` aliasing removed), keep sigma.js/graphology (both framework-agnostic). Cleanest long-term; touches every view.
2. **Stay on Preact**, use Radix primitives directly with Tailwind, and drop shadcn/ui. Avoids the migration; loses shadcn's prebuilt components and ecosystem.
3. **Hybrid** — new rooms in React, embedded via islands. Rejected: two component runtimes in one bundle is a permanent tax.

Recommendation: **(1)** for the v2 app, gated behind the flag so v1 stays intact during migration. Decide in `add-dashboard-v2-shell`; do not start room work before it is settled.

### Where 3D is justified

3D only where depth encodes real data. Approved: Code City (architecture), blast-depth shells, trace-as-call-depth, time-lapse drift. **Not** approved: the package or call graph — those are 2D problems and 3D makes them worse.

---

## Constraints

The bundle is embedded into the binary at compile time via `include_dir` from `dashboard/dist`, and must work with no network.

- **No CDN** — including fonts and icons. Self-host fonts; bundle icons locally. (Icons are currently Bootstrap Icons, already local.)
- **Self-contained** — `.rgctl/dashboard/` opens from `file://` or a plain static server.
- **Bundle size is a gate.** Add a size check to `scripts/build-dashboard.sh` so the embedded-bundle cost is tracked per PR.
- **No new required backend dependencies.** v2 consumes the existing columnar v2 payload and JSON sidecars.

### Two build hazards to fix while adding the size gate

1. **`dashboard/dist` is tracked** (34 files; `.gitignore:34` only ignores the root `/dist`), and `crates/rgctl-dashboard/src/bundle.rs:7` embeds it with `include_dir!("…/dashboard/dist")`. Source changes under `dashboard/src/` therefore have **no effect** on the shipped dashboard until `dist` is rebuilt and committed — which is why `dist` must be regenerated inside any UI PR.
2. **`scripts/build-dashboard.sh:13-19` writes a throwing stub** when `wasm-pack` is missing, and `npm run build` then happily bundles it. A contributor without `wasm-pack` can silently replace the real ~190 KB `rgctl_wasm_bg-*.wasm` with a stub that throws at runtime, and commit the result. The script should fail loudly (or refuse to overwrite an existing real engine) instead.

---

## Additive strategy and compatibility

v2 ships **additively, behind a flag**, and v1 keeps working until parity is proven.

Rationale: the dashboard surface is guarded by **18 test files** in `tests/` — `dashboard_bundle.rs`, `dashboard_gbuilder.rs`, `dashboard_harness.rs`, `dashboard_metasfresh.rs`, `with_dashboard_cli.rs`, and 14 per-language `dashboard_ecommerce_*.rs` — plus the offline-bundle and `include_dir` guarantees. A big-bang rewrite red-lines all of them at once and destroys the ability to bisect.

Rules:

- `--with-dashboard` (v1) keeps working; v2 is opt-in until parity.
- `tests/dashboard_harness.rs` is extended with v2 parity assertions rather than replaced.
- Manifest gains a phase bump and `dashboard_version` on every change (`crates/rgctl-dashboard/src/manifest.rs:54`).

> **Prerequisite (fixed):** every phase PR is supposed to run `./scripts/test-dashboard-golden.sh`
> (`dashboard-design.md:184`, `:251`, `:310`, and `contributor-checklist.md:134`, `:143`).
> That script — and `test-dashboard-metasfresh.sh` — had been accidentally deleted in `4dcc35d`
> ("update README and cleanup"), while four live references to them survived, so the documented
> per-phase gate could not be run at all. Both are restored and modernized to the current
> `RGCTL_*` env vars, `rgctl` binary name, and `--with-cfg --with-security --with-taint` flags.

---

## Change sequence

**One OpenSpec change = one PR unit.** OpenSpec artifacts stay local (`openspec/` is gitignored — see `.gitignore:7-8`); they are cited from design docs the way `clone-detection-design.md` cites `openspec/changes/add-clone-detection/`.

| # | Change ID | Scope | Depends on |
|---|---|---|---|
| — | *(prerequisite)* | Restore the deleted phase-gate scripts; then the audit defect fixes | **done** |
| 0 | `add-review-workflow-export` | CLI/JSON only: `rgctl review export` → `.rgctl/workflows/review.json`. No UI opinions. | — |
| 1 | `add-dashboard-v2-shell` | New app + build pipeline, additive behind a flag, harness parity | 0 |
| 2 | `add-review-workflow-dashboard` | Review Room | 1 |
| 3 | `add-security-workflow-dashboard` | Risk-weighted triage (severity × centrality × reachability) | 1 |
| 4 | `add-architecture-city-view` | 3D Code City + drift | 1 |
| 5 | `add-proof-surface` | Speed matrix, correctness scorecard, determinism, live p95 | 1 |
| 6 | `add-migration-workflow-dashboard` | Restyle/scope existing MigrationView | 1 |
| 7 | `add-interprocedural-trace-export` | Emit `BlastSliceTrace` in the JSON envelope instead of trailing stdout (`src/cli/blast_radius.rs:532`) | — |

**Change 0 leads** because it is pure CLI/JSON: it has no UI opinions to argue about, it is independently useful to agent consumers, and it establishes the `workflows/` contract that the Review Room later renders.

**Change 7** exists because `blast-radius --with-slices` writes its `BlastSliceTrace` with a bare `println!` **after** the JSON envelope has already been emitted (`src/cli/blast_radius.rs:532` calls `emit_output`, then `:538-555` prints the trace) with no `OutputFormat` guard. `-f json` therefore produces valid JSON followed by raw text, so `rgctl … -f json | jq` fails outright:

```
$ rgctl -r <repo> -f json blast-radius getOrgLocalDate --with-slices 2>/dev/null | jq .
…
  Slice 'getOrgLocalDate' (01f5242f-…): lines 24, 171
parse error: Invalid numeric literal
```

The trace must move into the `BlastRadiusResponse` envelope. This is a correctness fix for the JSON contract in [AGENTS.md](../../AGENTS.md), not just a feature — and it is what makes the interprocedural slice data consumable by an agent at all.

---

## Implementation status

_Update on every phase PR._

| Component | Change | Status | Notes |
|-----------|--------|--------|-------|
| This document | — | **done** | Design proposal |
| Phase-gate scripts restore | prereq | **done** | `test-dashboard-golden.sh` + `test-dashboard-metasfresh.sh`, deleted in `4dcc35d` |
| Audit defect fixes — metric display (D4) | prereq | **done** | `—` vs `0`; gating documented in tooltips |
| Audit defect fixes — shell chrome (D5, D7) | prereq | **done** | Duplicate stat card, internal footer metadata |
| Audit defect fixes — empty states (D1, D2, D3) | prereq | **done** | Taint advice, mutation filter, leaked stub text |
| Audit defect fixes — path/naming (D9, D10) | prereq | **done** | Path disambiguation, label propagation naming |
| Audit defect fixes — tab bar (D6) | prereq | **not started** | IA change; belongs with the v2 shell |
| Audit defect fixes — favicon (D8) | prereq | **not started** | Missing icon → 404 per load |
| `dashboard/dist` regen | prereq | **blocked** | Source fixes are not in the embedded bundle until `dist` is rebuilt with `wasm-pack` |
| `rgctl review export` | 0 | **not started** | `.rgctl/workflows/review.json` |
| v2 shell + flag | 1 | **not started** | Blocked on the Preact→React decision |
| Review Room | 2 | **not started** | |
| Security Room | 3 | **not started** | |
| Architecture City | 4 | **not started** | |
| Proof surface | 5 | **not started** | |
| Migration Room restyle | 6 | **not started** | |
| `BlastSliceTrace` export | 7 | **not started** | JSON envelope corruption repro confirmed |

---

## Open questions

1. **Preact → React** (see Migration risk). Blocks change 1. Needs a decision, not more analysis.
2. **`rgctl review` command surface.** Change 0 defines `review export`. Does `review` also gain a `--since` range, or does it always diff against the working tree?
3. **Where does "coverage" come from?** The Instrument bar promises `coverage ●●●○○`. That must be derived from real per-language support tiers ([tier-1-language-support.md](../tier-1-language-support.md)), not asserted.
4. **Proof surface honesty.** Change 5 publishes a speed matrix and correctness scorecard. Publishing only wins would violate rule 5; it must publish the limits too (intra-procedural taint, `Calls`-only blast traversal, approximation regimes).
