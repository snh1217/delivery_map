import { isNativeApp } from "@/lib/native/runtime";

export async function shareText(payload: { title: string; text: string }) {
  if (isNativeApp()) {
    const { Share } = await import("@capacitor/share");
    await Share.share({
      title: payload.title,
      text: payload.text,
      dialogTitle: payload.title,
    });
    return true;
  }

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    await navigator.share({ title: payload.title, text: payload.text });
    return true;
  }

  return false;
}
