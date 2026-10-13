# rgctl dashboard v2 — clickable mock

A working prototype of the v2 IA, built with the stack the decision requires: **React 19 + Radix +
Tailwind**, fed with **real data** from a live `.rgctl/`. Not a wireframe — it runs.

```bash
cd mock                 # this directory
npm ci
npm run dev             # http://localhost:5173
# or
npm run build && npm run preview
```

> The preview server binds to **IPv6 only** (`[::1]`), so use `http://localhost:PORT` — `127.0.0.1`
> will not reach it.

## What it demonstrates

**1. The shell replaces the tab bar.** Instrument bar (coverage · digest · freshness · ⌘K · Focus) is
persistent; Rooms are jobs on the left; Lenses are a control over the current subject, not
destinations. Eight lenses, seven rooms, no wrapping tab strip.

**2. The Focus is one identity-keyed subject, carried across rooms.** Press ⌘K, pick a symbol, then
watch the URL:

```
/understand?lens=cfgpddg&focus=a539dcf9-4bd0-5c7c-85f6-a9e5c6d0c241
```

A **room is a path segment**, a **lens is a search param** — which is the IA's own distinction
(destinations you navigate to vs a control over the current subject) encoded in the URL, so the router
cannot confuse them either.

`validateSearch` is where the Focus key earns its keep. Query params arrive as untrusted strings, so an
unknown room, an unknown lens, or a malformed focus is normalised at the boundary and the app receives a
typed, total value. Verified:

| URL | Result |
|---|---|
| `/understand?lens=cfgpddg&focus=<key>` | Understand room, CFG lens, 127 blocks rendered |
| `/` | redirects to `/repo` |
| `/nonsense?lens=bogus&focus=` | normalised to `/repo` — the URL never claims somewhere the app is not |
| `/architecture?lens=bogus` | stays `/architecture`; only the bogus lens is dropped |

Reload it and you are back in the same room, on the same lens, with the same subject. In Understand,
the "carry this focus to" buttons move the subject into another room without re-selecting it. This is
the mechanism competitors cannot copy, because it requires node identity that survives a rename.

**3. Radix portals work — the thing that failed under Preact.** The ⌘K palette is a Radix
`Dialog.Portal`. Under React it renders into `document.body`, escaped from `#root`:

```json
{ "dialogInBody": true, "portalEscape": true, "dialogParentIsBody": "BODY" }
```

Under `preact/compat`, the identical construct rendered **nothing** and threw
`InvalidCharacterError: "[object Object]" did not match the QName production`.

**4. Honesty is structural, not decorative.** Every lens or room without data says so, names why, and
prints the command that would produce it — instead of rendering an empty box or a confident zero:

- **Security** — "no taint index in this bundle", plus the two limits that matter (intra-procedural
  taint; blast traverses `Calls` edges only)
- **Review** — "no change-set", and the exact `.rgctl/workflows/review.json` contract it consumes
- **Metrics / Blast / Time / Spine lenses** — each states which artifact is missing and the CLI that
  would build it
- **Architecture** — labelled *not Louvain*, with the note that the exported field is still called
  `louvain_community_id`

**5. The compiler-IR view — the "oomph" piece.** The CFG·PDG lens renders a real control-flow graph
for the focused function: up to **127 basic blocks, 187 control-flow edges, 75 dominance frontiers**,
five edge types. Every visual property encodes data:

| Visual | Encodes |
|---|---|
| vertical position | **dominator depth**, walked from the entry block via `idom` — the layout *is* the dominance relation, not a force simulation |
| edge colour | control-flow edge type: `next` · `if_true` · `if_false` · `return` · `exception` |
| amber dot | the block is in a **dominance frontier** — where a φ would be inserted |
| hover | the block's **dominator chain**: what must execute before it (32 blocks light up, 184 edges dim) |
| click | the block's **actual source expressions** |

This is the one to show a maintainer. Dominators and dominance frontiers are compiler-grade IR sitting
in the graph, and the old dashboard's CFG tab rendered blank. Here it renders the analysis itself.

**6. The duplication map.** The Architecture room carries an exact-clone view: **17 groups, ~273
recoverable lines, 18 files**, from BLAKE3 `code_hash` — every match is exact, not similar.

