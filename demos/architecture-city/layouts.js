/**
 * One place that knows what a layout is, and where a district sits in it.
 *
 * `ring` is what the export gives us — equal radius, ordered by size, and therefore not a floor plan
 * (design.md §8 correction 6). The rest are DERIVED here, and the room would have to say so: presenting
 * our own layout as the export's would be the same class of mistake as the ring.
 */
export const LAYOUTS = ["ring", "clusters", "spiral", "sphere"];

export const LAYOUT_TITLE = {
  ring: "the exported coordinates: one radius for every district, ordered by size",
  clusters: "derived: each community in a blob on a plane, the largest outermost",
  spiral: "derived: a two-arm log spiral with a central bulge",
  sphere: "derived: a globe, each community a cap sized by its member count",
};

/** True for the layouts this viewer invented rather than read from the bundle. */
export const isDerived = (layout) => layout !== "ring";

/**
 * Where a district sits and which way it grows.
 *
 * `pos` is its base on the layout's surface; `normal` is the direction a district extends along, so the
 * globe's beams stand out of its surface instead of all pointing at the sky.
 */
export function anchorOf(d, layout) {
  if (layout === "sphere") {
    const [x, y, z] = d.sphere ?? [0, 430, 0];
    const n = Math.hypot(x, y, z) || 1;
    return { pos: [x, y, z], normal: [x / n, y / n, z / n] };
  }
  const [x, z] = layout === "ring" ? d.ring : layout === "spiral" ? d.spiral : d.cluster;
  return { pos: [x, 0, z], normal: [0, 1, 0] };
}

/**
 * How far off the surface the coupling web is drawn.
 *
 * On a flat layout the web sits just BELOW the solids (the ground is at -1.2), so 6,524 lines never cut
 * through a box — an intersection line moves as the camera turns and reads as flicker. On the globe it
 * sits just outside the surface instead, where the solids are.
 */
export function webOffset(layout) {
  return layout === "sphere" ? 0.5 : -0.9;
}

/** Bounding radius and tallest member, for framing the camera. */
export function extentOf(districts, layout) {
  let radius = 1;
  let maxH = 1;
  for (const d of districts) {
    const { pos } = anchorOf(d, layout);
    radius = Math.max(radius, Math.hypot(pos[0], pos[1], pos[2]));
    maxH = Math.max(maxH, d.height);
  }
  return { radius, maxH };
}
