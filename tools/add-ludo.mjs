#!/usr/bin/env node
// add-ludo.mjs — one-command pipeline: Meshy .glb → optimized → embedded in index.html
//
//   node tools/add-ludo.mjs ~/Downloads/ludo-v4.glb   # embed this file
//   node tools/add-ludo.mjs                           # embed the newest .glb in assets-src/
//
// What it does (a few seconds, no npm installs — Node + macOS `sips` only):
//   1. validates the GLB (magic, skinned mesh, rig, clip, expected joint names)
//   2. copies the source into assets-src/ (if it isn't already there)
//   3. optimizes: texture → max 1024px JPEG, emissive stripped, bufferViews repacked
//   4. writes assets-src/<name>-opt.glb (usable with the in-game 🐕 picker too)
//   5. swaps the LUDO_GLB_B64 payload in index.html (rolling backup in assets-src/)
// It never touches index.html unless every prior step succeeded.

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'assets-src');
const INDEX = path.join(ROOT, 'index.html');
const EXPECTED_JOINTS = 'Hips,tail,tailstart,tail1,tail2,tail3,backleg,backleg0,backleg1,backleg2,R_backleg,R_backleg0,R_backleg1,R_backleg2,chest,head,headend,earend,R_earend,frontleg,frontleg0,frontleg1,frontleg2,R_frontleg,R_frontleg0,R_frontleg1,R_frontleg2';
const die = m => { console.error('✖ ' + m); process.exit(1); };

