import { registerPlugin } from "@capacitor/core";

export type ExtractorBridgeStatus = {
  overlayPermission: boolean;
  overlayRunning: boolean;
  hasPendingCapture: boolean;
};

export type ExtractorBridgePlugin = {
  getStatus(): Promise<ExtractorBridgeStatus>;
  requestOverlayPermission(): Promise<void>;
  startOverlayBubble(): Promise<void>;
  stopOverlayBubble(): Promise<void>;
  captureCurrentScreen(): Promise<void>;
  consumeLastCapture(): Promise<{ dataUrl: string | null }>;
};

export const ExtractorBridge = registerPlugin<ExtractorBridgePlugin>("ExtractorBridge");