Two encodings, both from real data:

- a **chord diagram** — files on a circle, one chord per group, thickness = lines of code. The thick
  chord between `OrderFormPage` and `SaleFormPage` is 67 LOC duplicated across four separate groups
  between the same two files. That is the whole finding in one shape.
- an **identicon per group**, derived from the group's hash, so a clone group has a stable fingerprint
  that survives re-indexing.

**7. Proof publishes the limits beside the wins.** The speed matrix is real
(`tests/cold_profile_gates.rs`), and directly beneath it is what rgctl does *not* do.

## Real data, and where it comes from

`src/data/graph.json` (259 KB) was extracted from a live `.rgctl/` — real artifacts, paths
anonymized. Nothing is invented:

| Mock field | Source artifact |
|---|---|
| symbols (87) | `cfg_index.json` ⋈ `dataflow_index.json` ⋈ `slice_index.json` on `function_id` |
| communities (38), modularity 0.545 | `communities.json` |
| package layout coordinates | `metagraph.json` (`x`, `y` — precomputed at export, no client force simulation) |
| migration order (18 steps) | `migration_plan.json` |
| field writes | `mutations_index.json` |
| digest, counts, freshness | `manifest.json` |
| **CFG (12 functions), `idom`, dominance frontiers, block statements** | `dashboard/cfg/<function_id>.json` |
| **exact clone groups (17)** | `rgctl -f json clones` |

Rebuild it from another repo by running `rgctl discover . --with-dashboard`, then re-running the
extraction against that `.rgctl/dashboard/`.

## What is deliberately absent

- **CFGs for 12 of the 1,479 functions** that have one, to keep the dataset small. The component says
  so rather than pretending the others are absent.
- **No WASM engine.** This is a UI prototype; it does not mount `rgctl_wasm`. The real v2 shell reuses
  the existing worker unchanged.
- **No per-symbol centrality.** `function_metrics.json` is keyed by columnar node *index* while these
  artifacts are keyed by `function_id`, so there is no honest join available here. The Metrics lens
  says exactly that rather than printing a zero.
- **No 3D.** Where 3D is justified is a separate decision; this mock is deliberately 2D.

## Measured cost of the framework change

Measured with esbuild `--minify` then gzip, which is what a bundler ships:

| Runtime | Minified | Gzipped |
|---|---|---|
| React + react-dom/client | 217 KB | **67 KB** |
| Preact | 10 KB | **4 KB** |

So React costs **~63 KB gzipped more**. For context, the shipping dashboard bundle is **1.7 MB** and
served locally (CodeMirror alone is 146 KB gzipped), so this is ~2% of the bundle — not the deciding
factor. The deciding factor is that Radix's portal primitives are unavailable on Preact, and rooms
need overlays.

That table is the framework alone. End to end, this mock builds to **583 KB / 167 KB gzipped** plus
26 KB / 5 KB of CSS with TanStack Router, Radix and Tailwind in place, against **134 KB gzipped** for
the same rooms with the URL state hand-rolled. Router and primitives together therefore cost about
**+32 KB gzipped** on top of React itself.

## Files

```
src/App.tsx                  shell: Instrument, Rooms, Lens, Focus
src/CommandPalette.tsx       Radix Dialog portal — the proof component
src/lib/router.tsx           route tree, typed search validation, unknown-room redirect
src/lib/view.ts              useView — reads and writes the view state through the router
src/lib/focus.ts             room and lens definitions, and their types
src/lib/data.ts              typed access to the real dataset
src/rooms/Understand.tsx     the Focus + Lens mechanism, with honest gaps
src/rooms/CfgGraph.tsx       compiler-IR view: dominator-depth layout, frontiers, statements
src/rooms/Clones.tsx         duplication map: chord diagram + hash identicons
scripts/cdp.mjs              CDP driver (see the note below — it fixes a real bug)
src/rooms/OtherRooms.tsx     Repo (orientation) · Review · Security · Architecture · Migration · Proof
src/ui/primitives.tsx        Panel, Badge, Stat, Bar, NotInBundle
src/data/graph.json          from a live .rgctl/ — real, paths anonymized
bench/                       the framework-size measurement entries
```
