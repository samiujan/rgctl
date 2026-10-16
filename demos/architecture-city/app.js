/**
 * Blocks style: the same data as the universe page, drawn as lit solids on a plate.
 *
 * Whatever the layout, the encodings do not change:
 *   position   ring (the export's), clusters or spiral (both derived here — see layouts.js)
 *   height     member count, log
 *   footprint  function count, sqrt-compressed
 *   colour     community hue
 *   coupling   EVERY edge, always drawn; brightness is log(weight) on an additive blend, so the web's
 *              brightness IS coupling strength rather than a choice about which edges deserve to be seen.
 *              Clicking a district promotes its own edges and pushes everything else back.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { anchorOf, extentOf, isDerived, webOffset, LAYOUT_TITLE } from "./layouts.js";
import { activeLayout, wireControls } from "./controls.js";

const data = await (await fetch("./data.json")).json();
const { districts, incidence, drawn, readout, labels, kinds } = data;

const ACCENT = new THREE.Color(0x6fe9ff);

// --- HUD -----------------------------------------------------------------------------------------
const el = (id) => document.getElementById(id);
el("stats").innerHTML = [
  [readout.nodes.toLocaleString(), "nodes"],
  [readout.districts, "districts"],
  [readout.communities, "communities"],
  [readout.modularity.toFixed(3), "modularity"],
  [`${readout.coveredPct}%`, "in a community"],
]
  .map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`)
  .join("");

const wOf = drawn.map(([, w]) => w);
const wHi = Math.max(...wOf, 1);
const wLo = Math.min(...wOf, 1);
const norm = (w) => (Math.log(w) - Math.log(wLo)) / Math.max(1e-6, Math.log(wHi) - Math.log(wLo));
const intraShare = ((data.intraWeight / data.totalWeight) * 100).toFixed(1);

// --- scene --------------------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x060a12, 1400, 4200);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 1, 60000);
camera.position.set(520, 430, 630);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
el("app").appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, {
  enableDamping: true,
  dampingFactor: 0.08,
  minDistance: 90,
  maxDistance: 2600,
  maxPolarAngle: Math.PI * 0.49,
  autoRotate: true,
  autoRotateSpeed: 0.4,
});
controls.target.set(0, 40, 0);

scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x141a26, 1.15));
const key = new THREE.DirectionalLight(0xffffff, 1.5);
key.position.set(420, 900, 320);
scene.add(key);
const rim = new THREE.DirectionalLight(0x76b4ff, 0.7);
rim.position.set(-500, 260, -420);
scene.add(rim);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(2400, 96),
  new THREE.MeshStandardMaterial({ color: 0x0e1626, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.2;
scene.add(ground);

const grid = new THREE.PolarGridHelper(2200, 16, 12, 96, 0x2b4a78, 0x1a2c4a);
grid.position.y = -0.6;
grid.material.opacity = 0.45;
grid.material.transparent = true;
scene.add(grid);

// --- districts ----------------------------------------------------------------------------------
let foot = null;   // per-district footprint multipliers for the layout on screen
const box = new THREE.BoxGeometry(1, 1, 1);
const group = new THREE.Group();
scene.add(group);
const baseColour = districts.map((d) => new THREE.Color().setHSL(d.hue / 360, 0.82, 0.56));
const meshes = districts.map((d, i) => {
  const m = new THREE.Mesh(
    box,
    new THREE.MeshStandardMaterial({
      color: baseColour[i].clone(),
      roughness: 0.42,
      metalness: 0.12,
      emissive: new THREE.Color().setHSL(d.hue / 360, 0.9, 0.15),
    }),
  );
  m.scale.set(d.side, d.height, d.side);
  group.add(m);
  return m;
});

// --- coupling: every edge, always on ------------------------------------------------------------
const coupling = new THREE.Group();
const accents = new THREE.Group();
scene.add(coupling, accents);

const basePos = (d, m) => {
  const { pos } = anchorOf(d, m);
  return new THREE.Vector3(pos[0], pos[1], pos[2]);
};
const normalOf = (d, m) => {
  const { normal } = anchorOf(d, m);
  return new THREE.Vector3(normal[0], normal[1], normal[2]);
};
/** A point part-way up a district, used to anchor coupling tubes to the solid rather than its foot. */
const posOf = (d, m) => basePos(d, m).addScaledVector(normalOf(d, m), Math.min(d.height * 0.5, 46));

