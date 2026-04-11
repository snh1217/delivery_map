"use client";

import { useEffect } from "react";
import { requestCoreAppPermissions } from "@/lib/native/permissions";
import { getAppEnvironment, getNativePlatform, isNativeApp, isStandalonePwa } from "@/lib/native/runtime";

const NATIVE_PERMISSION_WARMUP_KEY = "delivery_map_native_permission_warmup_v1";

function applyAppEnvironmentClasses() {
  if (typeof document === "undefined") return;

  const html = document.documentElement;
  const body = document.body;
  const environment = getAppEnvironment();

  html.dataset.appEnv = environment.type;
  html.dataset.appPlatform = environment.platform;

  const classes = [
    "app-env-native",
    "app-env-pwa",
    "app-env-web",
    "app-platform-ios",
    "app-platform-android",
    "app-platform-web",
  ];

  html.classList.remove(...classes);
  body.classList.remove(...classes);

  const envClass = `app-env-${environment.type}`;
  const platformClass =
    environment.type === "native" ? `app-platform-${getNativePlatform()}` : `app-platform-${environment.platform}`;

  html.classList.add(envClass, platformClass);
  body.classList.add(envClass, platformClass);
}

export function NativeAppBootstrap() {
  useEffect(() => {
    const apply = () => applyAppEnvironmentClasses();
    apply();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        apply();
      }
    };

    window.addEventListener("pageshow", apply);
    window.addEventListener("focus", apply);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("pageshow", apply);
      window.removeEventListener("focus", apply);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!isNativeApp() && !isStandalonePwa()) return;
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("color-scheme", "light");
  }, []);

  useEffect(() => {
    if (!isNativeApp() || typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem(NATIVE_PERMISSION_WARMUP_KEY) === "1") return;
      window.sessionStorage.setItem(NATIVE_PERMISSION_WARMUP_KEY, "1");
    } catch {
      // ignore storage issues
    }

    const timer = window.setTimeout(() => {
      void requestCoreAppPermissions();
    }, 700);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
