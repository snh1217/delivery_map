"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/native/runtime";

async function unregisterServiceWorkersAndStaticCaches() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    // ignore
  }

  if (!("caches" in window)) return;

  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("delivery-map-static")).map((key) => caches.delete(key)));
  } catch {
    // ignore
  }
}

async function registerWebServiceWorker() {
  const registration = await navigator.serviceWorker.register("/sw.js");

  const applyWaitingWorker = (worker: ServiceWorker | null) => {
    if (!worker) return;
    worker.postMessage({ type: "SKIP_WAITING" });
  };

  applyWaitingWorker(registration.waiting ?? null);

  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed" && navigator.serviceWorker.controller) {
        applyWaitingWorker(registration.waiting ?? null);
      }
    });
  });

  const refreshRegistration = () => {
    void registration.update().catch(() => {});
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      refreshRegistration();
    }
  };

  window.addEventListener("focus", refreshRegistration);
  window.addEventListener("pageshow", refreshRegistration);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    window.removeEventListener("focus", refreshRegistration);
    window.removeEventListener("pageshow", refreshRegistration);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let cleanup = () => {};

    const boot = async () => {
      if (isNativeApp()) {
        await unregisterServiceWorkersAndStaticCaches();
        return;
      }

      if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
        return;
      }

      try {
        cleanup = (await registerWebServiceWorker()) ?? (() => {});
      } catch {
        // Keep registration failures silent for end users.
      }
    };

    void boot();

    return () => {
      cleanup();
    };
  }, []);

  return null;
}
