/**
 * atlas — an editorial plate of a point cloud.
 *
 * Identified from `withmarbleapp/os-taxonomy` → `media/curriculum-viz.gif`: a flat embedding map of every
 * curriculum standard, dots on a near-black ground, hairline prerequisite edges, a serif headline, a legend
 * with counts, and one pink accent that recolours a selection and its induced edges. See STYLES.md.
 *
 * Flat by design, which is also why it is Canvas 2D and costs a few KB instead of three.js's 425 KB.
 *
 * Channels, unchanged from the other two styles:
 *   position  the selected layout
 *   radius    member count, log  (the reference uses uniform dots; ours cannot, one district is 15.5% of the graph)
 *   colour    community hue
 *   edges     every edge, alpha = log(weight); the mesh is texture, not emphasis
 *   pin       one accent recolours that district and its edges, everything else dims
 */
import { anchorOf, extentOf, LAYOUT_TITLE, isDerived } from "./layouts.js";
import { activeLayout, wireControls } from "./controls.js";

const data = await (await fetch("./data.json")).json();
const { districts, incidence, readout, labels, kinds } = data;

const AC = { ground: "#07090f", hair: "220,228,245", pink: "212,67,119", ink: "#e8e6df", dim: "#6b6b76" };
const EDGE_BUCKETS = 6;

const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d", { alpha: false });

let layout = activeLayout();
let view = { scale: 1, ox: 0, oy: 0 };
let hover = null;
let pinned = null;
let dimNow = 0;
let dimTarget = 0;
let dragging = null;
let raf = 0;

// --- geometry ------------------------------------------------------------------------------------
const sizeMax = Math.max(...districts.map((d) => d.size), 1);
const radiusOf = (d) => 2.1 + 3.4 * (Math.log(Math.max(d.size, 1)) / Math.log(sizeMax));

const weights = data.edges.map((e) => e[2]).sort((a, b) => a - b);
const wMin = weights[0] || 1;
const wMax = weights[weights.length - 1] || 1;
const ln = (w) => (Math.log(w) - Math.log(wMin)) / Math.max(1e-6, Math.log(wMax) - Math.log(wMin));

const colourOf = (d) => `hsl(${d.hue.toFixed(0)} 92% 62%)`;

function fit() {
  const { radius } = extentOf(districts, layout);
  const pts = districts.map((d) => anchorOf(d, layout).pos);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const pad = 0.16;
  const span = Math.max(radius * 2, 1);
  view.scale = (Math.min(w, h) * (1 - pad)) / span;
  // centre on the centroid, which is the origin for every layout we produce
  view.ox = w / 2;
  view.oy = h / 2;
  void pts;
}
const project = (d) => {
  const [x, , z] = anchorOf(d, layout).pos;
  return [view.ox + x * view.scale, view.oy + z * view.scale];
};

// --- drawing -------------------------------------------------------------------------------------
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fit();
  draw();
}

