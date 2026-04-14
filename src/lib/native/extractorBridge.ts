import { registerPlugin } from "@capacitor/core";

export type ExtractorBridgeStatus = {
  overlayPermission: boolean;
  overlayRunning: boolean;
  hasPendingCapture: boolean;
  overlaySizeDp: number;
  overlayOpacity: number;
  overlayLocked: boolean;
  sdkInt: number;
  notificationsEnabled: boolean;
};

export type ExtractorOverlayConfig = {
  sizeDp: number;
  opacity: number;
  locked: boolean;
};

export type ExtractorBridgePlugin = {
  getStatus(): Promise<ExtractorBridgeStatus>;
  requestOverlayPermission(): Promise<void>;
  startOverlayBubble(): Promise<void>;
  stopOverlayBubble(): Promise<void>;
  captureCurrentScreen(): Promise<void>;
  consumeLastCapture(): Promise<{ dataUrl: string | null }>;
  updateOverlayConfig(config: ExtractorOverlayConfig): Promise<ExtractorBridgeStatus>;
  openAppNotificationSettings(): Promise<void>;
};

export const ExtractorBridge = registerPlugin<ExtractorBridgePlugin>("ExtractorBridge");
