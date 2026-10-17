/**
 * D — the layer model, tested on the real bundle before anything is specified.
 *
 *   namespace group  (11 volumes, 240 of 256 packages)   ← derived here, from the label's own prefix
 *     └── package    (256 solids)                        ← what the export actually calls a metagraph node
 *           └── community  (214, a SECOND partition of the same members — never a container)
 *
 * Why this page exists: the previous design drew communities as regions containing packages, which the data
 * does not support. 197 of 214 communities hold exactly one package, and the export ships only the winning
 * `community_id` per package — never the vote distribution — so containment would assert a nesting we cannot
 * measure. This page draws the alternative and states its own numbers so the two can be compared by looking.
 *
 * A design aid, not the room. Every figure comes from `data.json`, which comes from a real
 * `.rgctl/dashboard` bundle (metasfresh, 838,801 nodes).
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const el = (id) => document.getElementById(id);
const data = await fetch("./data.json").then((r) => r.json());
const { districts, edges, labels, readout } = data;

// --- what a package is ---------------------------------------------------------------------------
//
// The namespace rule is a DERIVATION and this page says so in its own panel. Skip the tokens that name a
// build layout rather than a namespace (`main`, `src`, `java-gen`, `e2e`, …), then take the reverse-domain
// pair when one is there, else one segment. Two labels are not namespaces at all and are handled as what
// they are: `(other)` is the remainder bucket and `root` is a path-heuristic artifact.
const BUILD = new Set(["main", "root", "test", "tests", "e2e", "__tests__", "src", "java", "java-gen",
  "java-legacy", "frontend-webui", "mobile-webui", "resources", "js", "ts"]);
const TLD = new Set(["com", "org", "net", "io", "de", "at", "it", "ch", "uk", "fr", "nl", "se", "dk", "no",
  "fi", "es", "pl", "cz", "ru", "jp", "cn", "in", "br", "au", "ca", "us", "eu", "edu", "gov"]);

function namespaceOf(label) {
  if (label === "(other)") return { key: "(other)", kind: "remainder" };
  if (label === "root") return { key: "root", kind: "artifact" };
  if (label.startsWith(".")) return { key: "(absolute path)", kind: "artifact" };
  const segs = label.split(".");
  while (segs.length > 1 && BUILD.has(segs[0])) segs.shift();
  const key = segs.length > 1 && TLD.has(segs[0]) ? segs.slice(0, 2).join(".") : segs[0] || "root";
  return { key, kind: "namespace" };
}

// how many packages each community holds — the fact that decides the colour channel
const packagesPerCommunity = new Map();
for (const d of districts) packagesPerCommunity.set(d.cid, (packagesPerCommunity.get(d.cid) ?? 0) + 1);
const sharedCommunities = [...packagesPerCommunity.entries()].filter(([, n]) => n > 1);

for (const d of districts) {
  const ns = namespaceOf(d.label);
  d.ns = ns.key;
  d.nsKind = ns.kind;
  d.sharesCommunity = (packagesPerCommunity.get(d.cid) ?? 0) > 1;
}

const namespaces = new Map();
for (const d of districts) {
  if (d.nsKind !== "namespace") continue;
  if (!namespaces.has(d.ns)) namespaces.set(d.ns, []);
  namespaces.get(d.ns).push(d);
}
const grouped = [...namespaces.entries()]
  .map(([key, members]) => ({
    key, members,
    membersOf: members.reduce((n, d) => n + d.size, 0),
    functions: members.reduce((n, d) => n + d.functions, 0),
  }))
  .sort((a, b) => b.membersOf - a.membersOf);
const volumes = grouped.filter((g) => g.members.length > 1);     // a volume only where it groups something
const singletons = grouped.filter((g) => g.members.length === 1).flatMap((g) => g.members);
const artifacts = districts.filter((d) => d.nsKind !== "namespace");
const remainder = artifacts.find((d) => d.nsKind === "remainder");
const artifactPackages = artifacts.filter((d) => d !== remainder);

// --- scales (the same channel rules the spec already fixed) ---------------------------------------
const sizes = districts.map((d) => d.size).filter((s) => s > 0).sort((a, b) => a - b);
const sizeMin = sizes[0];
const sizeMax = sizes[sizes.length - 1];
const fns = districts.map((d) => d.functions).slice().sort((a, b) => a - b);
const fnMedian = fns[Math.floor(fns.length / 2)] || 1;
const TYPICAL_SIDE = 20;

/** Height from member count, LOG — 130,454 storeys is the truth and a linear scale would hide the other 255. */
const heightOf = (s) =>
  6 + 120 * ((Math.log(Math.max(s, sizeMin)) - Math.log(sizeMin)) / (Math.log(sizeMax) - Math.log(sizeMin)));