function draw() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.fillStyle = AC.ground;
  ctx.fillRect(0, 0, w, h);

  const dim = dimNow;
  const near = new Set();
  if (pinned != null) {
    near.add(pinned);
    for (const [j] of incidence[pinned] ?? []) near.add(j);
  }

  // edges, bucketed by weight so 6,524 of them cost six strokes rather than 6,524
  const buckets = [];
  for (let b = 0; b < EDGE_BUCKETS; b++) buckets.push(new Path2D());
  const hot = new Path2D();
  const pts = districts.map(project);
  for (const [a, b, wt] of data.edges) {
    const isHot = pinned != null && (a === pinned || b === pinned);
    const path = isHot ? hot : buckets[Math.min(EDGE_BUCKETS - 1, Math.floor(ln(wt) * EDGE_BUCKETS))];
    path.moveTo(pts[a][0], pts[a][1]);
    path.lineTo(pts[b][0], pts[b][1]);
  }

  ctx.lineWidth = 1;
  for (let b = 0; b < EDGE_BUCKETS; b++) {
    const base = 0.035 + 0.14 * (b / (EDGE_BUCKETS - 1));
    ctx.strokeStyle = `rgba(${AC.hair},${(base * (1 - 0.88 * dim)).toFixed(3)})`;
    ctx.stroke(buckets[b]);
  }
  if (pinned != null) {
    ctx.strokeStyle = `rgba(${AC.pink},0.85)`;
    ctx.lineWidth = 1.1;
    ctx.stroke(hot);
    ctx.lineWidth = 1;
  }

  // nodes
  districts.forEach((d, i) => {
    const [x, y] = pts[i];
    const r = radiusOf(d);
    const lit = pinned == null || near.has(i);
    ctx.globalAlpha = lit ? 1 : 0.16;
    ctx.fillStyle = i === hover ? "#ffffff" : colourOf(d);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (i === pinned) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(${AC.pink},0.95)`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, r + 3.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    ctx.globalAlpha = 1;
  });
}

function frame() {
  raf = 0;
  const delta = dimTarget - dimNow;
  if (Math.abs(delta) > 0.002) {
    dimNow += delta * 0.18;
    draw();
    raf = requestAnimationFrame(frame);
  } else {
    dimNow = dimTarget;
    draw();
  }
}
const animate = () => {
  if (!raf) raf = requestAnimationFrame(frame);
};

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

const nameOf = (d) => d.label || labels[d.cid]?.label || "(unlabelled)";

function renderLegend() {
  const ranked = Object.entries(labels)
    .sort((a, b) => (b[1].members ?? 0) - (a[1].members ?? 0))
    .slice(0, 9);
  const hueOf = new Map(districts.map((d) => [d.cid, d.hue]));
  el("legend").innerHTML =
    `<h2>communities</h2><ul>` +
    ranked
      .map(
        ([cid, l]) =>
          `<li><i style="background:hsl(${(hueOf.get(Number(cid)) ?? 200).toFixed(0)} 92% 62%)"></i>` +
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
        `<li><span class="nm">${nameOf(districts[j])}</span>` +
        `<span class="n">${w.toLocaleString()} · ${kinds[k]}</span></li>`,
    )
    .join("");
  card.hidden = false;
  card.innerHTML =
    `<div class="eyebrow">district ${pinned}</div>` +
    `<div class="big">${(d.size ?? 0).toLocaleString()}</div>` +
    `<div class="lead">${nameOf(d)}</div>` +
    `<p>${((d.size / readout.nodes) * 100).toFixed(1)}% of the graph · ${d.functions.toLocaleString()} functions · ` +
    `${d.classes.toLocaleString()} classes · community <b>${labels[d.cid]?.label ?? d.cid}</b></p>` +
    `<div class="eyebrow">couples to ${list.length}</div><ol>${partners}</ol>`;
}

function renderNet() {
  el("net-why").textContent = isDerived(layout)
    ? `${LAYOUT_TITLE[layout]} — derived here, not the export's. Radius is member count; colour is community; ` +
      `hairline brightness is coupling weight.`
    : `${LAYOUT_TITLE.ring} — this is what the bundle actually contains. Radius is member count; colour is community.`;
}

// --- interaction ---------------------------------------------------------------------------------
function hit(x, y) {
  let best = null;
  let bestD = Infinity;
  districts.forEach((d, i) => {
    const [px, py] = project(d);
    const dd = Math.hypot(px - x, py - y);
    const r = radiusOf(d) + 6;
    if (dd < r && dd < bestD) {
      bestD = dd;
      best = i;
    }
  });
  return best;
}

canvas.addEventListener("pointermove", (ev) => {
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  if (dragging) {
    view.ox += x - dragging.x;
    view.oy += y - dragging.y;
    dragging = { x, y };
    draw();
    return;
  }
  const next = hit(x, y);
  if (next !== hover) {
    hover = next;
    canvas.style.cursor = next == null ? "grab" : "pointer";
    draw();
  }
});

canvas.addEventListener("pointerdown", (ev) => {
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  const target = hit(x, y);
  if (target == null) {
    dragging = { x, y };
    canvas.style.cursor = "grabbing";
    return;
  }
  pinned = pinned === target ? null : target;
  dimTarget = pinned == null ? 0 : 1;
  renderCard();
  animate();
});

addEventListener("pointerup", () => {
  dragging = null;
  canvas.style.cursor = "grab";
});

canvas.addEventListener("wheel", (ev) => {
  ev.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = ev.clientX - rect.left;
  const my = ev.clientY - rect.top;
  const before = [(mx - view.ox) / view.scale, (my - view.oy) / view.scale];
  view.scale = Math.min(400, Math.max(0.05, view.scale * Math.exp(-ev.deltaY * 0.0015)));
  view.ox = mx - before[0] * view.scale;
  view.oy = my - before[1] * view.scale;
  draw();
}, { passive: false });

addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && pinned != null) {
    pinned = null;
    dimTarget = 0;
    renderCard();
    animate();
  }
});

addEventListener("resize", resize);

// --- start ---------------------------------------------------------------------------------------
const startLayout = wireControls((next) => {
  layout = next;
  fit();
  renderNet();
  draw();
});
layout = startLayout;
renderLegend();
renderCard();
renderNet();
resize();

window.__scene = {
  selectAt: (i) => {
    pinned = i;
    dimTarget = 1;
    renderCard();
    animate();
  },
  setLayout: (l) => {
    layout = l;
    fit();
    renderNet();
    draw();
  },
  get pinned() {
    return pinned;
  },
};
