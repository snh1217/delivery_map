"use client";

export async function runServerOcr(file: File) {
  const form = new FormData();
  form.append("image", file);

  const response = await fetch("/api/ocr", {
    method: "POST",
    body: form,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    text?: string;
    confidence?: number;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "서버 OCR 요청 실패");
  }

  return {
    text: payload.text ?? "",
    confidence: payload.confidence,
  };
}