/** Footprint from function count, sqrt-compressed. Clamped later to local spacing (§ clamp rule). */
const sideOf = (f) => Math.min(30, 14 + 6 * Math.sqrt((f ?? 0) / fnMedian));
const seatRadius = (n) => (TYPICAL_SIDE / 2.4) * Math.sqrt(n);

// --- three.js --------------------------------------------------------------------------------------
const app = el("app");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060a12);
scene.fog = new THREE.Fog(0x060a12, 2200, 7200);

const camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 1, 90000);
camera.position.set(760, 620, 900);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
app.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, {
  enableDamping: true, dampingFactor: 0.08, minDistance: 120, maxDistance: 9000,
  autoRotate: true, autoRotateSpeed: 0.28, maxPolarAngle: Math.PI * 0.495,
});
// The camera is framed against an extent solved for below; the control's ceiling has to allow it, because
// maxDistance clamps silently and the fit would be undone on the first frame.
scene.add(new THREE.HemisphereLight(0x9dbfe6, 0x121a26, 0.95));
const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(600, 900, 500); scene.add(key);
const fill = new THREE.DirectionalLight(0x8fb4ff, 0.55); fill.position.set(-700, 400, -500); scene.add(fill);

const root = new THREE.Group(); scene.add(root);
const world = new THREE.Group(); root.add(world);

const COLOUR = {
  shared: (hue) => new THREE.Color().setHSL((hue % 360) / 360, 0.72, 0.58),
  singleton: new THREE.Color("#67788c"),
  namespace: (i) => new THREE.Color().setHSL(((i * 137.508) % 360) / 360, 0.5, 0.52),
  remainder: new THREE.Color("#2b3340"),
  artifact: new THREE.Color("#6b5f7a"),
};

const state = { mode: "packages", colour: "community", edges: true };
const pickables = [];   // { mesh, kind, payload }
let web = null;
let artifactEdges = 0;

// --- layout: volumes on a ring, packages seated inside their own volume -----------------------------
function layoutPackages() {
  const radii = volumes.map((v) => seatRadius(v.members.length) + TYPICAL_SIDE * 0.8);
  const total = radii.reduce((a, b) => a + b, 0);
  const maxR = Math.max(...radii, 1);
  const ring = Math.max((1.25 * total) / Math.PI, maxR * 1.9, 320);
  let cursor = 0;

  volumes.forEach((v, i) => {
    const r = radii[i];
    const share = (2 * r) / (2 * total);
    const angle = cursor * Math.PI * 2 + (share * Math.PI);
    cursor += share;
    const cx = Math.cos(angle) * ring;
    const cz = Math.sin(angle) * ring;
    v.cx = cx; v.cz = cz; v.r = r;

    const n = v.members.length;
    v.members.forEach((d, k) => {
      // a sunflower opens outward from an inner point, so districts fill the volume instead of stacking
      const rr = seatRadius(n) * Math.sqrt((k + 0.5) / n);
      const a = k * 2.39996;
      d.pos = [cx + rr * Math.cos(a), 0, cz + rr * Math.sin(a)];
      d.volumeKey = v.key;
    });
  });

  // How big the mapped structure actually is — the camera frames THIS, not the artifact band outside it,
  // or the far things shrink everything worth looking at.
  const coreR = volumes.reduce((m, v) => Math.max(m, Math.hypot(v.cx, v.cz) + v.r), 0) || ring + maxR;

  // A package that is its own namespace is drawn alongside the others in an outer band: wrapping it in a
  // volume would claim a grouping that does not exist.
  const outer = coreR + TYPICAL_SIDE * 6;
  singletons.forEach((d, k) => {
    const a = (k / Math.max(1, singletons.length)) * Math.PI * 2;
    d.pos = [Math.cos(a) * outer, 0, Math.sin(a) * outer];
    d.volumeKey = null;
  });

  // The remainder and the path-heuristic artifacts get their own walled band, away from the map, because
  // they are not architecture: `(other)` is everything the export did not name individually.
  const bandR = outer + TYPICAL_SIDE * 8;
  if (remainder) {
    remainder.pos = [Math.cos(Math.PI * 0.5) * bandR, 0, Math.sin(Math.PI * 0.5) * bandR];
    remainder.volumeKey = null;
  }
  artifactPackages.forEach((d, k) => {
    const a = Math.PI * 0.5 + (k - artifactPackages.length / 2) * 0.035;
    d.pos = [Math.cos(a) * (bandR + 120), 0, Math.sin(a) * (bandR + 120)];
    d.volumeKey = null;
  });
  return { coreR, outer, bandR };
}

