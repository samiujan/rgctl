/**
 * Universe style: the same real data, drawn as a galaxy.
 *
 * The encodings do not change — only the way they are drawn — because a style that redefines what a
 * channel means is a second dataset wearing the first one's clothes:
 *
 *   position   the derived community spiral (the disc of the galaxy) or the exported ring
 *   height     member count, log — drawn as the LENGTH OF A BEAM, with the district's core at its tip
 *   footprint  function count — the core's radius and the beam's thickness
 *   colour     community hue
 *   coupling   community-pair coupling weight, as glowing filaments; thickness is share of weight
 *
 * Bloom is the one thing that is purely aesthetic, and it is honest about it: it makes bright things
 * bleed, so a big bright core reads as "important" the way it looks. Nothing is sized by it.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { anchorOf, extentOf, isDerived, webOffset, LAYOUT_TITLE } from "./layouts.js";
import { activeLayout, wireControls } from "./controls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const data = await (await fetch("./data.json")).json();
const { districts, incidence, drawn, readout, labels, kinds } = data;

const COUPLE = 0xffb03a;
const ACCENT = 0x59e0ff;

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
const drawnShare = ((data.drawnWeight / data.pairTotal) * 100).toFixed(0);
const intraShare = ((data.intraWeight / data.totalWeight) * 100).toFixed(1);

// --- scene --------------------------------------------------------------------------------------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 1, 60000);
camera.position.set(700, 560, 820);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
el("app").appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, {
  enableDamping: true,
  dampingFactor: 0.07,
  minDistance: 120,
  maxDistance: 5200,
  autoRotate: true,
  autoRotateSpeed: 0.28,
});
controls.target.set(0, 40, 0);

// bloom: makes bright things bleed. Purely aesthetic, and stated as such above.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// Restrained on purpose: additive material plus a strong bloom saturates everything to white, which is
// the one way this style can lie — a blown-out core reads as important whatever its data says.
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.28, 0.55, 0.6);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// --- deep space: a nebula wash and a starfield --------------------------------------------------
function nebulaTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  const radial = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  radial.addColorStop(0, "rgba(90,120,255,0.55)");
  radial.addColorStop(0.35, "rgba(120,70,200,0.28)");
  radial.addColorStop(0.7, "rgba(30,50,120,0.10)");
  radial.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = radial;
  g.fillRect(0, 0, 512, 512);
  return new THREE.CanvasTexture(c);
}
const nebula = new THREE.Sprite(
  new THREE.SpriteMaterial({ map: nebulaTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3 }),
);
nebula.scale.set(5400, 5400, 1);
nebula.position.set(-380, -520, -1100);
scene.add(nebula);

const STAR_N = 5200;
const starPos = new Float32Array(STAR_N * 3);
const starCol = new Float32Array(STAR_N * 3);
const tint = new THREE.Color();
for (let i = 0; i < STAR_N; i++) {
  const r = 1800 + Math.random() * 4200;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = r * Math.cos(phi) * 0.55;
  starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  tint.setHSL(0.55 + Math.random() * 0.12, 0.35 + Math.random() * 0.4, 0.55 + Math.random() * 0.35);
  starCol[i * 3] = tint.r;
  starCol[i * 3 + 1] = tint.g;
  starCol[i * 3 + 2] = tint.b;
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
starGeo.setAttribute("color", new THREE.BufferAttribute(starCol, 3));
const stars = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ size: 5.5, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
);
scene.add(stars);

// --- districts: a beam whose length is the member count, a core at its tip ----------------------
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
const coreGeo = new THREE.SphereGeometry(1, 18, 14);
const haloGeo = new THREE.SphereGeometry(1, 12, 10);

const beams = new THREE.Group();
const cores = new THREE.Group();
const halos = new THREE.Group();
scene.add(beams, cores, halos);

const beamMeshes = [];
const coreMeshes = [];
const haloMeshes = [];
const baseColour = districts.map((d) => new THREE.Color().setHSL(d.hue / 360, 0.85, 0.6));
for (const d of districts) {
  const colour = baseColour[districts.indexOf(d)];

  const beam = new THREE.Mesh(
    beamGeo,
    new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  beams.add(beam);
  beamMeshes.push(beam);

  const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: colour }));
  cores.add(core);
  coreMeshes.push(core);

  const halo = new THREE.Mesh(
    haloGeo,
    new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  halos.add(halo);
  haloMeshes.push(halo);
}

// --- coupling: EVERY edge, always on; emphasis comes from selection -------------------------------
//
// All 6,524 district-to-district edges are drawn, so nothing is hidden and no threshold has to be
// defended. Brightness is log(weight) on an additive blend, so a heavy edge glows and a weight-1 edge
// barely registers — the web's brightness IS coupling strength rather than a decision about which edges
// deserve to be seen. Clicking a core then promotes that district's own edges to fat, bright filaments
// and pushes everything else back.
const coupling = new THREE.Group();
const accents = new THREE.Group();
scene.add(coupling, accents);

let mode = "cluster";
let foot = null;   // per-district footprint multipliers for the layout on screen
const basePos = (d, m) => {
  const { pos } = anchorOf(d, m);
  return new THREE.Vector3(pos[0], pos[1], pos[2]);
};
const normalOf = (d, m) => {
  const { normal } = anchorOf(d, m);
  return new THREE.Vector3(normal[0], normal[1], normal[2]);
};
const coreRadius = (d) => Math.max(2.2, Math.min(11, 2.2 + 0.22 * Math.sqrt(d.functions)));
const corePos = (d, m) => basePos(d, m).addScaledVector(normalOf(d, m), d.height);

const edgeWeights = data.edges.map((e) => e[2]).sort((a, b) => a - b);
const wMin = edgeWeights[0] || 1;
const wMax = edgeWeights[edgeWeights.length - 1] || 1;
const ln = (w) => (Math.log(w) - Math.log(wMin)) / Math.max(1e-6, Math.log(wMax) - Math.log(wMin));

// one LineSegments for the whole web: 6,524 segments in a single draw call
const webGeo = new THREE.BufferGeometry();
const webPos = new Float32Array(data.edges.length * 6);
const webCol = new Float32Array(data.edges.length * 6);
webGeo.setAttribute("position", new THREE.BufferAttribute(webPos, 3));
webGeo.setAttribute("color", new THREE.BufferAttribute(webCol, 3));
const webMat = new THREE.LineBasicMaterial({
  vertexColors: true, transparent: true, opacity: 0.2,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const web = new THREE.LineSegments(webGeo, webMat);
coupling.add(web);

function buildWeb(m) {
  data.edges.forEach(([a, b, w], i) => {
    const A = basePos(districts[a], m).addScaledVector(normalOf(districts[a], m), webOffset(m));
    const B = basePos(districts[b], m).addScaledVector(normalOf(districts[b], m), webOffset(m));
    webPos.set([A.x, A.y, A.z, B.x, B.y, B.z], i * 6);
    // amber, scaled by weight: additive, so the faint ones stay faint
    const v = 0.05 + 0.55 * ln(w);
    webCol.set([1.0 * v, 0.68 * v, 0.3 * v, 1.0 * v, 0.68 * v, 0.3 * v], i * 6);
  });
  webGeo.attributes.position.needsUpdate = true;
  webGeo.attributes.color.needsUpdate = true;
}

function filament(a, b, radius, colour, opacity, lift) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.y += lift;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, 26, radius, 6, false),
    new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
}

const MAX_ACCENT = 260;   // a district can have 1,079 edges; drawn heaviest-first and said so in the panel
let selected = null;
let shownEdges = 0;

function buildAccents(m) {
  accents.clear();
  if (selected == null) {
    shownEdges = 0;
    webMat.opacity = 0.2;
    return;
  }
  const list = incidence[selected] ?? [];
  const from = corePos(districts[selected], m);
  const top = Math.log(data.maxIncident || 1);
  const used = list.slice(0, MAX_ACCENT);
  shownEdges = used.length;
  for (const [j, w] of used) {
    const radius = Math.max(0.8, 0.9 + 4.2 * ln(w));
    accents.add(filament(from, corePos(districts[j], m), radius, ACCENT, 0.72, 16));
  }
  webMat.opacity = 0.055;   // push the whole web back so the selection reads
}

/** Dim every core and beam that is not the selection or one of its partners. */
function focus(m) {
  const near = new Set(selected == null ? [] : (incidence[selected] ?? []).map(([j]) => j));
  if (selected != null) near.add(selected);
  districts.forEach((d, i) => {
    const lit = selected == null || near.has(i);
    coreMeshes[i].material.color.copy(baseColour[i]).multiplyScalar(selected == null ? 1 : lit ? 1.25 : 0.16);
    beamMeshes[i].material.opacity = selected == null ? 0.13 : lit ? 0.2 : 0.03;
    haloMeshes[i].material.opacity = selected == null ? 0.05 : lit ? 0.09 : 0.012;
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

function place(m, animate = false) {
  mode = m;
  foot = data.foot?.[m] ?? null;
  // The globe has no "down": let the camera pass under it.
  controls.maxPolarAngle = m === "sphere" ? Math.PI - 0.02 : Math.PI * 0.495;
  const up = new THREE.Vector3(0, 1, 0);
  districts.forEach((d, i) => {
    const base = basePos(d, m);
    const n = normalOf(d, m);
    const r = coreRadius(d) * (foot ? foot[i] : 1);

    // unit cylinder along local +Y, scaled to the member count, then turned onto the normal, so a
    // globe's beams stand out of its surface instead of all leaning the same way
    beamMeshes[i].quaternion.setFromUnitVectors(up, n);
    beamMeshes[i].position.copy(base).addScaledVector(n, d.height / 2);
    beamMeshes[i].scale.set(r * 0.42, d.height, r * 0.42);

    coreMeshes[i].position.copy(base).addScaledVector(n, d.height);
    coreMeshes[i].scale.setScalar(r);

    haloMeshes[i].position.copy(coreMeshes[i].position);
    haloMeshes[i].scale.setScalar(r * 2.6);
  });
  buildWeb(m);
  buildAccents(m);
  focus(m);
  updateNet(m);
  frame(m);
  if (animate) controls.autoRotate = true;
}

// --- the panel ----------------------------------------------------------------------------------
/** Say when footprints are clamped, because a clamped channel is a changed channel. */
function scaleNote(m) {
  const clamp = data.clampReport?.[m];
  if (!clamp || clamp.bound === 0) return "";
  return (
    ` <b>${clamp.bound}</b> of ${clamp.of} footprints are clamped to their local spacing ` +
    `(tightest x${clamp.tightest.toFixed(2)}) so that no two solids interpenetrate — overlapping solids ` +
    `shimmer as the camera turns. Height is the member count and is never scaled.`
  );
}

function updateNet(m) {
  const derived = isDerived(m);
  el("legend").style.opacity = derived ? "1" : "0.45";
  el("net-why").innerHTML = derived
    ? `All <b>${data.edges.length.toLocaleString()}</b> district-to-district edges are drawn — nothing is ` +
      `hidden and no threshold has to be defended. Brightness is <b>log(weight)</b> on an additive blend, so ` +
      `a heavy edge glows and a weight-1 edge barely registers: the web's brightness <b>is</b> coupling ` +
      `strength. Layout: <b>${LAYOUT_TITLE[m]}</b> — derived here, <b>not</b> the export's. Click a core to ` +
      `promote its own edges and push the rest back. Intra-community coupling is <b>${intraShare}%</b> of the total.` +
      scaleNote(m)
    : `Every edge is drawn — <b>${data.edges.length.toLocaleString()}</b> of them — and that is the point: on ` +
      `the exported ring the web has no shape, because each community's members are scattered right around the ` +
      `circle. Layout: <b>${LAYOUT_TITLE.ring}</b>, so this is what the bundle actually contains. ` +
      `Intra-community coupling is <b>${intraShare}%</b> of the total. Switch to a derived layout to read structure.` +
      scaleNote(m);
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
}

// --- picking ------------------------------------------------------------------------------------
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function renderPick() {
  const pick = el("pick");
  if (selected == null) {
    pick.innerHTML = '<div class="name">Click a core</div><p class="hint">its own filaments light up</p>';
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
    `<div class="name"><span class="swatch" style="background:hsl(${d.hue} 85% 62%)"></span>${d.label || "(unlabelled)"}</div>` +
    `<dl><dt>members</dt><dd>${d.size.toLocaleString()}</dd>` +
    `<dt>functions</dt><dd>${d.functions.toLocaleString()}</dd>` +
    `<dt>classes</dt><dd>${d.classes.toLocaleString()}</dd>` +
    `<dt>community</dt><dd>${labels[d.cid]?.label ?? d.cid}</dd>` +
    `<dt>filaments</dt><dd>${shownEdges < list.length ? `${shownEdges} of ${list.length}` : list.length}</dd>` +
    `<dt>strongest</dt><dd>${(list[0]?.[1] ?? 0).toLocaleString()}</dd></dl>` +
    `<ol class="partners">${partners}</ol>`;
}

// --- hover: name the node, or the two ends of the edge, under the cursor -------------------------
const tip = el("tip");
const hoverRay = new THREE.Raycaster();
hoverRay.params.Line.threshold = 8; // world units; the disc is ~900 across
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

  const nodeHit = hoverRay.intersectObjects(coreMeshes, false)[0];
  if (nodeHit) {
    tip.dataset.kind = "node";
    const d = districts[coreMeshes.indexOf(nodeHit.object)];
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
  const hit = ray.intersectObjects(coreMeshes, false)[0];
  if (!hit) selected = null;
  else {
    const idx = coreMeshes.indexOf(hit.object);
    selected = idx === selected ? null : idx;
  }
  buildAccents(mode);
  renderPick();
  controls.autoRotate = false;
});

const startLayout = wireControls((layout) => place(layout, true));

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth, innerHeight);
});

place(startLayout);
renderPick();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  stars.rotation.y = t * 0.008;
  nebula.rotation.z = t * 0.004;
  controls.update();
  composer.render();
});

window.__scene = { composer, scene, camera, controls, place, selectAt: (i) => { selected = i; buildAccents(mode); renderPick(); } };
