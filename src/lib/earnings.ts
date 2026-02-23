import type { DailyEarningItem } from "@/types";

export const MY_EARNING_TARGET_NAME = "내 운임";

export function parseAmount(value: string): number {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) {
    return 0;
  }
  return Number.parseInt(digits, 10) || 0;
}

export function formatKRW(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.trunc(amount)) : 0;
  return `₩${safe.toLocaleString("ko-KR")}`;
}

export function sumItems(items: DailyEarningItem[]): number {
  return items.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? Math.max(0, Math.trunc(item.amount)) : 0), 0);
}

export function getKstYmd(baseDate = new Date()): string {
  const kst = new Date(baseDate.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function sanitizeDailyEarningItems(items: unknown[]): DailyEarningItem[] {
  return items
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const amountRaw = (item as { amount?: unknown }).amount;
      const amount =
        typeof amountRaw === "number"
          ? Math.max(0, Math.trunc(amountRaw))
          : typeof amountRaw === "string"
            ? parseAmount(amountRaw)
            : 0;
      if (!amount) {
        return null;
      }
      const memoRaw = (item as { memo?: unknown }).memo;
      const createdAtRaw = (item as { createdAt?: unknown }).createdAt;
      return {
        amount,
        ...(typeof memoRaw === "string" && memoRaw.trim() ? { memo: memoRaw.trim().slice(0, 100) } : {}),
        ...(typeof createdAtRaw === "string" && createdAtRaw ? { createdAt: createdAtRaw } : {}),
      } satisfies DailyEarningItem;
    })
    .filter((item): item is DailyEarningItem => Boolean(item));
}

