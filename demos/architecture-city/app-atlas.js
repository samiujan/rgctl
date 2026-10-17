/**
 * atlas — a 3D constellation with editorial typography.
 *
 * Identified from `withmarbleapp/os-taxonomy` → `media/curriculum-viz.gif`. The first reading of it was
 * wrong: four sampled stills look like a flat point field, but the motion settles it — the silhouette
 * reshapes completely between frames, dots change apparent size and occlude, and the camera flies *into*
 * the cloud. It is a 3D embedding point cloud, not a plate. The typography around it is flat, which is
 * what misled: a printed caption on a dimensional object.
 *
 * So: small matte unlit dots, hairline links, perspective, depth fading into the ground, and a camera that
 * flies to a pinned district. The reference's own interaction line is the spec —
 * *hover to preview · click to pin · esc to close*.
 *
 * Channels, unchanged from the other two styles:
 *   position  the selected formation (`vortex` is the 3D funnel the reference uses)
 *   radius    member count, log
 *   colour    community hue
 *   links     every edge, brightness = log(weight); one pink accent for a pinned district's edges
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { anchorOf, extentOf, LAYOUT_TITLE, isDerived } from "./layouts.js";
import { activeLayout, wireControls } from "./controls.js";

const data = await (await fetch("./data.json")).json();
const { districts, incidence, readout, labels, kinds } = data;

const GROUND = 0x07090f;
const PINK = new THREE.Color(0xd44377);
const HAIR = new THREE.Color(0xdde6f5);

const el = (id) => document.getElementById(id);
const nameOf = (d) => d.label || labels[d.cid]?.label || "(unlabelled)";
const sizeMax = Math.max(...districts.map((d) => d.size), 1);
const radiusOf = (d) => 1.7 + 3.4 * (Math.log(Math.max(d.size, 1)) / Math.log(sizeMax));

const weights = data.edges.map((e) => e[2]).sort((a, b) => a - b);
const wMin = weights[0] || 1;
const wMax = weights[weights.length - 1] || 1;
const ln = (w) => (Math.log(w) - Math.log(wMin)) / Math.max(1e-6, Math.log(wMax) - Math.log(wMin));

let layout = activeLayout();
let pinned = null;
let hovered = null;
let flying = null;

// --- scene ---------------------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(GROUND, 500, 2200);

const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 1, 40000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setClearColor(GROUND, 1);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
el("app").appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, {
  enableDamping: true,
  dampingFactor: 0.07,
  autoRotate: true,
  autoRotateSpeed: 0.22,
  minDistance: 40,
  maxPolarAngle: Math.PI - 0.02, // a 3D field has no floor: orbit right under it
});
controls.target.set(0, 0, 0);

// --- nodes: matte, unlit, small ----------------------------------------------------------------
const nodes = new THREE.InstancedMesh(
  new THREE.SphereGeometry(1, 10, 8),
  new THREE.MeshBasicMaterial({ toneMapped: false }),
  districts.length,
);
nodes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(nodes);

const dummy = new THREE.Object3D();
const baseColour = districts.map((d) => new THREE.Color().setHSL(d.hue / 360, 0.92, 0.62));
const WHITE = new THREE.Color(0xffffff);

function paintNodes() {
  const near = new Set();
  if (pinned != null) {
    near.add(pinned);
    for (const [j] of incidence[pinned] ?? []) near.add(j);
  }
  districts.forEach((d, i) => {
    const lit = pinned == null || near.has(i);
    const c = lit ? baseColour[i] : baseColour[i].clone().multiplyScalar(0.22);
    nodes.setColorAt(i, i === hovered ? WHITE : c);
  });
  if (nodes.instanceColor) nodes.instanceColor.needsUpdate = true;
}

// --- edges: hairlines whose brightness is the weight -------------------------------------------
const edgeGeo = new THREE.BufferGeometry();
const edgePos = new Float32Array(data.edges.length * 6);
const edgeCol = new Float32Array(data.edges.length * 6);
edgeGeo.setAttribute("position", new THREE.BufferAttribute(edgePos, 3));
edgeGeo.setAttribute("color", new THREE.BufferAttribute(edgeCol, 3));
const edgesMat = new THREE.LineBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.6,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const edges = new THREE.LineSegments(edgeGeo, edgesMat);
scene.add(edges);

function paintEdges() {
  data.edges.forEach(([a, b, w], i) => {
    const hot = pinned != null && (a === pinned || b === pinned);
    if (hot) {
      edgeCol.set([PINK.r, PINK.g, PINK.b, PINK.r, PINK.g, PINK.b], i * 6);
      return;
    }
    // 6,524 additive lines accumulate fast: at 0.05+0.5*ln the mesh summed to a white mass, where the
    // reference's is a faint texture that only thickens where coupling concentrates.
    const v = (0.015 + 0.19 * ln(w)) * (pinned == null ? 1 : 0.18);
    edgeCol.set([HAIR.r * v, HAIR.g * v, HAIR.b * v, HAIR.r * v, HAIR.g * v, HAIR.b * v], i * 6);
  });
  edgeGeo.attributes.color.needsUpdate = true;
}

// --- place the formation -----------------------------------------------------------------------
function place(m) {
  const { radius, maxH } = extentOf(districts, m);

  districts.forEach((d, i) => {
    const { pos } = anchorOf(d, m);
    dummy.position.set(pos[0], pos[1], pos[2]);
    dummy.scale.setScalar(radiusOf(d));
    dummy.updateMatrix();
    nodes.setMatrixAt(i, dummy.matrix);
  });
  nodes.instanceMatrix.needsUpdate = true;

  data.edges.forEach(([a, b], i) => {
    const pa = anchorOf(districts[a], m).pos;
    const pb = anchorOf(districts[b], m).pos;
    edgePos.set([pa[0], pa[1], pa[2], pb[0], pb[1], pb[2]], i * 6);
  });
  edgeGeo.attributes.position.needsUpdate = true;
  edgeGeo.computeBoundingSphere();
  nodes.computeBoundingSphere();   // InstancedMesh's own, from the instance matrices

  paintEdges();
  paintNodes();
  fit(radius, maxH, m);
}

/** Camera fit, solved as in the other styles: the smallest distance that frames every node. */
function fit(radius, maxH, m) {
  const phi = m === "sphere" || m === "vortex" ? 0.30 : 0.66;
  const dir = new THREE.Vector3(
    Math.cos(phi) * Math.cos(0.8),
    Math.sin(phi),
    Math.cos(phi) * Math.sin(0.8),
  ).normalize();

  const pts = districts.map((d) => {
    const { pos } = anchorOf(d, m);
    return new THREE.Vector3(pos[0], pos[1], pos[2]);
  });
  const fits = (dist) => {
    camera.position.copy(dir).multiplyScalar(dist);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const mm = camera.projectionMatrix.elements;
    const inv = camera.matrixWorldInverse;
    for (const p of pts) {
      const v = p.clone().applyMatrix4(inv);
      if (v.z > -1) return false;
      if (Math.abs((v.x * mm[0]) / -v.z) > 0.9) return false;
      if (Math.abs((v.y * mm[5]) / -v.z) > 0.86) return false;
    }
    return true;
  };
  let lo = radius * 0.5;
  let hi = radius * 12 + maxH * 4;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  camera.position.copy(dir).multiplyScalar(hi);
  controls.minDistance = Math.max(20, hi * 0.05);
  controls.maxDistance = Math.max(2000, hi * 2.5);
  controls.target.set(0, 0, 0);
  controls.update();
  // depth fading into the ground is what separates the near dots from the far ones
  scene.fog.near = hi * 0.45;
  scene.fog.far = hi * 2.1;
}

