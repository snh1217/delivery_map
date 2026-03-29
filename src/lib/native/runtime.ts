import { Capacitor } from "@capacitor/core";

export function isNativeApp() {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform();
}

export function getNativePlatform() {
  if (typeof window === "undefined") return "web" as const;
  return Capacitor.getPlatform();
}
