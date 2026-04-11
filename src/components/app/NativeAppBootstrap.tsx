"use client";

import { useEffect } from "react";
import { getAppEnvironment, getNativePlatform, isNativeApp, isStandalonePwa } from "@/lib/native/runtime";

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

  return null;
}
