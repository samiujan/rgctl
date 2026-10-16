/**
 * Copies the three.js files the import maps expect into ./vendor.
 *
 * `vendor/` is generated, not committed: it is a 2 MB copy of a dependency that npm already manages.
 * Run this once after `npm install`.
 */
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const THREE = join(HERE, "node_modules", "three");

if (!existsSync(THREE)) {
  console.error("three.js is not installed. Run:\n\n  npm install\n\nthen run this again.");
  process.exit(1);
}

// Only the parts these demos import, so the copied tree stays small and auditable.
const FILES = [
  "build/three.module.js",
  "build/three.core.js",
  "examples/jsm/controls/OrbitControls.js",
  "examples/jsm/postprocessing/EffectComposer.js",
  "examples/jsm/postprocessing/Pass.js",
  "examples/jsm/postprocessing/ShaderPass.js",
  "examples/jsm/postprocessing/MaskPass.js",
  "examples/jsm/postprocessing/RenderPass.js",
  "examples/jsm/postprocessing/UnrealBloomPass.js",
  "examples/jsm/postprocessing/OutputPass.js",
  "examples/jsm/shaders/CopyShader.js",
  "examples/jsm/shaders/LuminosityHighPassShader.js",
  "examples/jsm/shaders/OutputShader.js",
];

for (const file of FILES) {
  const from = join(THREE, file);
  if (!existsSync(from)) {
    console.error(`missing ${file} in the installed three package — version mismatch?`);
    process.exit(1);
  }
  // build/three.module.js must sit NEXT TO three.core.js, because the module imports it by relative path;
  // only the examples/jsm tree is re-rooted under addons/
  const rel = file.startsWith("build/")
    ? file.slice("build/".length)
    : file.replace("examples/jsm/", "addons/");
  const to = join(HERE, "vendor", rel);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
}
console.log(`copied ${FILES.length} three.js files into vendor/`);