// --- HUD -----------------------------------------------------------------------------------------
el("stats").innerHTML = [
  [readout.nodes.toLocaleString(), "nodes"],
  [readout.districts, "districts"],
  [readout.communities, "communities"],
  [readout.modularity.toFixed(3), "modularity"],
  [`${readout.coveredPct}%`, "in a community"],
]
  .map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`)
  .join("");

function renderLegend() {
  const ranked = Object.entries(labels)
    .sort((a, b) => (b[1].members ?? 0) - (a[1].members ?? 0))
    .slice(0, 9);
  const hues = new Map(districts.map((d) => [d.cid, d.hue]));
  el("legend").innerHTML =
    `<h2>communities</h2><ul>` +
    ranked
      .map(
        ([cid, l]) =>
          `<li><i style="background:hsl(${(hues.get(Number(cid)) ?? 200).toFixed(0)} 92% 62%)"></i>` +
          `<span class="nm">${l.label}</span><span class="n">${(l.members ?? 0).toLocaleString()}</span></li>`,
      )
      .join("") +
    `</ul>`;
}

function renderCard() {
  const card = el("card");
  if (pinned == null) {
    card.hidden = true;
    return;
  }
  const d = districts[pinned];
  const list = incidence[pinned] ?? [];
  const partners = list
    .slice(0, 3)
    .map(
      ([j, w, k]) =>
        `<li><span class="nm">${nameOf(districts[j])}</span><span class="n">${w.toLocaleString()} · ${kinds[k]}</span></li>`,
    )
    .join("");
  card.hidden = false;
  card.innerHTML =
    `<div class="eyebrow">district ${pinned}</div><div class="big">${(d.size ?? 0).toLocaleString()}</div>` +
    `<div class="lead">${nameOf(d)}</div>` +
    `<p>${((d.size / readout.nodes) * 100).toFixed(1)}% of the graph · ${d.functions.toLocaleString()} functions · ` +
    `${d.classes.toLocaleString()} classes · community <b>${labels[d.cid]?.label ?? d.cid}</b></p>` +
    `<div class="eyebrow">couples to ${list.length}</div><ol>${partners}</ol>`;
}

function renderNet() {
  el("net-why").textContent = isDerived(layout)
    ? `${LAYOUT_TITLE[layout]} — derived here, not the export's. Radius is member count, colour is community, hairline brightness is coupling weight.`
    : `${LAYOUT_TITLE.ring} — what the bundle actually contains. Radius is member count, colour is community.`;
}

