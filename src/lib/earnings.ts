import type { DailyEarningItem, LegacyDailyEarningItem } from "@/types";

export const MY_EARNING_TARGET_NAME = "내 운임";
export const LOGI_DEDUCTION_RATE = 0.23;

export type EarningRangePreset = "today" | "yesterday" | "last7" | "thisMonth";

export function parseAmount(value: string): number {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return 0;
  return Number.parseInt(digits, 10) || 0;
}

export function formatKRW(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.trunc(amount)) : 0;
  return `₩${safe.toLocaleString("ko-KR")}`;
}

export function calcNet(amountGross: number, isLogi: boolean): number {
  const gross = Number.isFinite(amountGross) ? Math.max(0, Math.trunc(amountGross)) : 0;
  if (!isLogi) return gross;
  return Math.round(gross * (1 - LOGI_DEDUCTION_RATE));
}

export function calcGrossFromNet(amountNet: number, isLogi: boolean): number {
  const net = Number.isFinite(amountNet) ? Math.max(0, Math.trunc(amountNet)) : 0;
  if (!isLogi) return net;
  return Math.round(net * (1 + LOGI_DEDUCTION_RATE));
}

export function normalizeEarningItem(item: unknown): DailyEarningItem | null {
  if (!item || typeof item !== "object") return null;

  const asNew = item as Partial<DailyEarningItem>;
  const asLegacy = item as Partial<LegacyDailyEarningItem>;

  const hasNewShape = typeof asNew.amount_gross !== "undefined" || typeof asNew.amount_net !== "undefined";

  if (hasNewShape) {
    const amountGrossRaw = asNew.amount_gross;
    const isLogi = Boolean(asNew.is_logi);
    const amountGross =
      typeof amountGrossRaw === "number"
        ? Math.max(0, Math.trunc(amountGrossRaw))
        : typeof amountGrossRaw === "string"
          ? parseAmount(amountGrossRaw)
          : 0;
    const amountNetRaw = asNew.amount_net;
    const amountNet =
      typeof amountNetRaw === "number" && Number.isFinite(amountNetRaw)
        ? Math.max(0, Math.trunc(amountNetRaw))
        : calcNet(amountGross, isLogi);

    if (!amountGross && !amountNet) return null;

    return {
      amount_gross: amountGross,
      is_logi: isLogi,
      amount_net: amountNet,
      ...(typeof asNew.memo === "string" && asNew.memo.trim() ? { memo: asNew.memo.trim().slice(0, 100) } : {}),
      ...(typeof asNew.createdAt === "string" && asNew.createdAt ? { createdAt: asNew.createdAt } : {}),
    };
  }

  const amountLegacyRaw = asLegacy.amount;
  const amountLegacy =
    typeof amountLegacyRaw === "number"
      ? Math.max(0, Math.trunc(amountLegacyRaw))
      : typeof amountLegacyRaw === "string"
        ? parseAmount(amountLegacyRaw)
        : 0;

  if (!amountLegacy) return null;

  return {
    amount_gross: amountLegacy,
    is_logi: false,
    amount_net: amountLegacy,
    ...(typeof asLegacy.memo === "string" && asLegacy.memo.trim() ? { memo: asLegacy.memo.trim().slice(0, 100) } : {}),
    ...(typeof asLegacy.createdAt === "string" && asLegacy.createdAt ? { createdAt: asLegacy.createdAt } : {}),
  };
}

export function sanitizeDailyEarningItems(items: unknown[]): DailyEarningItem[] {
  return items.map(normalizeEarningItem).filter((item): item is DailyEarningItem => Boolean(item));
}

export function sumNet(items: DailyEarningItem[]): number {
  return items.reduce((sum, item) => sum + (Number.isFinite(item.amount_net) ? Math.max(0, Math.trunc(item.amount_net)) : 0), 0);
}

// Backward-compatible alias used in older components / code paths.
export function sumItems(items: DailyEarningItem[]): number {
  return sumNet(items);
}

export function getKstYmd(baseDate = new Date()): string {
  const kst = new Date(baseDate.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatYmdKstFromUtcDateParts(y: number, m0: number, d: number) {
  return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function getKstRange(preset: EarningRangePreset, now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m0 = kst.getUTCMonth();
  const d = kst.getUTCDate();

  if (preset === "today") {
    const ymd = formatYmdKstFromUtcDateParts(y, m0, d);
    return { from: ymd, to: ymd };
  }

  if (preset === "yesterday") {
    const prev = new Date(Date.UTC(y, m0, d - 1));
    const ymd = formatYmdKstFromUtcDateParts(prev.getUTCFullYear(), prev.getUTCMonth(), prev.getUTCDate());
    return { from: ymd, to: ymd };
  }

  if (preset === "last7") {
    const from = new Date(Date.UTC(y, m0, d - 6));
    return {
      from: formatYmdKstFromUtcDateParts(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
      to: formatYmdKstFromUtcDateParts(y, m0, d),
    };
  }

  // thisMonth
  return {
    from: formatYmdKstFromUtcDateParts(y, m0, 1),
    to: formatYmdKstFromUtcDateParts(y, m0, d),
  };
}