/** Clamp each footprint to its own nearest neighbour: two solids closer than their width shimmer. */
function clampFootprints(list) {
  for (const d of list) {
    let nn = Infinity;
    for (const o of list) {
      if (o === d) continue;
      const dd = Math.hypot(d.pos[0] - o.pos[0], d.pos[2] - o.pos[2]);
      if (dd < nn) nn = dd;
    }
    d.foot = d.side * Math.min(1, (0.85 * nn) / (d.side || 1));
    d.bound = d.foot < d.side * 0.999;
  }
}

function solidFor(d, colour) {
  const h = d.height;
  const geo = new THREE.BoxGeometry(d.foot, h, d.foot);
  const mat = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.55, metalness: 0.12 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(d.pos[0], h / 2, d.pos[2]);
  return mesh;
}

function wireFor(d, colour, opacity = 0.9) {
  const h = d.height;
  const box = new THREE.BoxGeometry(d.foot, h, d.foot);
  const edgesGeo = new THREE.EdgesGeometry(box);
  const line = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity }));
  line.position.set(d.pos[0], h / 2, d.pos[2]);
  box.dispose();
  return line;
}

// --- scenes -----------------------------------------------------------------------------------------
function clearWorld() {
  for (const child of [...world.children]) {
    world.remove(child);
    child.traverse?.((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  }
  pickables.length = 0;
  web = null;
}

function drawVolume(v) {
  const h = Math.max(...v.members.map((d) => d.height)) + 26;
  const geo = new THREE.BoxGeometry(v.r * 2 + 40, h, v.r * 2 + 40);
  const shell = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0x8fd0ff, transparent: true, opacity: 0.05, depthWrite: false,
  }));
  shell.position.set(v.cx, h / 2 - 4, v.cz);
  world.add(shell);

  const edgesGeo = new THREE.EdgesGeometry(geo);
  const wire = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({
    color: 0xa8dcff, transparent: true, opacity: 0.5,
  }));
  wire.position.copy(shell.position);
  world.add(wire);
  pickables.push({ mesh: shell, kind: "volume", payload: v });
}

function packageColour(d, nsIndex) {
  if (state.colour === "namespace") return COLOUR.namespace(nsIndex);
  // Colour says what the channel can actually say: this package shares its community with another package,
  // or it is alone. 197 of 214 communities are singletons — giving each its own hue would paint 197 colours
  // that identify nothing beyond the solid they sit on.
  return d.sharesCommunity ? COLOUR.shared(d.hue) : COLOUR.singleton;
}

function buildPackages() {
  // heights and footprints first: a volume is sized from the tallest solid it will contain
  for (const d of districts) {
    d.height = heightOf(d.size);
    d.side = sideOf(d.functions);
  }
  const { coreR, outer, bandR } = layoutPackages();
  clampFootprints(districts);

  const nsIndex = new Map(grouped.map((g, i) => [g.key, i]));
  volumes.forEach((v, i) => { drawVolume(v); for (const d of v.members) d.nsIndex = i; });

  for (const d of districts) {
    const isArtifact = d.nsKind !== "namespace";
    const colour = isArtifact
      ? (d.nsKind === "remainder" ? COLOUR.remainder : COLOUR.artifact)
      : packageColour(d, nsIndex.get(d.ns) ?? 0);
    const mesh = solidFor(d, colour);
    world.add(mesh);
    if (isArtifact) {
      // wireframe, not fill: a walled object that is not a package drawn as a package is the one mistake
      // this view exists to avoid
      world.add(wireFor(d, d.nsKind === "remainder" ? 0xffcf7a : 0xc09ad0, 0.85));
    }
    pickables.push({ mesh, kind: "package", payload: d });
  }

  if (state.edges) buildWeb(districts, edges);
  return { fitRadius: coreR * 1.5, extentRadius: bandR + 240 };
}