// --- interaction: hover to preview, click to pin, esc to close ---------------------------------
const tip = el("tip");
const ray = new THREE.Raycaster();
ray.params.Line.threshold = 6;
const pointer = new THREE.Vector2();
let lastHover = 0;

function showTip(html, ev) {
  tip.innerHTML = html;
  tip.hidden = false;
  tip.style.left = `${Math.min(ev.clientX + 14, innerWidth - tip.offsetWidth - 8)}px`;
  tip.style.top = `${Math.min(ev.clientY + 14, innerHeight - tip.offsetHeight - 8)}px`;
}

renderer.domElement.addEventListener("pointermove", (ev) => {
  if (ev.timeStamp - lastHover < 26) return;
  lastHover = ev.timeStamp;
  pointer.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(pointer, camera);

  const hit = ray.intersectObject(nodes, false)[0];
  if (hit && hit.instanceId != null) {
    if (hovered !== hit.instanceId) {
      hovered = hit.instanceId;
      paintNodes();
    }
    tip.dataset.kind = "node";
    const d = districts[hovered];
    showTip(
      `<b>${nameOf(d)}</b><span>${(d.size ?? 0).toLocaleString()} members · ${d.functions.toLocaleString()} functions · ${labels[d.cid]?.label ?? d.cid}</span>`,
      ev,
    );
    renderer.domElement.style.cursor = "pointer";
    return;
  }
  if (hovered != null) {
    hovered = null;
    paintNodes();
  }
  const eh = ray.intersectObject(edges, false)[0];
  const edge = eh && eh.index != null ? data.edges[Math.floor(eh.index / 2)] : null;
  if (edge) {
    tip.dataset.kind = "edge";
    showTip(
      `<b>${nameOf(districts[edge[0]])}</b><span class="arrow">↔</span><b>${nameOf(districts[edge[1]])}</b>` +
        `<span>weight ${edge[2].toLocaleString()} · ${kinds[edge[3]]}</span>`,
      ev,
    );
    renderer.domElement.style.cursor = "pointer";
    return;
  }
  tip.hidden = true;
  renderer.domElement.style.cursor = "grab";
});

renderer.domElement.addEventListener("pointerleave", () => {
  tip.hidden = true;
});

/** Fly the camera to a district — the reference's signature move, and the reason the field is 3D. */
function flyTo(i) {
  const { pos } = anchorOf(districts[i], layout);
  const target = new THREE.Vector3(pos[0], pos[1], pos[2]);
  const from = camera.position.clone();
  const dir = from.clone().sub(controls.target).normalize();
  const distance = Math.max(150, from.distanceTo(controls.target) * 0.45);
  flying = {
    t: 0,
    from,
    fromTarget: controls.target.clone(),
    to: target.clone().addScaledVector(dir, distance),
    toTarget: target,
  };
}

renderer.domElement.addEventListener("pointerdown", (ev) => {
  pointer.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObject(nodes, false)[0];
  if (hit && hit.instanceId != null) {
    pinned = pinned === hit.instanceId ? null : hit.instanceId;
    if (pinned != null) flyTo(pinned);
    paintEdges();
    paintNodes();
    renderCard();
    controls.autoRotate = false;
  } else if (pinned != null) {
    pinned = null;
    paintEdges();
    paintNodes();
    renderCard();
  }
});

addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && pinned != null) {
    pinned = null;
    paintEdges();
    paintNodes();
    renderCard();
  }
});

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- start ---------------------------------------------------------------------------------------
const startLayout = wireControls((next) => {
  layout = next;
  pinned = null;
  renderCard();
  renderNet();
  place(next);
});
layout = startLayout;
renderLegend();
renderCard();
renderNet();
place(startLayout);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (flying) {
    flying.t = Math.min(1, flying.t + dt / 0.65);
    const e = 1 - Math.pow(1 - flying.t, 3); // ease-out cubic
    camera.position.lerpVectors(flying.from, flying.to, e);
    controls.target.lerpVectors(flying.fromTarget, flying.toTarget, e);
    if (flying.t >= 1) flying = null;
  }
  controls.update();
  renderer.render(scene, camera);
});

window.__scene = {
  selectAt: (i) => {
    pinned = i;
    paintEdges();
    paintNodes();
    renderCard();
    flyTo(i);
  },
  setLayout: (l) => {
    layout = l;
    place(l);
  },
  get pinned() {
    return pinned;
  },
};
