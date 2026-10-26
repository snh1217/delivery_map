import type { FavoriteAddressRow } from "@/types";

export function normalizeFavoriteText(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

// 입력값이 즐겨찾기 이름·주소·메모에 포함되면 후보로 보여줍니다. 이름이 앞부분과 맞을수록 위로 정렬합니다.
export function findFavoriteSuggestions(favorites: FavoriteAddressRow[], input: string, limit = 5) {
  const keyword = normalizeFavoriteText(input);
  if (keyword.length < 2) return [];

  return favorites
    .map((item) => {
      const label = normalizeFavoriteText(item.label);
      const address = normalizeFavoriteText(item.address);
      const memo = normalizeFavoriteText(item.memo ?? "");
      let score = -1;
      if (label.startsWith(keyword)) score = 3;
      else if (label.includes(keyword)) score = 2;
      else if (address.includes(keyword)) score = 1;
      else if (memo.includes(keyword)) score = 0;
      return { item, score };
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || b.item.use_count - a.item.use_count)
    .slice(0, limit)
    .map((entry) => entry.item);
}