const edgeW = data.edges.map((e) => e[2]).sort((a, b) => a - b);
const wMin = edgeW[0] || 1;
const wMax = edgeW[edgeW.length - 1] || 1;
const ln = (w) => (Math.log(w) - Math.log(wMin)) / Math.max(1e-6, Math.log(wMax) - Math.log(wMin));

const webGeo = new THREE.BufferGeometry();
const webPos = new Float32Array(data.edges.length * 6);
const webCol = new Float32Array(data.edges.length * 6);
webGeo.setAttribute("position", new THREE.BufferAttribute(webPos, 3));
webGeo.setAttribute("color", new THREE.BufferAttribute(webCol, 3));
const webMat = new THREE.LineBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.22,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const web = new THREE.LineSegments(webGeo, webMat);
coupling.add(web);

function buildWeb(m) {
  data.edges.forEach(([a, b, w], i) => {
    const A = basePos(districts[a], m).addScaledVector(normalOf(districts[a], m), webOffset(m));
    const B = basePos(districts[b], m).addScaledVector(normalOf(districts[b], m), webOffset(m));
    webPos.set([A.x, A.y, A.z, B.x, B.y, B.z], i * 6);
    const v = 0.05 + 0.55 * ln(w);
    webCol.set([1.0 * v, 0.68 * v, 0.3 * v, 1.0 * v, 0.68 * v, 0.3 * v], i * 6);
  });
  webGeo.attributes.position.needsUpdate = true;
  webGeo.attributes.color.needsUpdate = true;
}

function tube(a, b, radius, colour, opacity, lift) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.y += lift;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, 22, radius, 6, false),
    new THREE.MeshStandardMaterial({
      color: colour,
      emissive: colour,
      emissiveIntensity: 0.7,
      roughness: 0.3,
      metalness: 0.1,
      transparent: true,
      opacity,
    }),
  );
}

const MAX_ACCENT = 260; // a district can have 1,079 edges; heaviest first, and the panel says so
let selected = null;
let shownEdges = 0;

function buildAccents(m) {
  accents.clear();
  if (selected == null) {
    shownEdges = 0;
    webMat.opacity = 0.22;
    return;
  }
  const list = incidence[selected] ?? [];
  const from = posOf(districts[selected], m);
  const used = list.slice(0, MAX_ACCENT);
  shownEdges = used.length;
  for (const [j, w] of used) {
    accents.add(tube(from, posOf(districts[j], m), Math.max(0.6, 0.7 + 3.2 * ln(w)), ACCENT, 0.85, 10));
  }
  webMat.opacity = 0.07; // push the whole web back so the selection reads
}

/** Dim every district that is not the selection or one of its partners. */
function focus() {
  const near = new Set(selected == null ? [] : (incidence[selected] ?? []).map(([j]) => j));
  if (selected != null) near.add(selected);
  districts.forEach((_, i) => {
    const lit = selected == null || near.has(i);
    meshes[i].material.color.copy(baseColour[i]).multiplyScalar(selected == null ? 1 : lit ? 1.3 : 0.18);
    meshes[i].material.emissiveIntensity = selected == null ? 1 : lit ? 1.6 : 0.25;
  });
}

