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

The files upstream owns that this branch currently modifies:

| File | Our edit | Upstream activity (last 60 commits there) |
|---|---|---|
| `dashboard/package-lock.json` | +2468 / −173 | 10 — **generated, see Rule 3** |
| `src/cli/http_serve.rs` | +251 / −16 | 16 — both sides edit request handling; likeliest real conflict |
| `src/cli/mod.rs` | +96 / −0 | 60 — extremely hot, but our edit is purely additive |
| `docs/json-api.md` | +81 / −0 | 44 — additive section; both sides append |
| `tests/review_paths_integration.rs` | +346 / −0 | 1 |
| `crates/rgctl-dashboard/src/bundle.rs` | +140 / −16 | 3 |
| `scripts/build-dashboard.sh` | +83 / −11 | 3 |
| `src/cli/pr_check.rs`, `src/cli/review.rs`, `src/cli/review_export.rs`, `manifest.rs`, `lib.rs`, `slice_export.rs` | small | 1–3 |
| `dashboard/package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `skills/rgctl/references/command-encyclopedia.md` | small | 1–23 |

Everything else this branch adds — `dashboard/src/v2`, `dashboard/dist-v2`, the design doc and its
screenshots, the gate scripts — is a **new file**, which can never conflict.

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
| [#120](https://github.com/sshaaf/rgctl/pull/120) test target | `slice_export.rs` becomes identical — already a no-op |
| [#109](https://github.com/sshaaf/rgctl/pull/109) gate scripts | `scripts/*` and the harness stop diverging |
| [#117](https://github.com/sshaaf/rgctl/pull/117) review export | the change-0 files stop diverging |

After such a merge, expect it to be clean; if the merged version differs from the branch we took, the
conflicts are confined to that change's files and resolve by taking upstream's side.

## Environment gotchas

These cost real time and are not obvious from the code:

1. **A clean clone does not build.** `Cargo.lock` is gitignored and `ort 2.0.0-rc.14` breaks
   `semantic-onnx` (a default feature): two `E0061`s in `crates/rgctl-analysis/src/semantic_onnx.rs`.
   Upstream issue [#123](https://github.com/sshaaf/rgctl/issues/123). Workaround:
   `cargo update -p ort --precise 2.0.0-rc.13`.
2. **A rebuilt dashboard is silently not served.** `rgctl serve` never extracts a bundle; it serves
   whatever the last `discover` wrote to `.rgctl/dashboard`, and the reuse gate compares only the graph
   fingerprint and bundle version — not the UI. Upstream issue
   [#122](https://github.com/sshaaf/rgctl/issues/122). Workaround:
   `rm -rf <repo>/.rgctl/dashboard` before re-exporting, or copy `dashboard/dist-v2/*` in directly.
3. **`dashboard/dist-v2` is committed and embedded at compile time**, so the bundle in a binary is from
   whenever `cargo build` last ran. After rebuilding the dashboard: `npm --prefix dashboard run build:v2`
   then `cargo build --bin rgctl`.
4. **v2 is selected by `RGCTL_DASHBOARD_V2=1`** and served behind the single `--with-dashboard` flag.
5. **CI does not run upstream.** `.github/workflows/ci.yml:38` gates the job on a `ci` label that does not
   exist in that repository, so no upstream PR gets an automated check. Run the gates locally before
   pushing.

## If this branch becomes unusable

The dashboard work is not trapped in history:

- `feat/dashboard-v2` — every dashboard commit, including the pre-split layout.
- `feat/dashboard-v2-shell` — change 1 alone, based on `upstream/main` (what an upstream PR would use).
- Pull requests: [fork #4](https://github.com/samiujan/rgctl/pull/4) (change 1, merged here),
  upstream [#117](https://github.com/sshaaf/rgctl/pull/117) (change 0).

Reverting a merge here is a normal operation; nothing in this branch is published to the maintainer
except the `upstream/*` branches.