// ---- pick the source file ----
let src = process.argv[2];
if (!src) {
  const cands = fs.readdirSync(ASSETS)
    .filter(f => f.endsWith('.glb') && !f.endsWith('-opt.glb'))
    .map(f => ({ f, t: fs.statSync(path.join(ASSETS, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!cands.length) die('no .glb files in assets-src/ and no path given');
  src = path.join(ASSETS, cands[0].f);
  console.log('→ no path given; using newest drop: ' + cands[0].f);
}
src = path.resolve(src.replace(/^~(?=\/)/, os.homedir()));
if (!fs.existsSync(src)) die('not found: ' + src);

// ---- parse + validate ----
function parseGlb(buf) {
  if (buf.toString('ascii', 0, 4) !== 'glTF') die('not a GLB (bad magic)');
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.length);
  let off = 12, json = null, binOff = 0;
  while (off < buf.length) {
    const len = dv.getUint32(off, true), t = buf.toString('ascii', off + 4, off + 8);
    if (t === 'JSON') json = JSON.parse(buf.toString('utf8', off + 8, off + 8 + len)); else binOff = off + 8;
    off += 8 + len;
  }
  return { json, binOff };
}
const buf = fs.readFileSync(src);
const { json, binOff } = parseGlb(buf);
const prim = json.meshes?.[0]?.primitives?.[0];
if (!prim) die('no mesh primitive');
for (const a of ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0'])
  if (prim.attributes[a] === undefined) die('mesh is missing ' + a + ' — export with rig + texture from Meshy');
if (!json.skins?.length) die('no skin/rig — run Auto-Rig in Meshy before exporting');
if (!json.animations?.length) die('no animation clips — add an animation in Meshy before exporting');
if (!json.images?.length) die('no embedded texture — export GLB with textures');
const joints = json.skins[0].joints.map(j => json.nodes[j].name).join(',');
const tris = Math.round(json.accessors[prim.indices].count / 3);
console.log(`✔ valid GLB: ${tris.toLocaleString()} tris, ${json.skins[0].joints.length} joints, ` +
  `${json.animations.length} clip(s): ${json.animations.map(a => a.name).join('; ')}`);
if (joints !== EXPECTED_JOINTS)
  console.warn('⚠ joint names differ from the Meshy quadruped template — the game will still run,\n' +
    '  but tail-wag / ear / head overlays only fire on bones it can find by name.');
if (tris > 120000) console.warn(`⚠ ${tris.toLocaleString()} tris is heavy — consider Remesh ~30k in Meshy.`);

// ---- ensure a copy lives in assets-src/ ----
const base = path.basename(src, '.glb');
const keep = path.join(ASSETS, base + '.glb');
if (path.resolve(src) !== keep) { fs.copyFileSync(src, keep); console.log('✔ copied to assets-src/' + base + '.glb'); }

// ---- optimize: texture ≤1024 JPEG, emissive off, repack ----
const img = json.images[0], iv = json.bufferViews[img.bufferView];
let texBytes = buf.subarray(binOff + (iv.byteOffset || 0), binOff + (iv.byteOffset || 0) + iv.byteLength);
const needsShrink = img.mimeType !== 'image/jpeg' || texBytes.length > 600000;
if (needsShrink) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ludo-'));
  const tIn = path.join(tmp, 't.' + (img.mimeType === 'image/png' ? 'png' : 'img'));
  const tOut = path.join(tmp, 't.jpg');
  fs.writeFileSync(tIn, texBytes);
  try { execSync(`sips -Z 1024 -s format jpeg -s formatOptions 82 "${tIn}" --out "${tOut}"`, { stdio: 'pipe' }); }
  catch (e) { die('sips failed (macOS image tool): ' + e.message); }
  texBytes = fs.readFileSync(tOut);
  img.mimeType = 'image/jpeg';
  console.log(`✔ texture → 1024px JPEG (${(texBytes.length / 1e3).toFixed(0)} KB)`);
} else console.log('✔ texture already small — kept as-is');
delete json.materials[0].emissiveTexture;
json.materials[0].emissiveFactor = [0, 0, 0];

const parts = []; let cursor = 0;
json.bufferViews.forEach((bv, i) => {
  const bytes = (i === img.bufferView) ? texBytes
    : buf.subarray(binOff + (bv.byteOffset || 0), binOff + (bv.byteOffset || 0) + bv.byteLength);
  bv.byteOffset = cursor; bv.byteLength = bytes.length;
  parts.push(bytes); cursor += bytes.length;
  const pad = (4 - (cursor % 4)) % 4;
  if (pad) { parts.push(Buffer.alloc(pad)); cursor += pad; }
});
json.buffers[0].byteLength = cursor;
let js = JSON.stringify(json); while (Buffer.byteLength(js) % 4) js += ' ';
const jb = Buffer.from(js), bb = Buffer.concat(parts);
const total = 12 + 8 + jb.length + 8 + bb.length;
const out = Buffer.alloc(total);
out.write('glTF', 0, 'ascii'); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8);
out.writeUInt32LE(jb.length, 12); out.write('JSON', 16, 'ascii'); jb.copy(out, 20);
const bs = 20 + jb.length;
out.writeUInt32LE(bb.length, bs); out.write('BIN\0', bs + 4, 'binary'); bb.copy(out, bs + 8);
const optPath = path.join(ASSETS, base + '-opt.glb');
fs.writeFileSync(optPath, out);
console.log(`✔ wrote assets-src/${base}-opt.glb (${(total / 1e6).toFixed(2)} MB)`);

// ---- swap the embedded payload (atomic write, rolling backup) ----
let html = fs.readFileSync(INDEX, 'utf8');
const m = html.match(/const LUDO_GLB_B64="/);
if (!m) die('LUDO_GLB_B64 anchor not found in index.html');
const start = m.index + m[0].length, end = html.indexOf('"', start);
fs.copyFileSync(INDEX, path.join(ASSETS, 'index.prev.html.bak'));
const b64 = out.toString('base64');
html = html.slice(0, start) + b64 + html.slice(end);
const tmpIndex = INDEX + '.tmp';
fs.writeFileSync(tmpIndex, html);
fs.renameSync(tmpIndex, INDEX);
console.log(`✔ embedded in index.html (${(fs.statSync(INDEX).size / 1e6).toFixed(2)} MB total; ` +
  `previous version backed up to assets-src/index.prev.html.bak)`);
console.log(`\n🐶 done — hard-reload the game (⌘⇧R) to meet the new Ludo`);
