import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

export function isNativeApp() {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform();
}

export function getNativePlatform() {
  if (typeof window === "undefined") return "web" as const;
  return Capacitor.getPlatform();
}

export function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
}

export function getAppEnvironment() {
  if (isNativeApp()) {
    return {
      type: "native" as const,
      platform: getNativePlatform(),
    };
  }

  if (isStandalonePwa()) {
    return {
      type: "pwa" as const,
      platform: "web" as const,
    };
  }

  return {
    type: "web" as const,
    platform: "web" as const,
  };
}

export async function exitNativeApp() {
  if (!isNativeApp()) return;
  await App.exitApp();
}
