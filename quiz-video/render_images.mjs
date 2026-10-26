// Fabrique une image d'illustration par question (PNG 960x720) à partir du champ "image" du quiz.
// Types : {"emoji":"🏆"} | {"drapeau":"FR"} | {"carte":"Australia","lieu":[149.13,-35.28],"nom":"Canberra"}
// Usage : node render_images.mjs quiz.json DOSSIER_SORTIE
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { Resvg } from "@resvg/resvg-js";
import * as topojson from "topojson-client";
import { geoMercator, geoPath, geoArea } from "d3-geo";

const require = createRequire(import.meta.url);
const [, , quizPath, outDir] = process.argv;
const quiz = JSON.parse(fs.readFileSync(quizPath, "utf8"));
fs.mkdirSync(outDir, { recursive: true });
const W = 960, H = 720;
const omDir = path.dirname(require.resolve("openmoji/package.json"));
const omData = JSON.parse(fs.readFileSync(path.join(omDir, "data/openmoji.json"), "utf8"));
const byEmoji = new Map(omData.map(e => [e.emoji, e.hexcode]));
const strip = s => s.replace(/️/g, "");
for (const e of omData) if (!byEmoji.has(strip(e.emoji))) byEmoji.set(strip(e.emoji), e.hexcode);

function png(svg, file) {
  const r = new Resvg(svg, { fitTo: { mode: "width", value: W }, font: { loadSystemFonts: true, defaultFontFamily: "DejaVu Sans" } });
  fs.writeFileSync(file, r.render().asPng());
}
function emojiSvg(ch) {
  const hex = byEmoji.get(ch) || byEmoji.get(strip(ch));
  if (!hex) throw new Error("Emoji introuvable dans OpenMoji : " + ch);
  const inner = fs.readFileSync(path.join(omDir, "color/svg", hex + ".svg"), "utf8")
    .replace(/<\?xml[^>]*>/, "").replace(/<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const s = 680; // emoji 72x72 agrandi
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <g transform="translate(${(W - s) / 2},${(H - s) / 2}) scale(${s / 72})">${inner}</g></svg>`;
}
const flagEmoji = iso => [...iso.toUpperCase()].map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");

const world = JSON.parse(fs.readFileSync(require.resolve("world-atlas/countries-50m.json"), "utf8"));
const countries = topojson.feature(world, world.objects.countries).features;
function mapSvg(spec) {
  const target = countries.find(f => f.properties.name.toLowerCase() === spec.carte.toLowerCase());
  if (!target) throw new Error("Pays introuvable dans world-atlas : " + spec.carte);
  // Cadrage sur la partie principale du pays (évite les territoires d'outre-mer) ou sur "zoom" [[lon,lat],[lon,lat]]
  let fitObj = target;
  if (spec.zoom) fitObj = { type: "MultiPoint", coordinates: spec.zoom };
  else if (target.geometry.type === "MultiPolygon") {
    const polys = target.geometry.coordinates.map(c => ({ type: "Polygon", coordinates: c }));
    fitObj = polys.reduce((a, b) => (geoArea(b) > geoArea(a) ? b : a));
  }
  const proj = geoMercator().fitExtent([[150, 90], [W - 150, H - 90]], fitObj);
  const p = geoPath(proj);
  const others = countries.filter(f => f !== target).map(f => `<path d="${p(f) || ""}"/>`).join("");
  let marker = "";
  if (spec.lieu) {
    const [x, y] = proj(spec.lieu);
    const label = (spec.nom || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const lx = x > W - 260 ? x - 24 : x + 24, anchor = x > W - 260 ? "end" : "start";
    marker = `<circle cx="${x}" cy="${y}" r="26" fill="#ff4438" fill-opacity=".25"/><circle cx="${x}" cy="${y}" r="13" fill="#ff4438" stroke="#fff" stroke-width="4"/>` +
      (label ? `<text x="${lx}" y="${y + 12}" text-anchor="${anchor}" font-family="DejaVu Sans" font-weight="bold" font-size="40" fill="#fff" stroke="#0a1020" stroke-width="8" paint-order="stroke">${label}</text>` : "");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#0f2a44"/>
    <g fill="#24364f" stroke="#3b5272" stroke-width="1.2">${others}</g>
    <path d="${p(target)}" fill="#ffc400" stroke="#fff3c4" stroke-width="2.5"/>${marker}</svg>`;
}

quiz.questions.forEach((q, i) => {
  const im = q.image; if (!im) return;
  let svg;
  if (im.emoji) svg = emojiSvg(im.emoji);
  else if (im.drapeau) svg = emojiSvg(flagEmoji(im.drapeau));
  else if (im.carte) svg = mapSvg(im);
  else return;
  const out = path.join(outDir, `q${i + 1}.png`);
  png(svg, out);
  console.log("image", i + 1, Object.keys(im)[0], "->", out);
});
