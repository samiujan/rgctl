/**
 * Writes data.json for the three.js Architecture preview, from the REAL metasfresh bundle.
 *
 *   node build-data.mjs        # -> data.json
 *
 * Everything the view draws is computed here and nothing is eyeballed:
 *   - position  : the producer's x/y (a constant-radius ring, see design.md §8 correction 6)
 *   - height    : member count, log scale
 *   - footprint : function count, sqrt-compressed
 *   - colour    : community hue, assigned by golden angle over communities ranked by size
 *   - coupling  : the metagraph's own edges, aggregated to community pairs, thresholded by SHARE OF
 *                 COUPLING WEIGHT rather than by rank, so the emphasis is a measurement
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
// Point MF_BUNDLE at any indexed dashboard bundle — the `.rgctl/dashboard` directory of a repository you
// have run `rgctl discover . --with-dashboard --with-cfg` in. The default is this repo's own corpus
// directory, which is gitignored until you have indexed something.
const BUNDLE =
  process.env.MF_BUNDLE ?? join(HERE, "..", "..", "example", "metasfresh-4.9.8b", ".rgctl", "dashboard");
if (!existsSync(join(BUNDLE, "metagraph.json"))) {
  console.error(
    `No metagraph at ${BUNDLE}\n\n` +
      "Index a corpus first, or point MF_BUNDLE at one:\n\n" +
      "  cd <repo> && rgctl discover . --with-dashboard --with-cfg\n" +
      "  MF_BUNDLE=<repo>/.rgctl/dashboard npm run data\n",
  );
  process.exit(1);
}
const COLOURED_N = Number(process.env.COLOURED ?? 64); // communities whose coupling pairs are drawable
const COVER = Number(process.env.COVER ?? 0.8); // draw the strongest pairs until they cover this share

const meta = JSON.parse(readFileSync(join(BUNDLE, "metagraph.json"), "utf8"));
const comms = JSON.parse(readFileSync(join(BUNDLE, "communities.json"), "utf8"));
const byId = new Map(comms.communities.map((c) => [c.id, c]));

const declared = meta.source_node_count ?? 0;
const members = comms.communities.reduce((n, c) => n + (c.member_count ?? 0), 0);
const sizes = meta.nodes.map((n) => n.size ?? 0).filter((s) => s > 0).sort((a, b) => a - b);
const sizeMin = sizes[0];
const sizeMax = sizes[sizes.length - 1];
const fns = meta.nodes.map((n) => n.functions ?? 0).slice().sort((a, b) => a - b);
const fnMedian = fns[Math.floor(fns.length / 2)] || 1;

const ranked = [...comms.communities].sort((a, b) => (b.member_count ?? 0) - (a.member_count ?? 0));

// How many DISTRICTS each community holds. Only 17 of 214 hold more than one, and they hold 59 of the
// 256 — so this is what decides whether a community's districts interpenetrate.
const perCommunity = new Map();
for (const n of meta.nodes) perCommunity.set(n.community_id, (perCommunity.get(n.community_id) ?? 0) + 1);
const hueOf = new Map(ranked.map((c, i) => [c.id, (i * 137.508) % 360]));
const COLOURED = new Set(ranked.slice(0, COLOURED_N).map((c) => c.id));

const KIND = ["calls", "references", "uses"];
const SPAN = 110.8; // measured: x and y both run -55.4 .. 55.4
const R = 300;
const ANGLE = Math.PI * (3 - Math.sqrt(5));

const heightOf = (s) =>
  6 + 120 * ((Math.log(Math.max(s, sizeMin)) - Math.log(sizeMin)) / (Math.log(sizeMax) - Math.log(sizeMin)));
const sideOf = (f) => Math.min(30, 14 + 6 * Math.sqrt((f ?? 0) / fnMedian));

/** A representative footprint, used to size community blobs so their districts actually fit. */
const TYPICAL_SIDE = sideOf(fnMedian);

// --- clustered layout: a spiral of community centres, districts in a local sunflower -------------
const centre = new Map();
// Three placements, because the export's own is a ring and the interesting ones have to be derived.
//
//   ring    the producer's x/y: equal radius, ordered by size. Not a floor plan (design.md §8.6).
//   cluster each community in a blob; the biggest go outside so arcs cross the map.
//   spiral  a log spiral with arms and a central bulge — a galaxy, biggest communities in the core.
//
// The derived two are OURS and the room has to say so; the ring is the export's and is the honest default
// for "what the data actually contains".
const blob = new Map();
const ARMS = 2;
const BULGE = 10;
const SPIRAL_B = 0.26;      // tuned so an arm runs from r=55 to about r=640 over three turns
const SPIRAL_TURNS = 3.0;

