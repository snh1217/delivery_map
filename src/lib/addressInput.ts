// 붙여넣기 주소 파싱
// 예) "강남 논현동 / 서울 강남구 논현동 1-3 / 7층"
//   → query: "서울 강남구 논현동 1-3", detail: "7층"

const SEGMENT_SEPARATOR = /\s*(?:\/|\||｜|\r?\n|\t|·)\s*/;

const SIDO_PATTERN =
  /^(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|충청|전북|전남|전라|경북|경남|경상|제주)/;
const SIGUNGU_PATTERN = /[가-힣]+(시|군|구)(\s|$)/;
const DONG_PATTERN = /[가-힣0-9]+(동|읍|면|리|가)(\s|$)/;
const ROAD_PATTERN = /[가-힣0-9]+(로|길|대로|번길)(\s|$|\d)/;
const LOT_NUMBER_PATTERN = /(^|\s)(산\s?)?\d+(-\d+)?(번지)?(\s|$|,)/;
const DETAIL_ONLY_PATTERN =
  /^(지하\s?)?(B\d+|\d+)\s?(층|호|F)$|^\d+동\s?\d+호$|^[A-Za-z가-힣0-9]+(빌딩|타워|아파트|오피스텔|상가)?\s?\d+(층|호)$/i;

export type ParsedAddressInput = {
  query: string;
  detail?: string;
  changed: boolean;
};

function scoreSegment(segment: string) {
  if (!segment) return -999;
  if (DETAIL_ONLY_PATTERN.test(segment)) return -10;

  let score = 0;
  if (SIDO_PATTERN.test(segment)) score += 3;
  if (SIGUNGU_PATTERN.test(segment)) score += 2;
  if (DONG_PATTERN.test(segment)) score += 2;
  if (ROAD_PATTERN.test(segment)) score += 2;
  if (LOT_NUMBER_PATTERN.test(segment)) score += 3;
  if (segment.length < 3) score -= 2;
  return score;
}

export function parseAddressInput(raw: string): ParsedAddressInput {
  const trimmed = (raw || "").trim();
  const segments = trimmed
    .split(SEGMENT_SEPARATOR)
    .map((segment) => segment.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (segments.length <= 1) {
    return { query: segments[0] ?? "", changed: false };
  }

  let bestIndex = 0;
  let bestScore = -Infinity;
  segments.forEach((segment, index) => {
    const score = scoreSegment(segment);
    if (score > bestScore || (score === bestScore && segment.length > segments[bestIndex].length)) {
      bestScore = score;
      bestIndex = index;
    }
  });

  if (bestScore <= 0) {
    return { query: trimmed, changed: false };
  }

  const detail = segments.slice(bestIndex + 1).join(" ").trim();
  return {
    query: segments[bestIndex],
    detail: detail || undefined,
    changed: true,
  };
}