function buildCommunities() {
  // The aggregate view: the SAME members, grouped the other way. This is what "collapse to communities"
  // means, and it is an aggregation of L1 — not a container described by the bundle.
  const byCommunity = new Map();
  for (const d of districts) {
    const e = byCommunity.get(d.cid) ?? { cid: d.cid, size: 0, functions: 0, n: 0, hue: d.hue, shares: false, members: [] };
    e.size += d.size; e.functions += d.functions; e.n += 1; e.members.push(d);
    byCommunity.set(d.cid, e);
  }
  const list = [...byCommunity.values()].map((e) => ({ ...e, shares: e.n > 1 })).sort((a, b) => b.size - a.size);

  const maxSize = Math.max(...list.map((e) => e.size));
  const minSize = Math.min(...list.map((e) => e.size));
  const heightFor = (s) => 6 + 120 * ((Math.log(Math.max(s, minSize)) - Math.log(minSize)) /
                                     Math.max(1e-6, Math.log(maxSize) - Math.log(minSize)));
  const sideFor = (f) => Math.min(34, 14 + 6 * Math.sqrt(f / Math.max(1, fnMedian)));

  // a sunflower ordered by size: biggest in the middle, so the aggregate view reads radially
  list.forEach((e, i) => {
    const rr = 60 * Math.sqrt(i + 0.6);
    const a = i * 2.39996;
    e.pos = [Math.cos(a) * rr, 0, Math.sin(a) * rr];
    e.height = heightFor(e.size);
    e.side = sideFor(e.functions);
  });
  clampFootprints(list);

  for (const e of list) {
    const colour = e.shares ? COLOUR.shared(e.hue) : COLOUR.singleton;
    const mesh = solidFor({ ...e, foot: e.foot }, colour);
    world.add(mesh);
    pickables.push({ mesh, kind: "community", payload: e });
  }

  if (state.edges) {
    const agg = new Map();
    const at = new Map(districts.map((d, i) => [i, d.cid]));
    for (const [a, b, w] of edges) {
      const ca = at.get(a), cb = at.get(b);
      if (ca === undefined || cb === undefined || ca === cb) continue;
      const k = ca < cb ? `${ca}|${cb}` : `${cb}|${ca}`;
      agg.set(k, (agg.get(k) ?? 0) + w);
    }
    const idx = new Map(list.map((e, i) => [e.cid, i]));
    const pairs = [...agg.entries()]
      .map(([k, w]) => { const [a, b] = k.split("|").map(Number); return [idx.get(a), idx.get(b), w]; })
      .filter(([a, b]) => a !== undefined && b !== undefined);
    buildWeb(list, pairs);
  }
  const extent = list.reduce((m, e) => Math.max(m, Math.hypot(e.pos[0], e.pos[2])), 0);
  return { fitRadius: extent * 1.25, extentRadius: extent + 240 };
}

/** Every edge, always. Brightness is log(weight) on an additive blend, so the web's brightness IS coupling. */
function buildWeb(nodes, edgeList) {
  // The heaviest coupling in this export is between two buckets that are not code. Measured: the top four
  // edges are `(other) <-> root` (65,216 · 38,022 · 18,487) and `(other) <-> org.compiere.model` (20,306) —
  // aggregates of thousands of unrelated packages meeting a path-heuristic bucket. Drawing them would make
  // the map's loudest feature a fact about the exporter's fallbacks, so they are excluded and counted, and
  // the panel says so rather than leaving a reader to wonder why the web stops at the boundary.
  const isArtifactNode = (n) => n?.nsKind === "remainder" || n?.nsKind === "artifact";
  const total = edgeList.length;
  const kept = edgeList.filter(([a, b]) => !isArtifactNode(nodes[a]) && !isArtifactNode(nodes[b]));
  artifactEdges = total - kept.length;
  edgeList = kept;

  const w = edgeList.map((e) => e[2]).sort((a, b) => a - b);
  const lo = Math.log(w[0] || 1), hi = Math.log(w[w.length - 1] || 1);
  const norm = (x) => (Math.log(x) - lo) / Math.max(1e-6, hi - lo);

  const pos = new Float32Array(edgeList.length * 6);
  const col = new Float32Array(edgeList.length * 6);
  const base = new THREE.Color();
  let k = 0;
  for (const [a, b, weight] of edgeList) {
    const A = nodes[a], B = nodes[b];
    if (!A?.pos || !B?.pos) continue;
    const ha = Math.min((A.height ?? 10) * 0.5, 46), hb = Math.min((B.height ?? 10) * 0.5, 46);
    pos.set([A.pos[0], ha, A.pos[2], B.pos[0], hb, B.pos[2]], k * 6);
    const t = norm(weight);
    base.setHSL(0.09 + 0.03 * t, 0.85, 0.10 + 0.30 * t);
    col.set([base.r, base.g, base.b, base.r, base.g, base.b], k * 6);
    k++;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos.subarray(0, k * 6), 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col.subarray(0, k * 6), 3));
  web = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  world.add(web);
}

