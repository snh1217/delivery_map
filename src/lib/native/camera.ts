import { isNativeApp } from "@/lib/native/runtime";

function dataUrlToFile(dataUrl: string, filename: string) {
  const [header, body] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] ?? "image/jpeg";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

export async function pickImageFileFromDevice(): Promise<File | null> {
  if (!isNativeApp()) {
    return null;
  }

  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Prompt,
    quality: 90,
    promptLabelHeader: "사진 선택",
    promptLabelPhoto: "앨범에서 선택",
    promptLabelPicture: "카메라 촬영",
  });

  if (!photo.dataUrl) {
    return null;
  }

  return dataUrlToFile(photo.dataUrl, `capture-${Date.now()}.jpg`);
}
