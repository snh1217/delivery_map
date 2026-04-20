import { registerPlugin } from "@capacitor/core";

export type ExtractorBridgeStatus = {
  overlayPermission: boolean;
  overlayRunning: boolean;
  hasPendingCapture: boolean;
  hasPendingAccessibilityTransfer: boolean;
  overlaySizeDp: number;
  overlayOpacity: number;
  overlayLocked: boolean;
  sdkInt: number;
  notificationsEnabled: boolean;
  accessibilityEnabled: boolean;
  lastObservedAccessibilityPackage?: string | null;
  customAccessibilityTargetPackages?: string[];
};

export type ExtractorOverlayConfig = {
  sizeDp: number;
  opacity: number;
  locked: boolean;
};

export type PendingAccessibilityTransfer = {
  address: string | null;
  rawText: string | null;
  providerHint: string | null;
  transferType: "accessibility";
  sourcePackage: string | null;
  detectedAt: number | null;
};

export type ExtractorBridgePlugin = {
  getStatus(): Promise<ExtractorBridgeStatus>;
  requestOverlayPermission(): Promise<void>;
  startOverlayBubble(): Promise<void>;
  stopOverlayBubble(): Promise<void>;
  captureCurrentScreen(): Promise<void>;
  consumeLastCapture(): Promise<{ dataUrl: string | null }>;
  consumePendingAccessibilityTransfer(): Promise<PendingAccessibilityTransfer>;
  updateOverlayConfig(config: ExtractorOverlayConfig): Promise<ExtractorBridgeStatus>;
  openAppNotificationSettings(): Promise<void>;
  openAccessibilitySettings(): Promise<void>;
  openAppDetailsSettings(): Promise<void>;
  addAccessibilityTargetPackage(options: { packageName: string }): Promise<ExtractorBridgeStatus>;
  removeAccessibilityTargetPackage(options: { packageName: string }): Promise<ExtractorBridgeStatus>;
};

export const ExtractorBridge = registerPlugin<ExtractorBridgePlugin>("ExtractorBridge");
