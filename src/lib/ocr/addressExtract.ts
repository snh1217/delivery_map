"use client";

const PHONE_PATTERN = /01[0-9]{1}-?\d{3,4}-?\d{4}/g;

const UI_NOISE_WORDS = [
  "위치",
  "출발지 상세",
  "도착지 상세",
  "고객",
  "전화번호",
  "연락처",
  "메모",
  "상세",
];

const SIDO_KEYWORDS = [
  "서울",
  "경기",
  "인천",
  "부산",
  "대구",
  "광주",
  "대전",
  "울산",
  "세종",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
];

function cleanSymbols(input: string) {
  return input
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/[|¦‖]/g, " ")
    .replace(/[“”"']/g, "")
    .replace(/[^\p{L}\p{N}\s(),\-./]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAddress(addr: string) {
  let text = cleanSymbols(addr);
  text = text.replace(PHONE_PATTERN, " ");
  UI_NOISE_WORDS.forEach((word) => {
    const pattern = new RegExp(`\\b${word}\\b`, "gi");
    text = text.replace(pattern, " ");
  });

  text = text
    .replace(/서울시/g, "서울")
    .replace(/경기도/g, "경기")
    .replace(/인천시/g, "인천")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)\s*/g, ")")
    .replace(/\(\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  text = text.replace(/^[\s,.;:]+|[\s,.;:]+$/g, "").trim();
  return text;
}

function scoreCandidate(raw: string) {
  const text = normalizeAddress(raw);
  if (!text) return { text, score: -999 };

  let score = 0;
  if (SIDO_KEYWORDS.some((kw) => text.includes(kw))) score += 3;
  if (text.includes("구")) score += 2;
  if (/(동|로|길|대로|번길)/.test(text)) score += 2;
  if (/\d/.test(text)) score += 1;
  if (/(층|호|빌딩|아파트|상가)/.test(text)) score += 1;
  if (text.length < 8) score -= 3;
  if (PHONE_PATTERN.test(text)) score -= 4;
  if (UI_NOISE_WORDS.some((w) => text === w)) score -= 6;

  return { text, score };
}

function buildCandidates(text: string) {
  const rawLines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates = new Set<string>();
  rawLines.forEach((line) => candidates.add(line));

  for (let i = 0; i < rawLines.length; i += 1) {
    const one = rawLines[i];
    const two = [rawLines[i], rawLines[i + 1]].filter(Boolean).join(" ");
    const three = [rawLines[i], rawLines[i + 1], rawLines[i + 2]].filter(Boolean).join(" ");
    if (one) candidates.add(one);
    if (two) candidates.add(two);
    if (three) candidates.add(three);
  }

  // Whole block candidate can be useful when address is broken into multiple lines.
  candidates.add(rawLines.join(" "));

  return [...candidates]
    .map((c) => c.replace(PHONE_PATTERN, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function extractAddressFromText(text: string): string | null {
  const cleaned = text.replace(PHONE_PATTERN, " ");
  const candidates = buildCandidates(cleaned);
  if (candidates.length === 0) return null;

  const scored = candidates
    .map(scoreCandidate)
    .filter((c) => c.text)
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length);

  const best = scored[0];
  if (!best || best.score < 1) return null;
  return normalizeAddress(best.text);
}

export function maskPhoneNumbers(text: string) {
  return text.replace(PHONE_PATTERN, "[전화번호]");
}

