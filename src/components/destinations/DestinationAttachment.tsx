"use client";

import { useMemo, useRef, useState } from "react";
import { pickImageFileFromDevice } from "@/lib/native/camera";

type Props = {
  isAdmin: boolean;
  onApplyAddress: (address: string) => void;
};

export function DestinationAttachment({ isAdmin, onApplyAddress }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [cropRatio, setCropRatio] = useState(42);
  const [thresholdEnabled, setThresholdEnabled] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrRawPreview, setOcrRawPreview] = useState("");
  const [ocrAddressDraft, setOcrAddressDraft] = useState("");
  const [ocrPreviewImage, setOcrPreviewImage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const hasFile = Boolean(file);
  const canRunOcr = isAdmin && hasFile && !running;
  const fileLabel = useMemo(() => (file ? `${file.name} (${Math.round(file.size / 1024)}KB)` : "첨부된 사진 없음"), [file]);

  const setPickedFile = (picked: File | null) => {
    setFile(picked);
    setOcrOpen(false);
    setOcrProgress(0);
    setOcrStatus("");
    setOcrError(null);
    setOcrRawPreview("");
    setOcrAddressDraft("");
    setOcrPreviewImage(null);
    setToast(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(picked ? URL.createObjectURL(picked) : null);
  };

  const onPickImage = async () => {
    const nativeFile = await pickImageFileFromDevice().catch(() => null);
    if (nativeFile) {
      setPickedFile(nativeFile);
      return;
    }
    inputRef.current?.click();
  };

  const runOcr = async () => {
    if (!file || !isAdmin) return;
    setRunning(true);
    setOcrError(null);
    setToast(null);
    setOcrProgress(1);
    setOcrStatus("인식 준비 중...");
    setOcrOpen(true);
    try {
      const { extractAddressFromScreenshotFile } = await import("@/lib/ocr/ocrProvider");
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
          if (status) setOcrStatus(status);
        },
      });
      setOcrRawPreview(result.sanitizedText);
      setOcrAddressDraft(result.address ?? "");
      setOcrPreviewImage(result.previewDataUrl);
      if (!result.address) {
        setOcrError("주소를 확실히 찾지 못했습니다. 결과를 직접 편집 후 적용하세요.");
      }
    } catch (e) {
      setOcrError(e instanceof Error ? e.message : "OCR 처리 실패");
    } finally {
      setRunning(false);
    }
  };

  const applyToRow = () => {
    const address = ocrAddressDraft.trim();
    if (!address) {
      setOcrError("적용할 주소가 없습니다.");
      return;
    }
    onApplyAddress(address);
    setToast("해당 도착지에 OCR 주소를 적용하고 자동 검색을 시작했습니다.");
    setOcrOpen(false);
  };

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-medium text-slate-700">사진 첨부 (0~1장)</div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
            onClick={() => void onPickImage()}
          >
            사진
          </button>
          {hasFile ? (
            <button
              type="button"
              className="h-8 rounded-md border border-rose-300 bg-white px-2 text-xs text-rose-700"
              onClick={() => setPickedFile(null)}
            >
              삭제
            </button>
          ) : null}
          {isAdmin && hasFile ? (
            <button
              type="button"
              className="h-8 rounded-md border border-cyan-300 bg-cyan-50 px-2 text-xs text-cyan-800 disabled:opacity-50"
              onClick={() => void runOcr()}
              disabled={!canRunOcr}
            >
              {running ? "OCR 중..." : "OCR로 주소 채우기"}
            </button>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)}
      />

      <p className="mt-1 text-[11px] text-slate-500">{fileLabel}</p>

      {previewUrl ? (
        <div className="mt-2 flex items-start gap-2">
          <img src={previewUrl} alt="첨부 사진" className="h-16 w-16 rounded object-cover" />
          <div className="min-w-0 flex-1 text-[11px] text-slate-500">
            <p>관리자만 OCR로 주소 자동 입력 가능</p>
            {!isAdmin ? <p className="mt-1">현재 계정은 관리자 권한이 없어 OCR 기능이 숨김 처리됩니다.</p> : null}
          </div>
        </div>
      ) : null}

      {ocrOpen && isAdmin && hasFile ? (
        <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-white p-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] text-slate-600">
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
            <label className="mt-4 inline-flex items-center gap-2 text-[11px] text-slate-700 sm:mt-0">
              <input
                type="checkbox"
                checked={thresholdEnabled}
                onChange={(e) => setThresholdEnabled(e.target.checked)}
              />
              threshold(이진화)
            </label>
          </div>

          <div className="h-2 rounded bg-slate-100">
            <div className="h-2 rounded bg-cyan-600 transition-all" style={{ width: `${ocrProgress}%` }} />
          </div>
          <p className="text-[11px] text-slate-600">{ocrStatus || (running ? "인식 중..." : "대기")}</p>

          {ocrPreviewImage ? (
            <img src={ocrPreviewImage} alt="OCR 전처리 미리보기" className="max-h-40 w-full rounded object-contain" />
          ) : null}

          <label className="block text-[11px] text-slate-700">
            OCR 추출 주소 (편집 가능)
            <textarea
              className="mt-1 h-20 w-full rounded-lg border border-slate-300 p-2 text-sm"
              value={ocrAddressDraft}
              onChange={(e) => setOcrAddressDraft(e.target.value)}
              placeholder="추출된 주소를 확인 후 이 Row에 적용"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="h-9 rounded-lg bg-cyan-700 text-xs font-medium text-white disabled:opacity-50"
              onClick={applyToRow}
              disabled={!ocrAddressDraft.trim()}
            >
              이 Row에 적용
            </button>
            <button
              type="button"
              className="h-9 rounded-lg border border-slate-300 bg-white text-xs disabled:opacity-50"
              onClick={() => void runOcr()}
              disabled={running}
            >
              다시 인식
            </button>
          </div>

          <details className="rounded border border-slate-200 p-2">
            <summary className="cursor-pointer text-[11px] font-medium text-slate-700">OCR 원문 보기(전화번호 마스킹)</summary>
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-[10px] text-slate-600">{ocrRawPreview || "-"}</pre>
          </details>
        </div>
      ) : null}

      {ocrError ? <p className="mt-2 text-xs text-rose-600">{ocrError}</p> : null}
      {toast ? <p className="mt-2 text-xs text-emerald-700">{toast}</p> : null}
    </div>
  );
}
