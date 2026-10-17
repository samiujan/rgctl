# Style notes — two renderings, and one dropped

The same data, drawn two ways. A *style* changes how the channels are drawn, never what they mean — which is
why dropping one is cheap: nothing it showed is lost.

## `blocks`

Lit solids standing on a plate, lit by two directional lights and a hemisphere fill. Each district is a box
whose footprint is its function count and whose height is its member count, arranged on whichever layout is
selected. It reads as an architectural site model: massing, gaps between buildings, a ground plane for
context. three.js.

## `universe`

The same geometry as glowing beacons — a beam whose length is the member count, a core at its tip sized by
the function count, additive blending, bloom, a starfield and a nebula wash. No plate. It reads as a
population of stars: brightness is attention, and the coupling web looks like filaments between them.
three.js + post-processing. Measured as vendored here — untree-shaken import-map copy of the whole library —
the three.js closure is **430 KiB gzipped** (core 286.5 + module 130.8 + OrbitControls 8.3 + post-processing
4.3). A bundled build tree-shakes it, so this is an upper bound, not the room's cost.

## Dropped: `atlas`

A third style was built from `withmarbleapp/os-taxonomy` → `media/curriculum-viz.gif` — a 3D embedding of
1,000+ curriculum standards, rebuilt here as matte dots, hairline links, depth fog, editorial typography and
a camera fly-to. It worked, and it was removed because it was not needed: it sat between the other two
without adding an argument either of them made.

Kept from the exercise, because both cost real time and would be rediscovered:

- **Read the motion, not the stills.** Sampled as four frames the reference looks like a flat point field;
  it is 3D. The silhouette reshapes, dots occlude and change apparent size, and the camera flies into the
  cloud. A style identification from stills is a guess wearing a measurement's clothes.
- The `vortex` formation (a 3D funnel, districts wound down a cone biggest-community-first) came out of it
  and is kept: `blocks` and `universe` both render it, and it gives either style a volume to orbit.
