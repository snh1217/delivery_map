import { isNativeApp } from "@/lib/native/runtime";

export async function addNativeResumeListener(onResume: () => void) {
  if (!isNativeApp()) {
    return () => {};
  }

  const { App } = await import("@capacitor/app");
  const handle = await App.addListener("resume", onResume);
  return () => {
    void handle.remove();
  };
}
