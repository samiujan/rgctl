# Maintaining this fork

`main` here is **not** a mirror of upstream. It is upstream `main` plus the dashboard v2 work
(stream B), which is developed in this fork and proposed upstream in pieces.

- **upstream** — `sshaaf/rgctl`. Source of truth for the engine. `upstream/main` is the reference branch.
- **fork `main`** (this branch) — upstream `main` merged with the dashboard work.
- **`upstream/*` branches** — one per upstream-bound change, based on `upstream/main`, never on this branch.
- **`feat/dashboard-v2`** — the accumulation branch. Carries every dashboard change, including ones
  already merged here. Kept because it is where change 0 lived before it was separated out.

Nothing about this arrangement is exotic, but three rules keep it cheap, and breaking any of them
turns routine maintenance into an afternoon.

## Rule 1 — upstream PRs come only from `upstream/*` branches

Never open a pull request to `sshaaf/rgctl` from this branch. A PR's diff is computed against *its base*,
so a PR from `main` would carry all of stream B into the maintainer's repository.

```
git fetch upstream
git checkout -b upstream/my-change upstream/main   # always based on upstream/main
```

Then open the PR from `my-change`. This is how every existing upstream PR was made.

## Rule 2 — never patch an upstream-owned file on `main`

Our merges from upstream stay clean *only* because we have no local edits competing with the version
the maintainer will accept. The moment a file is patched here as well as upstream, every future merge
of that change has two sides to reconcile instead of one to take.

If something in an upstream-owned file needs changing, either change it upstream, or read it through an
adapter in our own code. The Review room's adapter for `.rgctl/workflows/review.json` exists for exactly
this reason: if upstream changes that format, one file here changes.

The files upstream owns that this branch currently modifies. **Re-measured after merging `upstream/main` on
2026-10-17** (`git diff --name-only upstream/main...HEAD`, keeping only paths upstream has): the merge took
#117, #116 and #109, which retired most of the original list — `slice_export.rs` and the gate scripts are
upstream's now, and only the rows below are still ours.

| File | Our edit | Upstream activity (last 60 commits there) |
|---|---|---|
| `src/cli/http_serve.rs` | +251 / −16 | 16 — both sides edit request handling; likeliest real conflict |
| `crates/rgctl-dashboard/src/bundle.rs` | +140 / −16 | 3 — the workflow artifact copy into the bundle |
| `crates/rgctl-dashboard/src/lib.rs` | +114 / −3 | 3 |
| `tests/dashboard_bundle.rs` | +106 / −0 | 3 — purely additive |
| `scripts/build-dashboard.sh` | +83 / −11 | 3 — the v2 bundle and its size gate |
| `crates/rgctl-dashboard/src/manifest.rs` | +74 / −0 | 3 — additive fields |
| `tests/review_paths_integration.rs` | +45 / −0 | 6 |
| `src/cli/review_export.rs` | +38 / −2 | 2 — **the refusal; see below** |
| `dashboard/package.json` | +21 / −1 | 11 |
| `.gitignore` | +11 / −0 | 23 |
| `dashboard/tsconfig.json` | +10 / −3 | 2 |
| `dashboard/vitest.config.ts` | +3 / −0 | 1 |
| `dashboard/package-lock.json` | +2468 / −173 | 10 — **generated, see Rule 3** |

