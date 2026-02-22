import short2Exceptions from "@/data/short2_exceptions.json";
import type { DongCentroid } from "@/types";

const exceptions = short2Exceptions as Record<string, string>;

function stripAdministrativeSuffix(dong: string): string {
  return dong
    .replace(/제\d+동/g, "")
    .replace(/\d+동/g, "")
    .replace(/동$/g, "")
    .trim();
}

export function toShort2(dong: string): string {
  if (exceptions[dong]) {
    return exceptions[dong];
  }

  const base = stripAdministrativeSuffix(dong);
  const chars = Array.from(base);
  if (chars.length >= 2) {
    return chars.slice(0, 2).join("");
  }

  return dong.slice(0, 2);
}

export function normalizeDongCentroids(data: DongCentroid[]): DongCentroid[] {
  return data.map((item) => ({
    ...item,
    short2: item.short2 || toShort2(item.dong),
  }));
}
