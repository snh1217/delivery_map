"use client";

export const PENDING_OCR_DESTINATION_KEY = "delivery_map_pending_ocr_destination_v1";

export type PendingOcrDestination = {
  address: string;
  createdAt: number;
  source: "admin-panel";
};

export function savePendingOcrDestination(address: string) {
  if (typeof window === "undefined") return;
  const payload: PendingOcrDestination = {
    address,
    createdAt: Date.now(),
    source: "admin-panel",
  };
  window.localStorage.setItem(PENDING_OCR_DESTINATION_KEY, JSON.stringify(payload));
}

export function consumePendingOcrDestination(maxAgeMs = 10 * 60 * 1000): PendingOcrDestination | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PENDING_OCR_DESTINATION_KEY);
  if (!raw) return null;
  window.localStorage.removeItem(PENDING_OCR_DESTINATION_KEY);
  try {
    const payload = JSON.parse(raw) as PendingOcrDestination;
    if (!payload?.address || typeof payload.createdAt !== "number") return null;
    if (Date.now() - payload.createdAt > maxAgeMs) return null;
    return payload;
  } catch {
    return null;
  }
}

