"use client";

export type OcrPreprocessOptions = {
  bottomCropRatio: number; // 0.30 ~ 0.55
  contrast: number; // 1.0 ~ 2.5
  upscale: number; // 1 ~ 2
  thresholdEnabled: boolean;
  thresholdValue: number; // 0-255
};

export type OcrPreprocessResult = {
  sourceWidth: number;
  sourceHeight: number;
  croppedCanvas: HTMLCanvasElement;
  finalCanvas: HTMLCanvasElement;
  previewDataUrl: string;
  detectedBox: { x: number; y: number; width: number; height: number } | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

async function loadImageBitmapFromFile(file: File): Promise<ImageBitmap> {
  if ("createImageBitmap" in window) {
    return await createImageBitmap(file);
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이미지 캔버스 컨텍스트 생성 실패");
    ctx.drawImage(img, 0, 0);
    return await createImageBitmap(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function cropBottom(img: ImageBitmap, ratio: number) {
  const cropRatio = clamp(ratio, 0.3, 0.55);
  const cropHeight = Math.max(1, Math.round(img.height * cropRatio));
  const sy = img.height - cropHeight;
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = cropHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("크롭 캔버스 생성 실패");
  ctx.drawImage(img, 0, sy, img.width, cropHeight, 0, 0, img.width, cropHeight);
  return canvas;
}

function toGrayscaleBrightness(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function detectDarkBox(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { width, height } = canvas;
  if (width < 40 || height < 40) return null;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const sampleStep = Math.max(2, Math.floor(Math.min(width, height) / 120));
  const darkThreshold = 80;
  const rowDarkRatios = new Array<number>(height).fill(0);

  for (let y = 0; y < height; y += sampleStep) {
    let dark = 0;
    let total = 0;
    for (let x = 0; x < width; x += sampleStep) {
      const idx = (y * width + x) * 4;
      const bright = toGrayscaleBrightness(data[idx], data[idx + 1], data[idx + 2]);
      if (bright < darkThreshold) dark += 1;
      total += 1;
    }
    rowDarkRatios[y] = total ? dark / total : 0;
  }

  let bestRowBand: { y1: number; y2: number; score: number } | null = null;
  let currentStart = -1;
  let currentScore = 0;
  for (let y = 0; y < height; y += sampleStep) {
    const ratio = rowDarkRatios[y];
    if (ratio > 0.28) {
      if (currentStart < 0) currentStart = y;
      currentScore += ratio;
    } else if (currentStart >= 0) {
      const y2 = Math.min(height - 1, y);
      const score = currentScore * (y2 - currentStart + 1);
      if (!bestRowBand || score > bestRowBand.score) {
        bestRowBand = { y1: currentStart, y2, score };
      }
      currentStart = -1;
      currentScore = 0;
    }
  }
  if (currentStart >= 0) {
    const y2 = height - 1;
    const score = currentScore * (y2 - currentStart + 1);
    if (!bestRowBand || score > bestRowBand.score) {
      bestRowBand = { y1: currentStart, y2, score };
    }
  }
  if (!bestRowBand) return null;

  const y1 = clamp(bestRowBand.y1 - sampleStep * 2, 0, height - 1);
  const y2 = clamp(bestRowBand.y2 + sampleStep * 2, 0, height - 1);

  const colDarkRatios = new Array<number>(width).fill(0);
  for (let x = 0; x < width; x += sampleStep) {
    let dark = 0;
    let total = 0;
    for (let y = y1; y <= y2; y += sampleStep) {
      const idx = (y * width + x) * 4;
      const bright = toGrayscaleBrightness(data[idx], data[idx + 1], data[idx + 2]);
      if (bright < darkThreshold) dark += 1;
      total += 1;
    }
    colDarkRatios[x] = total ? dark / total : 0;
  }

  let bestColBand: { x1: number; x2: number; score: number } | null = null;
  currentStart = -1;
  currentScore = 0;
  for (let x = 0; x < width; x += sampleStep) {
    const ratio = colDarkRatios[x];
    if (ratio > 0.18) {
      if (currentStart < 0) currentStart = x;
      currentScore += ratio;
    } else if (currentStart >= 0) {
      const x2 = Math.min(width - 1, x);
      const score = currentScore * (x2 - currentStart + 1);
      if (!bestColBand || score > bestColBand.score) {
        bestColBand = { x1: currentStart, x2, score };
      }
      currentStart = -1;
      currentScore = 0;
    }
  }
  if (currentStart >= 0) {
    const x2 = width - 1;
    const score = currentScore * (x2 - currentStart + 1);
    if (!bestColBand || score > bestColBand.score) {
      bestColBand = { x1: currentStart, x2, score };
    }
  }

  if (!bestColBand) return null;

  const box = {
    x: clamp(bestColBand.x1 - sampleStep * 3, 0, width - 1),
    y: clamp(y1 - sampleStep * 2, 0, height - 1),
    width: clamp(bestColBand.x2 - bestColBand.x1 + sampleStep * 6, 1, width),
    height: clamp(y2 - y1 + sampleStep * 4, 1, height),
  };

  if (box.width < width * 0.25 || box.height < height * 0.15) {
    return null;
  }

  return box;
}

function cropByBox(canvas: HTMLCanvasElement, box: { x: number; y: number; width: number; height: number }) {
  const out = document.createElement("canvas");
  out.width = box.width;
  out.height = box.height;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("박스 크롭 캔버스 생성 실패");
  ctx.drawImage(canvas, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
  return out;
}

function applyPreprocess(canvas: HTMLCanvasElement, opts: OcrPreprocessOptions) {
  const source = canvas;
  const maxDim = 2200;
  const scale = clamp(opts.upscale, 1, 2);
  const targetW = Math.min(maxDim, Math.max(1, Math.round(source.width * scale)));
  const targetH = Math.min(maxDim, Math.max(1, Math.round(source.height * scale)));

  const out = document.createElement("canvas");
  out.width = targetW;
  out.height = targetH;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("전처리 캔버스 생성 실패");
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, targetW, targetH);

  const imageData = ctx.getImageData(0, 0, targetW, targetH);
  const data = imageData.data;
  const contrast = clamp(opts.contrast, 1, 2.5);
  const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));

  for (let i = 0; i < data.length; i += 4) {
    const gray = toGrayscaleBrightness(data[i], data[i + 1], data[i + 2]);
    let v = factor * (gray - 128) + 128;
    v = clamp(v, 0, 255);
    if (opts.thresholdEnabled) {
      v = v >= opts.thresholdValue ? 255 : 0;
    }
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

export async function preprocessScreenshotForOcr(
  file: File,
  options: OcrPreprocessOptions,
): Promise<OcrPreprocessResult> {
  const bitmap = await loadImageBitmapFromFile(file);
  try {
    const firstCrop = cropBottom(bitmap, options.bottomCropRatio);
    const detectedBox = detectDarkBox(firstCrop);
    const secondCrop = detectedBox ? cropByBox(firstCrop, detectedBox) : firstCrop;
    const finalCanvas = applyPreprocess(secondCrop, options);
    return {
      sourceWidth: bitmap.width,
      sourceHeight: bitmap.height,
      croppedCanvas: secondCrop,
      finalCanvas,
      previewDataUrl: finalCanvas.toDataURL("image/png"),
      detectedBox,
    };
  } finally {
    bitmap.close();
  }
}