ranked.forEach((c, i) => {
  const memberCount = c.member_count ?? 1;
  // small on purpose: blobs as wide as the arm spacing smear the arms into a disc (the first
  // attempt did exactly that, at radius 52 against an arm gap of ~40 near the middle)
  // Fit the districts that share the community. A sunflower of n points in radius R has nearest-neighbour
  // distance about 2.7R/sqrt(n), so R ~ side*sqrt(n)/2.7 is the size at which they stop interpenetrating.
  // Member counts are the wrong basis: they count nodes, not districts.
  const nLocal = perCommunity.get(c.id) ?? 1;
  blob.set(c.id, Math.min(240, Math.max(10, (TYPICAL_SIDE / 2.4) * Math.sqrt(nLocal))));
  if (i < BULGE) {
    const rad = 22 + 34 * Math.sqrt(i);
    const a = i * 2.39996;
    centre.set(c.id, [rad * Math.cos(a), rad * Math.sin(a)]);
    return;
  }
  const k = i - BULGE;
  const perArm = Math.ceil((ranked.length - BULGE) / ARMS);
  const arm = k % ARMS;
  const along = Math.floor(k / ARMS) / perArm;          // 0..1 outwards along the arm
  const theta0 = (arm / ARMS) * Math.PI * 2;
  const theta = theta0 + along * Math.PI * SPIRAL_TURNS;
  const r = 70 * Math.exp(SPIRAL_B * (theta - theta0));
  centre.set(c.id, [r * Math.cos(theta), r * Math.sin(theta)]);
});

// the cluster layout keeps its own spread, so the two derived layouts can differ
const clusterCentre = new Map();
ranked.forEach((c, i) => {
  const out = ranked.length - i;
  const rad = 40 * Math.sqrt(out + 0.4);
  clusterCentre.set(c.id, [rad * Math.cos(i * ANGLE), rad * Math.sin(i * ANGLE)]);
});

const seats = new Map();
const districts = meta.nodes.map((n, index) => {
  const cid = n.community_id;
  const k = seats.get(cid) ?? 0;
  seats.set(cid, k + 1);
  const memberCount = byId.get(cid)?.member_count ?? 1;
  const localR = blob.get(cid) ?? 4;
  const r = localR * Math.sqrt((k + 0.5) / Math.max(1, perCommunity.get(cid) ?? 1));
  const a = k * ANGLE;
  const [sx, sy] = centre.get(cid) ?? [0, 0];
  const [kx, ky] = clusterCentre.get(cid) ?? [0, 0];
  return {
    i: n.id ?? index,
    label: n.label ?? "",
    size: n.size ?? 0,
    functions: n.functions ?? 0,
    classes: n.classes ?? 0,
    cid,
    hue: hueOf.get(cid) ?? 200,
    height: heightOf(n.size ?? sizeMin),
    side: sideOf(n.functions),
    ring: [((n.x ?? 0) / (SPAN / 2)) * R, ((n.y ?? 0) / (SPAN / 2)) * R],
    cluster: [kx + r * Math.cos(a), ky + r * Math.sin(a)],
    spiral: [sx + r * Math.cos(a), sy + r * Math.sin(a)],
  };
});

