"use client";

import { useMemo, useRef, useState } from "react";
import { pickImageFileFromDevice } from "@/lib/native/camera";
import { extractAddressFromScreenshotFile } from "@/lib/ocr/ocrProvider";

type Props = {
  onApplyAddress: (address: string) => Promise<void> | void;
};

type OcrState = "idle" | "processing" | "done" | "error";

export function ScreenshotAdd({ onApplyAddress }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [cropRatio, setCropRatio] = useState(42);
  const [thresholdEnabled, setThresholdEnabled] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState<string>("");
  const [ocrState, setOcrState] = useState<OcrState>("idle");
  const [preprocessedPreviewUrl, setPreprocessedPreviewUrl] = useState<string | null>(null);
  const [ocrRawText, setOcrRawText] = useState("");
  const [ocrAddressDraft, setOcrAddressDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const canRun = Boolean(file) && ocrState !== "processing";
  const canApply = Boolean(ocrAddressDraft.trim()) && ocrState !== "processing" && !applying;

  const previewLabel = useMemo(() => {
    if (!file) return "스크린샷 선택 또는 촬영";
    return `${file.name} (${Math.round(file.size / 1024)}KB)`;
  }, [file]);

  const onPickFile = (picked: File | null) => {
    setFile(picked);
    setError(null);
    setOcrState("idle");
    setOcrProgress(0);
    setOcrStatusText("");
    setPreprocessedPreviewUrl(null);
    setOcrRawText("");
    setOcrAddressDraft("");
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(picked ? URL.createObjectURL(picked) : null);
  };

  const onPickImage = async () => {
    const nativeFile = await pickImageFileFromDevice().catch(() => null);
    if (nativeFile) {
      onPickFile(nativeFile);
      return;
    }
    fileInputRef.current?.click();
  };

  const runOcr = async () => {
    if (!file) return;
    setError(null);
    setToast(null);
    setOcrState("processing");
    setOcrProgress(1);
    setOcrStatusText("인식 준비 중...");

    try {
      const result = await extractAddressFromScreenshotFile({
        file,
        preprocess: {
          bottomCropRatio: cropRatio / 100,
          contrast: 1.8,
          upscale: 2,
          thresholdEnabled,
          thresholdValue: 165,
        },
        onProgress: (progress, status) => {
          setOcrProgress(progress);
          if (status) setOcrStatusText(status);
        },
      });

      setPreprocessedPreviewUrl(result.previewDataUrl);
      setOcrRawText(result.sanitizedText);
      setOcrAddressDraft(result.address ?? "");
      setOcrState(result.address ? "done" : "error");
      if (!result.address) {
        setError("주소를 확실히 추출하지 못했습니다. 결과를 직접 편집 후 적용하세요.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "OCR 처리 실패");
      setOcrState("error");
    }
  };

  const apply = async () => {
    const address = ocrAddressDraft.trim();
    if (!address) {
      setError("적용할 주소가 없습니다.");
      return;
    }
    setApplying(true);
    setError(null);
    try {
      await onApplyAddress(address);
      setToast("도착지 추가 요청을 적용했습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "도착지 추가 적용 실패");
    } finally {
      setApplying(false);
    }
  };

  const cancel = () => {
    onPickFile(null);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">스크린샷 OCR로 도착지 추가</h3>
        <span className="text-[11px] text-slate-500">관리자 전용</span>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <button
          type="button"
          className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
          onClick={() => void onPickImage()}
        >
          스크린샷 선택/촬영
        </button>
        <button
          type="button"
          className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm disabled:opacity-50"
          onClick={() => void runOcr()}
          disabled={!canRun}
        >
          다시 인식
        </button>
        <button
          type="button"
          className="h-11 rounded-lg border border-rose-300 bg-white px-3 text-sm text-rose-700"
          onClick={cancel}
        >
          취소
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
      />

      <p className="mt-2 text-xs text-slate-500">{previewLabel}</p>

      {imagePreviewUrl ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="mb-1 text-xs font-medium text-slate-700">원본 미리보기</div>
              <img src={imagePreviewUrl} alt="스크린샷 미리보기" className="max-h-64 w-full rounded object-contain" />
            </div>

            <div className="rounded-lg border border-slate-200 p-2">
              <label className="block text-xs text-slate-700">
                하단 크롭 비율 ({cropRatio}%)
                <input
                  type="range"
                  min={30}
                  max={55}
                  value={cropRatio}
                  onChange={(e) => setCropRatio(Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </label>
              <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={thresholdEnabled}
                  onChange={(e) => setThresholdEnabled(e.target.checked)}
                />
                threshold(이진화) 사용
              </label>
              <button
                type="button"
                className="mt-2 h-10 w-full rounded-lg bg-slate-900 text-sm font-medium text-white disabled:opacity-50"
                onClick={() => void runOcr()}
                disabled={!canRun}
              >
                OCR 시작
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="rounded-lg border border-slate-200 p-2">
              <div className="mb-1 text-xs font-medium text-slate-700">OCR 진행 상태</div>
              <div className="h-2 rounded bg-slate-100">
                <div className="h-2 rounded bg-cyan-600 transition-all" style={{ width: `${ocrProgress}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {ocrState === "processing" ? `인식 중… ${ocrProgress}% (${ocrStatusText || "processing"})` : ocrStatusText || "-"}
              </p>
            </div>

            {preprocessedPreviewUrl ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="mb-1 text-xs font-medium text-slate-700">전처리/OCR 대상 미리보기</div>
                <img src={preprocessedPreviewUrl} alt="전처리 미리보기" className="max-h-48 w-full rounded object-contain" />
              </div>
            ) : null}

            <div className="rounded-lg border border-slate-200 p-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">추출 주소(편집 가능)</label>
              <textarea
                className="h-20 w-full rounded-lg border border-slate-300 p-2 text-sm"
                value={ocrAddressDraft}
                onChange={(e) => setOcrAddressDraft(e.target.value)}
                placeholder="OCR 결과에서 주소가 추출되면 여기에 표시됩니다."
              />
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className="h-10 rounded-lg bg-cyan-700 text-sm font-medium text-white disabled:opacity-50"
                  onClick={() => void apply()}
                  disabled={!canApply}
                >
                  {applying ? "적용 중..." : "적용하여 도착지 추가"}
                </button>
                <button
                  type="button"
                  className="h-10 rounded-lg border border-slate-300 bg-white text-sm disabled:opacity-50"
                  onClick={() => void runOcr()}
                  disabled={!canRun}
                >
                  다시 인식
                </button>
              </div>
            </div>

            <details className="rounded-lg border border-slate-200 p-2">
              <summary className="cursor-pointer text-xs font-medium text-slate-700">OCR 원문 보기(전화번호 마스킹)</summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-slate-600">{ocrRawText || "-"}</pre>
            </details>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      {toast ? <p className="mt-2 text-sm text-emerald-700">{toast}</p> : null}
      <p className="mt-2 text-[11px] text-slate-500">
        기본 OCR은 브라우저에서 실행되며 이미지는 서버에 업로드/저장하지 않습니다. (전화번호는 OCR 결과에서 마스킹 처리)
      </p>
    </section>
  );
}
