import type { GeocodeItem } from "@/types";

export async function searchNaverGeocode(query: string) {
  const response = await fetch(`/api/geocode?query=${encodeURIComponent(query)}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? "지오코딩 실패");
  }

  const payload = (await response.json()) as { items: GeocodeItem[] };
  return payload.items;
}