// sphere: a globe. Each community gets its own cap, sized by its member count, and its districts fill
// that cap.
//
// The first attempt laid districts on a Fibonacci sphere in community order and hoped contiguous runs
// would form patches. They do not: consecutive Fibonacci points are deliberately far apart, so the caps
// came out 28 degrees wide on average — interleaved, not grouped. Centres first, then caps.
{
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const R_SPHERE = 430;
  const K = ranked.length || 1;

  // community centres, equal-area on the sphere
  const centres = new Map();
  ranked.forEach((c, k) => {
    const y = 1 - (2 * (k + 0.5)) / K;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = k * GOLDEN;
    centres.set(c.id, [r * Math.cos(th), y, r * Math.sin(th)]);
  });

  // cap angular radius from the community's share of members: area fraction (1-cos a)/2
  const totalMembers = ranked.reduce((n, c) => n + (c.member_count ?? 0), 0) || 1;
  const capOf = new Map();
  for (const c of ranked) {
    const share = (c.member_count ?? 0) / totalMembers;
    const byMembers = Math.acos(Math.max(-1, Math.min(1, 1 - 2 * share)));
    // ...but a community can hold many districts and few nodes, so fit the districts as well
    const nLocal = perCommunity.get(c.id) ?? 1;
    const arcNeeded = (TYPICAL_SIDE * Math.sqrt(nLocal)) / 2.4;
    const byDistricts = arcNeeded / R_SPHERE;
    capOf.set(c.id, Math.min((48 * Math.PI) / 180, Math.max(byMembers, byDistricts)));
  }

  const basisOf = (u) => {
    const helper = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const e1 = [
      u[1] * helper[2] - u[2] * helper[1],
      u[2] * helper[0] - u[0] * helper[2],
      u[0] * helper[1] - u[1] * helper[0],
    ];
    const n1 = Math.hypot(e1[0], e1[1], e1[2]) || 1;
    e1[0] /= n1; e1[1] /= n1; e1[2] /= n1;
    const e2 = [
      u[1] * e1[2] - u[2] * e1[1],
      u[2] * e1[0] - u[0] * e1[2],
      u[0] * e1[1] - u[1] * e1[0],
    ];
    return [e1, e2];
  };

  const seat = new Map();
  districts.forEach((d) => {
    const u = centres.get(d.cid) ?? [0, 1, 0];
    const n = (perCommunity.get(d.cid) ?? 1) || 1;
    const j = seat.get(d.cid) ?? 0;
    seat.set(d.cid, j + 1);
    const cap = capOf.get(d.cid) ?? 0.05;
    // even by area inside the cap
    const alpha = cap * Math.sqrt((j + 0.5) / n);
    const phi = j * GOLDEN;
    const [e1, e2] = basisOf(u);
    const p = [
      Math.cos(alpha) * u[0] + Math.sin(alpha) * (Math.cos(phi) * e1[0] + Math.sin(phi) * e2[0]),
      Math.cos(alpha) * u[1] + Math.sin(alpha) * (Math.cos(phi) * e1[1] + Math.sin(phi) * e2[1]),
      Math.cos(alpha) * u[2] + Math.sin(alpha) * (Math.cos(phi) * e1[2] + Math.sin(phi) * e2[2]),
    ];
    d.sphere = [p[0] * R_SPHERE, p[1] * R_SPHERE, p[2] * R_SPHERE];
  });
}

// Layouts have to have room for the solids they hold.
//
// Measured: on a 300-unit ring, 256 districts sit 7.4 units apart while the median footprint is 20 — a
// 2.7x interpenetration whose coincident faces shimmer as the camera turns. Shrinking the footprints
// would distort the channel (footprint is function count), so the LAYOUT is scaled instead. A uniform
// scale stretches every distance including those inside a blob, so one factor per layout is enough.
const spacing = {};
const layoutScale = {};
const footScale = {};
{
  const dataKey = { ring: "ring", clusters: "cluster", spiral: "spiral", sphere: "sphere" };
  const pointsOf = (key) =>
    districts.map((d) => {
      const p = d[key] ?? [0, 0];
      return p.length === 3 ? p : [p[0], 0, p[1]];
    });
  const medianNN = (pts) => {
    const nn = pts.map((a, i) => {
      let best = Infinity;
      for (let j = 0; j < pts.length; j++) {
        if (i === j) continue;
        const dd = Math.hypot(a[0] - pts[j][0], a[1] - pts[j][1], a[2] - pts[j][2]);
        if (dd < best) best = dd;
      }
      return best;
    });
    nn.sort((a, b) => a - b);
    return nn[Math.floor(nn.length / 2)] || 0;
  };

  // Target the LARGEST footprint, not the median: on the ring the spacing is uniform, so covering the
  // biggest district leaves every neighbour clear rather than only most of them.
  const maxSide = Math.max(...districts.map((d) => d.side));
  const target = maxSide / 0.9;

  for (const [name, key] of Object.entries(dataKey)) {
    const before = medianNN(pointsOf(key));
    const k = Math.min(8, Math.max(1, target / (before || 1)));
    if (k > 1.001) {
      for (const d of districts) {
        const p = d[key];
        for (let i = 0; i < p.length; i++) p[i] *= k;
      }
    }
    layoutScale[name] = Number(k.toFixed(3));
    spacing[name] = Number(medianNN(pointsOf(key)).toFixed(2));
    footScale[name] = 1; // nothing left to shrink; kept so the views can still honour it if a corpus needs it
  }
}

