# Style notes — the three renderings

The same data, drawn three ways. A *style* changes how the channels are drawn, never what they mean.

## `blocks`

Lit solids standing on a plate, lit by two directional lights and a hemisphere fill. Each district is a box
whose footprint is its function count and whose height is its member count, arranged on whichever layout is
selected. It reads as an architectural site model: massing, gaps between buildings, a ground plane for
context. three.js.

## `universe`

The same geometry as glowing beacons — a beam whose length is the member count, a core at its tip sized by
the function count, additive blending, bloom, a starfield and a nebula wash. No plate. It reads as a
population of stars: brightness is attention, and the coupling web looks like filaments between them.
three.js + post-processing (~425 KB gzipped).

## `atlas` — the new one

**Identified from** `withmarbleapp/os-taxonomy` → `media/curriculum-viz.gif` ("Everything a child learns.").
That animation is an **embedding map of 1,000+ curriculum standards**: every standard is a dot, positioned
by similarity, joined to its prerequisites by hairline edges, on a near-black ground.

The style is not "a scatter plot", it is **an editorial plate of a point cloud**:

| Element | What it is |
|---|---|
| ground | near-black with a blue cast (`#060910`–`#0d0f1a`), no gradient, no grid |
| nodes | small, flat, **fully saturated** categorical dots — sampled from the reference: teals `#65dad6` / `#5ef6c5`, greens `#5fe490` / `#42986f`, violets `#543de0` / `#7173da`, blues `#6aa2e3`, reds `#ed3956`, orange `#f0af5d` |
| edges | **hairline** white-ish lines at very low alpha; the mesh is texture, not emphasis |
| selection | one accent — pink/magenta `#d44377` — recolours the selected subset **and its induced edges**, everything else dims toward the ground |
| typography | a large **serif** headline, uppercase letterspaced micro-labels above it, a legend key bottom-left with counts, a floating detail card top-right, interaction hints bottom-right |
| interaction | *hover to preview · click to pin · esc to close* — the reference's own hint line |
| motion | slow drift; the camera settles on a region rather than snapping |

**Why the label `atlas`.** It is a flat, printed map of everything, with a legend, a plate and a caption —
the printed-atlas metaphor matches the editorial typography, and it stays clearly distinct from the other
two: `blocks` is massing in space, `universe` is a glowing population in 3D, `atlas` is a printed plate of
the same field. Rejected: *constellation* and *nebula* (both collide with `universe`), *scatter* (names the
chart, not the look), *map* (too generic inside a code tool).

**Deliberate departures from the reference**, each for a reason:

- **Dot radius is member count (log).** The reference's dots are uniform because its categories are its
  channel. Ours are not: one district holds 15.5% of the graph, and a uniform field would hide it.
- **All 6,524 edges are drawn, brightness = log(weight)** — consistent with the other two styles, where the
  web's brightness *is* coupling strength. The reference has one edge kind; ours has three and a 65,000×
  weight range.
- **Canvas 2D, not WebGL.** The reference is flat, and flatness is the point. It costs a few KB instead of
  three.js's 425 KB, which makes `atlas` the cheap style to ship and the honest baseline for "does 3D earn
  its cost here?".
- **No webfonts** (the dashboard must work offline), so the serif is a system stack: Iowan Old Style /
  Palatino / Georgia.
