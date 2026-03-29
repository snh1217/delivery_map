import type { LatLng } from "@/types";
import { isNativeApp } from "@/lib/native/runtime";

export type NativeLocationWatchHandle = {
  remove: () => Promise<void>;
};

export async function getCurrentLocation(): Promise<LatLng> {
  if (isNativeApp()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    await Geolocation.requestPermissions().catch(() => null);
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
    });
    return {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
    };
  }

  return new Promise<LatLng>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GEOLOCATION_UNAVAILABLE"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  });
}

export async function watchCurrentLocation(
  onChange: (coord: LatLng) => void,
  onError?: (error: unknown) => void,
): Promise<NativeLocationWatchHandle | null> {
  if (isNativeApp()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    await Geolocation.requestPermissions().catch(() => null);
    const watchId = await Geolocation.watchPosition(
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      },
      (position, error) => {
        if (error) {
          onError?.(error);
          return;
        }
        if (!position) return;
        onChange({ lat: position.coords.latitude, lon: position.coords.longitude });
      },
    );

    return {
      remove: async () => {
        await Geolocation.clearWatch({ id: watchId });
      },
    };
  }

  if (!navigator.geolocation) {
    onError?.(new Error("GEOLOCATION_UNAVAILABLE"));
    return null;
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      onChange({ lat: position.coords.latitude, lon: position.coords.longitude });
    },
    (error) => onError?.(error),
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
    },
  );

  return {
    remove: async () => {
      navigator.geolocation.clearWatch(watchId);
    },
  };
}