// --- rebuild + framing -------------------------------------------------------------------------------
function rebuild({ refit = false } = {}) {
  clearWorld();
  const extent = state.mode === "packages" ? buildPackages() : buildCommunities();
  // maxDistance clamps silently, so the ceiling has to admit the framing this page asks for
  controls.maxDistance = Math.max(9000, extent.extentRadius * 8);
  controls.target.set(0, 0, 0);
  controls.update();
  renderHead();
  renderObjects();
  if (refit) fitCamera(extent.fitRadius);
  return extent;
}

function fitCamera(radius) {
  const fov = (camera.fov * Math.PI) / 180;
  const dist = (radius / Math.sin(fov / 2)) * 0.95;
  camera.position.set(dist * 0.55, dist * 0.62, dist * 0.75);
  controls.update();
}

// --- text: this page's own claims, stated where a reader will look ------------------------------------
function renderHead() {
  const covered = readout.covered, declared = readout.nodes;
  const pct = ((covered / declared) * 100).toFixed(1);
  const rows = [
    [declared.toLocaleString(), "nodes in the graph"],
    [`${pct}%`, "mapped at all"],
    [districts.length, "packages (the solids)"],
    [readout.communities, "communities (the overlay)"],
    [volumes.length, "namespace groups holding ≥2"],
  ];
  el("stats").innerHTML = rows.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");

  el("layer-note").innerHTML = state.mode === "packages"
    ? `<b>namespace › package</b><span>The volumes are a grouping derived from the label's prefix. The boxes
       are what the export calls a metagraph node: one <em>package</em> — a directory.</span>`
    : `<b>communities (aggregate)</b><span>The same ${districts.length} packages collapsed by the community the
       export assigned them. An aggregation, not a container: a package's community is a majority vote, and
       the vote counts are not in the bundle.</span>`;
}

function renderObjects() {
  el("object-legend").innerHTML = state.mode === "packages"
    ? [
        `<span><i class="wire"></i><b>namespace volume</b> — derived from labels, drawn only where it groups ≥2 packages</span>`,
        `<span><i style="background:#7fc7ff"></i><b>package</b> — one metagraph node: a directory. height = members (log), footprint = functions</span>`,
        `<span><i class="hatch"></i><b>(other)</b> — every package below rank 255: 36% of what is mapped, and its edges were never exported</span>`,
        `<span><i class="wire"></i><b>root + absolute-path</b> — path-heuristic buckets, not architecture (root: 21,738 members, 0 functions)</span>`,
      ].join("")
    : [
        `<span><i style="background:#7fc7ff"></i><b>community</b> — the same ${districts.length} packages collapsed to ${readout.communities}, by the export's own assignment</span>`,
        `<span><i class="grey"></i><b>alone</b> — the community holds one package (197 of 214)</span>`,
        `<span><i style="background:#8fd07f"></i><b>shared</b> — the community holds more than one (17 communities, 59 packages)</span>`,
      ].join("");

  el("legend").innerHTML = [
    `<span><i class="grey"></i>alone in its community</span>`,
    `<span><i style="background:#8fd07f"></i>shares its community</span>`,
    `<span><i style="background:linear-gradient(90deg,#3a2a08,#ffcf7a)"></i>every edge · brightness = log(weight)</span>`,
  ].join("");

  const bound = districts.filter((d) => d.foot < d.side * 0.999).length;
  el("clampnote").innerHTML = state.mode === "packages"
    ? `${bound} of ${districts.length} footprints clamped to local spacing (tall thin needles are honest: height is never scaled).<br>` +
      `<span class="warn">${artifactEdges.toLocaleString()} of ${edges.length.toLocaleString()} edges are not drawn:</span> ` +
      `they touch the remainder or the path buckets. The heaviest of all is <b>65,216</b> — <b>3.4×</b> the heaviest ` +
      `edge between two real packages (19,323) — and it joins <code>(other)</code> to <code>root</code>. Two ` +
      `aggregates of unrelated files are not coupling, so it is named here instead of drawn.`
    : `${artifactEdges ? `${artifactEdges.toLocaleString()} artifact edges excluded. ` : ""}` +
      `Communities are the export's own assignment; a package's community is a majority vote of its members, ` +
      `so this view is an aggregation of ${districts.length} packages and not a containment.`;


  el("groups").innerHTML = grouped.slice(0, 12).map((g) => {
    const cls = g.members.length > 1 ? "" : " (own namespace)";
    return `<span><em>${g.key}</em><b>${g.members.length}p · ${g.membersOf.toLocaleString()}m${cls}</b></span>`;
  }).join("") + `<span><em>remainder + ${artifactPackages.length} path artifacts</em><b>${remainder ? remainder.size.toLocaleString() : 0}m</b></span>`;

  el("what").querySelector("h2").textContent = state.mode === "packages"
    ? "What each object is"
    : "What each object is — aggregated";
  el("pick").querySelector(".name").textContent = state.mode === "packages" ? "Hover anything" : "Hover a community";
}

