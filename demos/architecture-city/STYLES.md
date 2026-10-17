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
That animation is an **embedding of 1,000+ curriculum standards** — every standard a dot, positioned by
similarity, joined to its prerequisites by hairlines, on a near-black ground.

**Correction to my first reading.** Sampled as four stills, the GIF looks like a flat point field, and that
is how the first version of this style was built — Canvas 2D, no depth. It is **3D**, and the motion is what
settles it:

- the **silhouette reshapes completely** between frames — a rotating volume, not a panned plane;
- dots **change apparent size and occlude** each other — perspective depth;
- the camera **flies into** the cloud (frames 62–104) and a district is pinned while flying;
- the settled formation is a **funnel with the largest communities at the mouth**.

The flat typography is what misled: it is a printed caption on a dimensional object.

| Element | What it is |
|---|---|
| ground | near-black with a blue cast (`#060910`–`#0d0f1a`), no gradient, no grid |
| nodes | small **matte, unlit** dots, fully saturated categorical hues — sampled from the reference: teals `#65dad6` / `#5ef6c5`, greens `#5fe490` / `#42986f`, violets `#543de0` / `#7173da`, blues `#6aa2e3`, reds `#ed3956`, orange `#f0af5d` |
| links | **hairline** lines at low alpha, additive — a faint texture that only thickens where coupling concentrates |
| depth | perspective camera and fog into the ground, so near dots read as near |
| selection | one accent — pink `#d44377` — recolours the pinned district **and its edges**, everything else dims, and the **camera flies to it** |
| typography | a large **serif** headline, uppercase letterspaced micro-labels, a legend key with counts, a floating detail card, the reference's own hint line |
| motion | slow orbital drift; *hover to preview · click to pin · esc to close* |

**Why the label `atlas`.** A map of everything, with a legend, a plate and a caption — the metaphor matches
the editorial typography, and it stays distinct from the other two: `blocks` is massing in space,
`universe` is a glowing population, `atlas` is a dimensional field read through a printed caption. Rejected:
*constellation* and *nebula* (both collide with `universe`), *scatter* (names the chart, not the look),
*map* (too generic inside a code tool).

**Deliberate departures from the reference**, each for a reason:

- **Dot radius is member count (log).** The reference's dots are uniform because its categories are its
  channel. Ours cannot be: one district holds 15.5% of the graph.
- **All 6,524 edges are drawn, brightness = log(weight)** — consistent with the other two styles, where the
  web's brightness *is* coupling strength. The reference has one edge kind; we have three and a 65,000×
  weight range.
- **The formation is ours.** The reference's funnel comes from an embedding; ours is generated, so it is
  labelled as a formation rather than a map. `vortex` exists for this style; the other layouts work too, and
  the flat ones simply look flat when orbited.

**Correction to a claim I made while building it:** with the flat implementation `atlas` cost a few KB and
I described it as the cheap baseline for "does 3D earn its 425 KB?". That was an artefact of the misreading.
`atlas` is three.js like the others, so the question is still open — the honest comparison now is between
three *styles*, not between a cheap and an expensive one.
