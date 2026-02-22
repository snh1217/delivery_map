import fs from "node:fs";
import path from "node:path";
import { pointOnFeature } from "@turf/turf";

const root = process.cwd();
const sourcePath = path.join(root, ".tmp_admdongkor", "ver20260201", "HangJeongDong_ver20260201.geojson");
const outPath = path.join(root, "src", "data", "dong_centroids.json");
const exceptionsPath = path.join(root, "src", "data", "short2_exceptions.json");

function stripAdministrativeSuffix(dong) {
  return String(dong)
    .replace(/제\d+동/g, "")
    .replace(/\d+동/g, "")
    .replace(/동$/g, "")
    .trim();
}

function toShort2(dong, exceptions) {
  if (exceptions[dong]) return exceptions[dong];
  const base = stripAdministrativeSuffix(dong);
  const chars = Array.from(base);
  if (chars.length >= 2) return chars.slice(0, 2).join("");
  return Array.from(String(dong)).slice(0, 2).join("");
}

function parseDongName(props) {
  const sidonm = String(props?.sidonm ?? "").trim();
  const sggnm = String(props?.sggnm ?? "").trim();
  const admNm = String(props?.adm_nm ?? "").trim();

  let tail = admNm;
  const prefixes = [
    [sidonm, sggnm].filter(Boolean).join(" "),
    sidonm,
  ].filter(Boolean);

  for (const prefix of prefixes) {
    if (tail.startsWith(prefix + " ")) {
      tail = tail.slice(prefix.length).trim();
      break;
    }
  }

  const tailParts = tail.split(/\s+/).filter(Boolean);
  return tailParts.length > 0 ? tailParts[tailParts.length - 1] : tail || admNm;
}

const raw = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const exceptions = JSON.parse(fs.readFileSync(exceptionsPath, "utf8"));

const rows = (raw.features ?? []).flatMap((feature) => {
  if (!feature?.geometry || !feature?.properties) return [];
  try {
    const pt = pointOnFeature(feature);
    const [lon, lat] = pt.geometry.coordinates;
    const sido = String(feature.properties.sidonm ?? "").trim();
    const sigungu = String(feature.properties.sggnm ?? "").trim() || sido;
    const dong = parseDongName(feature.properties);
    const short2 = toShort2(dong, exceptions);
    return [{ sido, sigungu, dong, short2, lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)) }];
  } catch {
    return [];
  }
});

rows.sort((a, b) =>
  a.sido.localeCompare(b.sido, "ko") ||
  a.sigungu.localeCompare(b.sigungu, "ko") ||
  a.dong.localeCompare(b.dong, "ko") ||
  a.lat - b.lat ||
  a.lon - b.lon,
);

fs.writeFileSync(outPath, JSON.stringify(rows, null, 2) + "\n", "utf8");
console.log(`Generated ${rows.length} centroids -> ${outPath}`);
