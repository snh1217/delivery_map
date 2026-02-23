"use client";

export type TesseractOcrProgress = {
  status: string;
  progress: number;
};

export async function runTesseractOcr(
  image: HTMLCanvasElement | string | Blob,
  options?: {
    onProgress?: (progress: TesseractOcrProgress) => void;
  },
) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("kor", 1, {
    logger: (m) => {
      if (typeof m.progress === "number") {
        options?.onProgress?.({
          status: m.status ?? "processing",
          progress: Math.round(m.progress * 100),
        });
      }
    },
  });

  try {
    const result = await worker.recognize(image);
    return {
      text: result.data.text ?? "",
      confidence: typeof result.data.confidence === "number" ? result.data.confidence / 100 : undefined,
    };
  } finally {
    await worker.terminate();
  }
}

