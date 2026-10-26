import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type AppUpdaterPlugin = {
  getStatus(): Promise<{ canInstallPackages: boolean; downloading: boolean }>;
  openInstallPermissionSettings(): Promise<void>;
  downloadAndInstall(options: { url: string }): Promise<{ installerOpened: boolean }>;
  addListener(
    eventName: "downloadProgress",
    listener: (event: { percent: number; received: number; total: number }) => void,
  ): Promise<PluginListenerHandle>;
};

export const AppUpdater = registerPlugin<AppUpdaterPlugin>("AppUpdater");

export function isAppUpdaterAvailable() {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("AppUpdater");
}

export function isDirectApkUrl(url: string) {
  return /^https?:\/\//i.test(url) && /\.apk(\?|#|$)/i.test(url);
}