function frame(m) {
  const { radius, maxH } = extentOf(districts, m);
  // Solve for the camera distance instead of scaling the radius: the layouts differ 3x in size, and on a
  // big flat disc the NEAR rim is far closer to the camera than the centre, so a radius-based multiple
  // overflows the frame however it is tuned. Bisect on "do all 512 base and tip points project inside
  // the viewport", which is exactly the condition that matters.
  const phi = ((m === "spiral" ? 62 : m === "sphere" ? 20 : 42) * Math.PI) / 180;
  const theta = 0.9;
  const dir = new THREE.Vector3(
    Math.cos(phi) * Math.cos(theta),
    Math.sin(phi),
    Math.cos(phi) * Math.sin(theta),
  );
  const target = new THREE.Vector3(0, maxH * 0.2, 0);

  const pts = [];
  for (const d of districts) {
    const { pos, normal } = anchorOf(d, m);
    const base = new THREE.Vector3(pos[0], pos[1], pos[2]);
    const n = new THREE.Vector3(normal[0], normal[1], normal[2]);
    pts.push(base.clone(), base.clone().addScaledVector(n, d.height));
  }
  const fits = (dist) => {
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const m = camera.projectionMatrix.elements;
    const inv = camera.matrixWorldInverse;
    for (const p of pts) {
      const v = p.clone().applyMatrix4(inv); // camera space: -z is forward
      if (v.z > -1) return false;            // behind the camera, or level with it
      // project by hand rather than via `project()`, because a point BEHIND the camera still yields
      // in-range NDC coordinates after the perspective divide by a negative w
      const nx = (v.x * m[0]) / -v.z;
      const ny = (v.y * m[5]) / -v.z;
      if (Math.abs(nx) > 0.92 || Math.abs(ny) > 0.85) return false;
    }
    return true;
  };
  let lo = radius * 0.5;
  let hi = radius * 12 + maxH * 6;
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  camera.position.copy(target).addScaledVector(dir, hi);
  // The orbit limits must follow: a clamped maxDistance silently pulls the camera back in after the
  // solve, which is what made the enlarged ring overflow its frame.
  if (scene.fog) {
    scene.fog.near = hi * 0.4;
    scene.fog.far = Math.max(hi * 1.8, hi + radius * 3);
  }
  controls.minDistance = Math.max(20, hi * 0.04);
  controls.maxDistance = Math.max(2400, hi * 2.5);
  controls.target.copy(target);
  camera.updateProjectionMatrix();
  controls.update();
}

let mode = "spiral";
function place(m, animate = false) {
  mode = m;
  foot = data.foot?.[m] ?? null;
  const up = new THREE.Vector3(0, 1, 0);
  districts.forEach((d, i) => {
    const n = normalOf(d, m);
    // on the globe a district stands on its surface, so the solid is turned onto the surface normal
    meshes[i].quaternion.setFromUnitVectors(up, n);
    meshes[i].position.copy(basePos(d, m)).addScaledVector(n, d.height / 2);
    const f = foot ? foot[i] : 1;
    meshes[i].scale.set(d.side * f, d.height, d.side * f);
  });
  buildWeb(m);
  buildAccents(m);
  focus();
  updateNet(m);
  frame(m);
  if (animate) controls.autoRotate = true;
}

// --- the panel ----------------------------------------------------------------------------------
function updateNet(m) {
  const derived = isDerived(m);
  el("legend").style.opacity = derived ? "1" : "0.45";
  el("net-why").innerHTML = derived
    ? `All <b>${data.edges.length.toLocaleString()}</b> district-to-district edges are drawn — nothing is ` +
      `hidden and no threshold has to be defended. Brightness is <b>log(weight)</b> on an additive blend, so ` +
      `a heavy edge glows and a weight-1 edge barely registers: the web's brightness <b>is</b> coupling ` +
      `strength. Layout: <b>${LAYOUT_TITLE[m]}</b> — derived here, <b>not</b> the export's. Click a district to ` +
      `promote its own edges and push the rest back. Intra-community coupling is <b>${intraShare}%</b> of the total.`
    : `Every edge is drawn — <b>${data.edges.length.toLocaleString()}</b> of them — and that is the point: on ` +
      `the exported ring the web has no shape, because each community's members are scattered right around the ` +
      `circle. Layout: <b>${LAYOUT_TITLE.ring}</b>, so this is what the bundle actually contains. ` +
      `Intra-community coupling is <b>${intraShare}%</b> of the total. Switch to a derived layout to read structure.`;
  const pairs = drawn
    .slice(0, 6)
    .map(([pairKey, w]) => {
      const [a, b] = pairKey.split("|").map(Number);
      const width = 9 + 96 * norm(w);
      return (
        `<li><span class="bar" style="width:${width.toFixed(0)}px"></span>` +
        `<span class="pair">${labels[a]?.label ?? a} ↔ ${labels[b]?.label ?? b}</span>` +
        `<span class="w">${w.toLocaleString()}</span></li>`
      );
    })
    .join("");
  el("net-top").innerHTML = derived ? pairs : "";
  const clamp = data.clampReport?.[m];
  if (clamp && clamp.bound > 0) {
    el("net-why").innerHTML +=
      ` <b>${clamp.bound}</b> of ${clamp.of} footprints are clamped to their local spacing ` +
      `(tightest x${clamp.tightest.toFixed(2)}) so that no two solids interpenetrate — overlapping solids ` +
      `shimmer as the camera turns. Height is the member count and is never scaled.`;
  }
}

