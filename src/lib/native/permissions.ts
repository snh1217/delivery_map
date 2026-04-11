"use client";

import { isNativeApp } from "@/lib/native/runtime";

export type PermissionRequestResult = {
  granted: boolean;
  state: "granted" | "prompt" | "denied" | "unsupported" | "unknown";
};

function normalizePermissionState(value?: string | null): PermissionRequestResult["state"] {
  if (value === "granted" || value === "prompt" || value === "denied") return value;
  if (value === "unsupported") return "unsupported";
  return "unknown";
}

export async function getMicrophonePermissionState(): Promise<PermissionRequestResult["state"]> {
  if (isNativeApp()) {
    try {
      const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
      const status = await SpeechRecognition.checkPermissions();
      return normalizePermissionState(status.speechRecognition);
    } catch {
      return "unknown";
    }
  }

  if (typeof navigator === "undefined") return "unsupported";

  try {
    if ("permissions" in navigator && navigator.permissions?.query) {
      const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
      return normalizePermissionState(status.state);
    }
  } catch {
    // ignore permission API failures and fall back
  }

  return "unknown";
}

export async function requestMicrophonePermission(): Promise<PermissionRequestResult> {
  if (isNativeApp()) {
    try {
      const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
      const status = await SpeechRecognition.requestPermissions();
      const state = normalizePermissionState(status.speechRecognition);
      return { granted: state === "granted", state };
    } catch {
      return { granted: false, state: "unknown" };
    }
  }

  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { granted: false, state: "unsupported" };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return { granted: true, state: "granted" };
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      return { granted: false, state: "denied" };
    }
    if (name === "NotFoundError") {
      return { granted: false, state: "unsupported" };
    }
    return { granted: false, state: "unknown" };
  }
}

export async function requestCoreAppPermissions() {
  const result = {
    location: "unknown" as PermissionRequestResult["state"],
    camera: "unknown" as PermissionRequestResult["state"],
    microphone: "unknown" as PermissionRequestResult["state"],
  };

  if (!isNativeApp()) {
    return result;
  }

  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const geo = await Geolocation.requestPermissions();
    result.location = normalizePermissionState(geo.location ?? geo.coarseLocation ?? "unknown");
  } catch {
    // ignore
  }

  try {
    const { Camera } = await import("@capacitor/camera");
    const camera = await Camera.requestPermissions({ permissions: ["camera", "photos"] });
    result.camera = normalizePermissionState(camera.camera ?? camera.photos ?? "unknown");
  } catch {
    // ignore
  }

  try {
    const mic = await requestMicrophonePermission();
    result.microphone = mic.state;
  } catch {
    // ignore
  }

  return result;
}