Everything else this branch adds — `dashboard/src/v2`, `dashboard/dist-v2`, the design doc and its
screenshots, `MAINTENANCE.md` — is a **new file**, which can never conflict. (The gate scripts used to be
new files here; #109 merged them, so they are upstream's and no longer on this list.)

One of those edits is a **behaviour change, not a fix-up**, and #117 answered the question by not
answering it: upstream merged the artifact producer with the synthesizing default intact, so
`review_export.rs` here still **refuses** to run without a real head snapshot — the delta-head synthesis it
would otherwise fall back on both overwrote `.rgctl/` in place and produced a "head" that did not contain the
change under review (a one-line deletion reported as additions). That refusal did **not** travel with #117 and
is now the whole content of [#124](https://github.com/sshaaf/rgctl/issues/124), which is why it goes upstream
as its own PR before the Review room's. The reasoning and the measurements are in
`openspec/changes/add-review-workflow-dashboard/tasks.md` §8. `workflow.ts` advertises `--full-snapshots`
because the refusal requires it, so the two must land together.

**What change 4 will add to the first column, and nothing else.** The Architecture room's code is new files
under `dashboard/src/v2`; its only *upstream-owned* edit is a raised budget in `scripts/build-dashboard.sh`
(the three.js re-baseline, with the measurement and the reason beside it), plus whatever
`tests/dashboard_bundle.rs` needs. It stays out of `crates/rgctl-dashboard/` deliberately: that is where a
producer change collides with #124 and #125, and the room needs no producer change at all — the layouts it
draws are derived in the room, and the two producer defects it surfaces are recorded upstream instead of
patched here.

## Rule 3 — never hand-merge `package-lock.json`

It is generated, it is the largest diff here (+2468 lines), and upstream changes it often. Resolve it by
regenerating, not by editing:

```
cd dashboard && npm install    # then commit the regenerated lock
```

## Routine

**Sync upstream into this branch regularly — not in one big merge after months.** Each merge is one
conflict resolution; ten months of drift is one bad afternoon.

```bash
git fetch upstream
git checkout main
git merge upstream/main
./scripts/test-dashboard.sh          # crate tests, both integration gates, both JS suites, offline gate
cargo test --test review_paths_integration
```

Where a change-0 file conflicts because upstream merged a *revised* version of it, **take upstream's
version**. Their accepted contract wins; ours was a proposal. If that changes the artifact's shape, the
Review room's adapter is the one place to update.

**Merge, do not rebase, this branch onto a moving upstream.** A merge records each resolution once; a
rebase replays every conflict on every upstream change — and `src/cli/mod.rs` changed in 60 of upstream's
last 60 commits.

## The surface shrinks by itself

Every change that lands upstream stops being a conflict surface here, because the two sides become
identical. That is why upstream-first ordering is worth the wait:

| Upstream PR | Effect once merged |
|---|---|
| [#109](https://github.com/sshaaf/rgctl/pull/109) gate scripts | `scripts/*` and the harness stop diverging |
| [#117](https://github.com/sshaaf/rgctl/pull/117) review export | the change-0 files stop diverging |

After such a merge, expect it to be clean; if the merged version differs from the branch we took, the
conflicts are confined to that change's files and resolve by taking upstream's side.

### Landed upstream

| Upstream PR | Landed as | Verified |
|---|---|---|
| [#120](https://github.com/sshaaf/rgctl/pull/120) test target | `d363503` (merge of `91dd2d5`) | **Merged.** The merge is **history-only**: `crates/rgctl-dashboard/src/slice_export.rs` is already byte-identical between `main` and `upstream/main` — our `90db49c` carries the same fix — so `git diff upstream/main main -- crates/rgctl-dashboard/src/slice_export.rs` is empty and a trial merge produced no conflict. Merging adds the commit to the history and nothing to the tree. **`upstream/fix-dashboard-test-target` can then be retired**, since upstream now carries the change. |

Check this section after any `git fetch upstream`: `git rev-list --left-right --count main...upstream/main`
tells you how many commits are waiting, and `git diff --stat main...upstream/main` tells you whether the
merge has content or is only history.

## Environment gotchas

These cost real time and are not obvious from the code:

1. **A clean clone does not build.** `Cargo.lock` is gitignored and `ort 2.0.0-rc.14` breaks
   `semantic-onnx` (a default feature): two `E0061`s in `crates/rgctl-analysis/src/semantic_onnx.rs`.
   Upstream issue [#123](https://github.com/sshaaf/rgctl/issues/123). Workaround:
   `cargo update -p ort --precise 2.0.0-rc.13`.
2. **A rebuilt dashboard is silently not served.** `rgctl serve` never extracts a bundle; it serves
   whatever the last `discover` wrote to `.rgctl/dashboard`, and the reuse gate compares only the graph
   fingerprint and bundle version — not the UI. Upstream issue
   [#122](https://github.com/sshaaf/rgctl/issues/122). Workaround: `rm -rf <repo>/.rgctl/dashboard`
   before re-exporting, or copy `dashboard/dist-v2/*` in directly.
   **But that workaround is not sufficient on its own, and it fails silently.** Deleting only
   `.rgctl/dashboard` and re-exporting writes `cfg_index.json` as `available: false, function_count: 0`:
   the CFG stage is skipped as already-computed, while the dashboard exporter needs records produced by
   that stage. Measured on a good bundle (305 functions) — re-export after `rm -rf .rgctl/dashboard`
   alone → **0 functions**; also removing `.rgctl/analysis` so CFG re-runs → **305 functions** again,
   with the review artifact still valid. Verify with `manifest.analysis.cfg_available`; an empty function
   index raises no error and shows up only as absent Focus handoffs ("not in this graph") and empty CFG
   lenses. Prefer `rm -rf <repo>/.rgctl/dashboard <repo>/.rgctl/analysis` before re-exporting.
3. **Cold indexing is not deterministic.** Three cold indexes of the same commit, in the same directory,
   with the same command gave **3598 edges once and 3592 twice** (nodes stable). Any edge count — including
   `rgctl diff` and the review artifact's `call_edges` — therefore carries run-to-run variance of this
   order. The *sign* of a change is reliable; the magnitude is not, so do not read a small `added` count on
   a pure deletion as a bug in the differ without reproducing it. Reproduce with
   `for i in 1 2 3; do rm -rf .rgctl; rgctl discover . --write-json-graph; done` and compare edge sets.
4. **`dashboard/dist-v2` is committed and embedded at compile time**, so the bundle in a binary is from
   whenever `cargo build` last ran. After rebuilding the dashboard: `npm --prefix dashboard run build:v2`
   then `cargo build --bin rgctl`.
5. **v2 is selected by `RGCTL_DASHBOARD_V2=1`** and served behind the single `--with-dashboard` flag.
6. **CI does not run upstream.** `.github/workflows/ci.yml:38` gates the job on a `ci` label that does not
   exist in that repository, so no upstream PR gets an automated check. Run the gates locally before
   pushing.
7. **`openspec/` is gitignored, by upstream's own `.gitignore`** ("OpenSpec change proposals (local
   only — do not commit)"). Change specs do not travel with a PR and do not survive a clean clone. The
   durable record for a change has to live in a tracked document — for the dashboard work, that is
   `docs/design/dashboard-v2.md`.

## If this branch becomes unusable

The dashboard work is not trapped in history:

- `feat/dashboard-v2` — every dashboard commit, including the pre-split layout.
- `feat/dashboard-v2-shell` — change 1 alone, based on `upstream/main` (what an upstream PR would use).
- Pull requests: [fork #4](https://github.com/samiujan/rgctl/pull/4) (change 1, merged here),
  upstream [#117](https://github.com/sshaaf/rgctl/pull/117) (change 0).

Reverting a merge here is a normal operation; nothing in this branch is published to the maintainer
except the `upstream/*` branches.