// --- picking ------------------------------------------------------------------------------------
function renderPick() {
  const pick = el("pick");
  if (selected == null) {
    pick.innerHTML = '<div class="name">Click a district</div><p class="hint">its own edges light up</p>';
    return;
  }
  const d = districts[selected];
  const list = incidence[selected] ?? [];
  const partners = list
    .slice(0, 6)
    .map(
      ([j, w, k]) =>
        `<li><span class="pair">${districts[j].label || labels[districts[j].cid]?.label || "(unlabelled)"}</span>` +
        `<span class="w">${w.toLocaleString()} · ${kinds[k]}</span></li>`,
    )
    .join("");
  pick.innerHTML =
    `<div class="name"><span class="swatch" style="background:hsl(${d.hue} 82% 58%)"></span>${d.label || "(unlabelled)"}</div>` +
    `<dl><dt>members</dt><dd>${d.size.toLocaleString()}</dd>` +
    `<dt>functions</dt><dd>${d.functions.toLocaleString()}</dd>` +
    `<dt>classes</dt><dd>${d.classes.toLocaleString()}</dd>` +
    `<dt>community</dt><dd>${labels[d.cid]?.label ?? d.cid}</dd>` +
    `<dt>couples to</dt><dd>${shownEdges < list.length ? `${shownEdges} of ${list.length}` : list.length}</dd>` +
    `<dt>strongest</dt><dd>${(list[0]?.[1] ?? 0).toLocaleString()}</dd></dl>` +
    `<ol class="partners">${partners}</ol>`;
}

const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
// --- hover: name the node, or the two ends of the edge, under the cursor -------------------------
const tip = el("tip");
const hoverRay = new THREE.Raycaster();
hoverRay.params.Line.threshold = 8;
const hoverPt = new THREE.Vector2();
let lastHover = 0;

function showTip(html, ev) {
  tip.innerHTML = html;
  tip.hidden = false;
  const pad = 14;
  tip.style.left = `${Math.min(ev.clientX + pad, innerWidth - tip.offsetWidth - 8)}px`;
  tip.style.top = `${Math.min(ev.clientY + pad, innerHeight - tip.offsetHeight - 8)}px`;
}
const nameOf = (d) => d.label || labels[d.cid]?.label || "(unlabelled)";

renderer.domElement.addEventListener("pointermove", (ev) => {
  if (ev.timeStamp - lastHover < 24) return; // the web is 6,524 segments; do not test it every pixel
  lastHover = ev.timeStamp;
  hoverPt.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  hoverRay.setFromCamera(hoverPt, camera);

  const nodeHit = hoverRay.intersectObjects(meshes, false)[0];
  if (nodeHit) {
    tip.dataset.kind = "node";
    const d = districts[meshes.indexOf(nodeHit.object)];
    showTip(
      `<b>${nameOf(d)}</b><span>${d.size.toLocaleString()} members · ${d.functions.toLocaleString()} functions · ${labels[d.cid]?.label ?? d.cid}</span>`,
      ev,
    );
    return;
  }
  const edgeHit = hoverRay.intersectObject(web, false)[0];
  const edge = edgeHit && edgeHit.index != null ? data.edges[Math.floor(edgeHit.index / 2)] : null;
  if (edge) {
    tip.dataset.kind = "edge";
    showTip(
      `<b>${nameOf(districts[edge[0]])}</b><span class="arrow">↔</span><b>${nameOf(districts[edge[1]])}</b>` +
        `<span>weight ${edge[2].toLocaleString()} · ${kinds[edge[3]]}</span>`,
      ev,
    );
    return;
  }
  tip.hidden = true;
});
renderer.domElement.addEventListener("pointerleave", () => {
  tip.hidden = true;
});

renderer.domElement.addEventListener("pointerdown", (ev) => {
  pointer.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObjects(meshes, false)[0];
  if (!hit) selected = null;
  else {
    const idx = meshes.indexOf(hit.object);
    selected = idx === selected ? null : idx;
  }
  buildAccents(mode);
  focus();
  renderPick();
  controls.autoRotate = false;
});

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- start on the layout the URL asks for -------------------------------------------------------
const startLayout = wireControls((layout) => place(layout, true));
place(startLayout);
renderPick();

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

window.__scene = {
  renderer,
  scene,
  camera,
  controls,
  place,
  selectAt: (i) => {
    selected = i;
    buildAccents(mode);
    focus();
    renderPick();
  },
};
