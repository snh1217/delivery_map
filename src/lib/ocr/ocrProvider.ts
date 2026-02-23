"use client";

import { extractAddressFromText, maskPhoneNumbers, normalizeAddress } from "@/lib/ocr/addressExtract";
import { preprocessScreenshotForOcr, type OcrPreprocessOptions } from "@/lib/ocr/preprocess";
import { runServerOcr } from "@/lib/ocr/serverOcrClient";
import { runTesseractOcr } from "@/lib/ocr/tesseract";

export type OcrProviderName = "tesseract" | "googlevision" | "clova";

export type OcrAddressExtractResult = {
  rawText: string;
  sanitizedText: string;
  address: string | null;
  confidence?: number;
  previewDataUrl: string;
};

export function getClientOcrProvider(): OcrProviderName {
  const raw = (process.env.NEXT_PUBLIC_OCR_PROVIDER || process.env.OCR_PROVIDER || "tesseract").toLowerCase();
  if (raw === "googlevision" || raw === "clova") return raw;
  return "tesseract";
}

export async function extractAddressFromScreenshotFile(params: {
  file: File;
  preprocess: OcrPreprocessOptions;
  onProgress?: (progress: number, status?: string) => void;
}) {
  params.onProgress?.(5, "이미지 전처리 준비");
  const pre = await preprocessScreenshotForOcr(params.file, params.preprocess);

  const provider = getClientOcrProvider();
  params.onProgress?.(20, `OCR 실행 (${provider})`);

  const ocrResult =
    provider === "tesseract"
      ? await runTesseractOcr(pre.finalCanvas, {
          onProgress: (p) => params.onProgress?.(20 + Math.round(p.progress * 0.75), p.status),
        })
      : await runServerOcr(params.file);

  params.onProgress?.(95, "주소 후보 추출");
  const rawText = ocrResult.text ?? "";
  const sanitizedText = maskPhoneNumbers(rawText);
  const address = extractAddressFromText(rawText);

  params.onProgress?.(100, "완료");
  return {
    rawText,
    sanitizedText,
    address: address ? normalizeAddress(address) : null,
    confidence: ocrResult.confidence,
    previewDataUrl: pre.previewDataUrl,
  } satisfies OcrAddressExtractResult;
}