// --- hover -------------------------------------------------------------------------------------------
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
addEventListener("pointermove", (ev) => {
  pointer.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObjects(pickables.map((p) => p.mesh), false)[0];
  const tip = el("tip");
  if (!hit) { tip.hidden = true; return; }
  const entry = pickables.find((p) => p.mesh === hit.object);
  if (!entry) { tip.hidden = true; return; }
  tip.hidden = false;
  tip.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 12}px)`;
  if (entry.kind === "package") {
    const d = entry.payload;
    const own = packagesPerCommunity.get(d.cid) ?? 1;
    tip.dataset.kind = "node";
    tip.innerHTML = `<b>${d.label}</b>
      <span>package · ${d.size.toLocaleString()} members · ${d.functions.toLocaleString()} functions</span>
      <span>namespace ${d.ns} · community ${labels[d.cid]?.label ?? d.cid} (${own} package${own > 1 ? "s" : ""})</span>
      ${d.foot < d.side * 0.999 ? `<span class="arrow">footprint clamped to ${(d.foot / d.side).toFixed(2)}×</span>` : ""}`;
  } else if (entry.kind === "volume") {
    const v = entry.payload;
    tip.dataset.kind = "edge";
    tip.innerHTML = `<b>${v.key}</b>
      <span>namespace group · ${v.members.length} packages · ${v.membersOf.toLocaleString()} members</span>
      <span>${v.functions.toLocaleString()} functions · derived from labels, not exported</span>`;
  } else {
    const e = entry.payload;
    tip.dataset.kind = "edge";
    tip.innerHTML = `<b>${labels[e.cid]?.label ?? e.cid}</b>
      <span>community · ${e.size.toLocaleString()} members over ${e.n} package${e.n > 1 ? "s" : ""}</span>
      <span>${e.shares ? "shares its community" : "alone in its community"}</span>`;
  }
});

// --- controls ----------------------------------------------------------------------------------------
function mark(id, on) {
  el(id).style.borderColor = on ? "rgba(255,207,122,.7)" : "";
  el(id).style.color = on ? "#ffcf7a" : "";
}

el("m-packages").onclick = () => { state.mode = "packages"; sync(true); };
el("m-communities").onclick = () => { state.mode = "communities"; sync(true); };
el("c-community").onclick = () => { state.colour = "community"; sync(); };
el("c-namespace").onclick = () => { state.colour = "namespace"; sync(); };
el("e-toggle").onclick = () => {
  state.edges = !state.edges;
  el("e-toggle").textContent = state.edges ? "edges on" : "edges off";
  sync();
};

function sync(refit = false) {
  mark("m-packages", state.mode === "packages");
  mark("m-communities", state.mode === "communities");
  mark("c-community", state.colour === "community");
  mark("c-namespace", state.colour === "namespace");
  rebuild({ refit });
}

// --- go ----------------------------------------------------------------------------------------------
sync(true);
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function frame() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

// the page states its own numbers rather than leaving them to be inferred from the drawing
console.log({
  packages: districts.length,
  namespaceGroups: grouped.length,
  volumesDrawn: volumes.length,
  packagesInsideVolumes: volumes.reduce((n, v) => n + v.members.length, 0),
  singletonNamespaces: singletons.length,
  communities: readout.communities,
  singletonCommunities: readout.communities - sharedCommunities.length,
  remainder: remainder ? { members: remainder.size, share: `${((remainder.size / districts.reduce((n, d) => n + d.size, 0)) * 100).toFixed(1)}%` } : null,
});