// Guarantee that no solid interpenetrates its neighbour, whatever the layout does.
//
// The layout scaling above gives each layout room on average, but a community's districts can still land
// close together (a sunflower's innermost points are the tightest), and an intersection line between two
// solids moves as the camera turns and reads as flicker. So each district's footprint is clamped to its
// OWN nearest-neighbour distance: side * foot <= 0.85 * nn, which makes overlap impossible by
// construction. The clamp binds only where the layout is tight, and how many districts it binds is
// reported rather than hidden — a clamped channel is a changed channel.
const foot = {};
const clampReport = {};
for (const [name, key] of Object.entries({ ring: "ring", clusters: "cluster", spiral: "spiral", sphere: "sphere" })) {
  const pts = districts.map((d) => {
    const p = d[key] ?? [0, 0];
    return p.length === 3 ? p : [p[0], 0, p[1]];
  });
  const mult = [];
  let bound = 0;
  for (let i = 0; i < pts.length; i++) {
    let nn = Infinity;
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      const dd = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1], pts[i][2] - pts[j][2]);
      if (dd < nn) nn = dd;
    }
    const want = districts[i].side;
    const fit = (0.85 * nn) / (want || 1);
    const m = Number(Math.min(1, fit).toFixed(3));
    if (m < 0.999) bound++;
    mult.push(m);
  }
  foot[name] = mult;
  clampReport[name] = { bound, of: pts.length, tightest: Number(Math.min(...mult).toFixed(3)) };
}

const at = new Map(districts.map((d, i) => [d.i, i]));
const edges = meta.edges
  .filter((e) => at.has(e.source) && at.has(e.target))
  .map((e) => [at.get(e.source), at.get(e.target), e.weight ?? 1, Math.max(0, KIND.indexOf(e.kind ?? "uses"))]);

const totalWeight = edges.reduce((n, e) => n + e[2], 0);
const intraWeight = edges.filter((e) => districts[e[0]].cid === districts[e[1]].cid).reduce((n, e) => n + e[2], 0);

// Inter-community coupling, aggregated to pairs. Only pairs between the largest COLOURED communities are
// drawn: measured, K=64 yields 301 pairs of which the strongest 21 carry 80% of that coupling, which is a
// network one can read. K=14 leaves just 34 pairs, of which 3 carry 88% — too sparse to be a picture.
const pairWeight = new Map();
for (const [a, b, w] of edges) {
  const ca = districts[a].cid;
  const cb = districts[b].cid;
  if (ca === cb) continue;
  if (!COLOURED.has(ca) || !COLOURED.has(cb)) continue;
  const key = ca < cb ? `${ca}|${cb}` : `${cb}|${ca}`;
  pairWeight.set(key, (pairWeight.get(key) ?? 0) + w);
}
const pairsDesc = [...pairWeight.entries()].sort((x, y) => y[1] - x[1]);
const pairTotal = pairsDesc.reduce((n, [, w]) => n + w, 0);
const drawn = [];
let acc = 0;
for (const entry of pairsDesc) {
  drawn.push(entry);
  acc += entry[1];
  if (acc / pairTotal >= COVER) break;
}

// per-district coupling, for the selection view
const incidence = districts.map(() => []);
for (const [a, b, w, k] of edges) {
  incidence[a].push([b, w, k]);
  incidence[b].push([a, w, k]);
}
for (const list of incidence) list.sort((x, y) => y[1] - x[1]);

const data = {
  readout: {
    nodes: declared,
    districts: meta.nodes.length,
    communities: comms.communities.length,
    modularity: Number((comms.modularity ?? 0).toFixed(3)),
    covered: members,
    coveredPct: Math.round((members / declared) * 100),
    median: sizes[Math.floor(sizes.length / 2)],
    biggest: ranked[0]?.label ?? "?",
    biggestSize: sizeMax,
    biggestShare: Number(((sizeMax / declared) * 100).toFixed(1)),
    skew: Math.round(sizeMax / sizes[Math.floor(sizes.length / 2)]),
    coloured: COLOURED_N,
    cover: COVER,
  },
  kinds: KIND,
  spacing,
  layoutScale,
  footScale,
  foot,
  clampReport,
  labels: Object.fromEntries(comms.communities.map((c) => [c.id, { label: c.label ?? String(c.id), members: c.member_count ?? 0 }])),
  districts,
  edges,
  incidence,
  drawn,
  pairCount: pairsDesc.length,
  pairTotal,
  drawnWeight: acc,
  intraWeight,
  totalWeight,
  maxIncident: Math.max(1, ...incidence.map((l) => (l[0] ? l[0][1] : 1))),
};

writeFileSync(join(HERE, "data.json"), JSON.stringify(data));
console.log(`footprint clamped to local spacing: ${JSON.stringify(clampReport)}`);
console.log(
  `data.json: ${districts.length} districts, ${edges.length} edges, ` +
    `${drawn.length}/${pairsDesc.length} pairs drawn covering ${((acc / pairTotal) * 100).toFixed(0)}%`,
);
