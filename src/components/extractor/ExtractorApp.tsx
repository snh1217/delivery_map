"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { pickImageFileFromDevice } from "@/lib/native/camera";
import { shareText } from "@/lib/native/share";
import type { SessionUser } from "@/types";

type Props = {
  user: SessionUser | null;
};

export function ExtractorApp({ user }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [cropRatio, setCropRatio] = useState(42);
  const [thresholdEnabled, setThresholdEnabled] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState("");
  const [preprocessedPreviewUrl, setPreprocessedPreviewUrl] = useState<string | null>(null);
  const [ocrRawText, setOcrRawText] = useState("");
  const [ocrAddressDraft, setOcrAddressDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [sending, setSending] = useState(false);

  const previewLabel = useMemo(() => {
    if (!file) return "스크린샷 선택 또는 촬영";
    return `${file.name} (${Math.round(file.size / 1024)}KB)`;
  }, [file]);

  const onPickFile = (picked: File | null) => {
    setFile(picked);
    setError(null);
    setToast(null);
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
    setRunning(true);
    setError(null);
    setToast(null);
    setOcrProgress(1);
    setOcrStatusText("인식 준비 중...");
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
          if (status) setOcrStatusText(status);
        },
      });
      setPreprocessedPreviewUrl(result.previewDataUrl);
      setOcrRawText(result.sanitizedText);
      setOcrAddressDraft(result.address ?? "");
      if (!result.address) {
        setError("주소를 정확히 찾지 못했습니다. 결과를 직접 편집한 뒤 사용하세요.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "OCR 처리 실패");
    } finally {
      setRunning(false);
    }
  };

  const onCopy = async () => {
    const text = ocrAddressDraft.trim();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setToast("주소를 클립보드에 복사했습니다. 삼성 기기 동기화가 켜져 있으면 다른 폰에서도 바로 붙여넣을 수 있습니다.");
  };

  const onShare = async () => {
    const text = ocrAddressDraft.trim();
    if (!text) return;
    await shareText({ title: "구역 추출 주소", text });
  };

  const onSendToMainApp = async () => {
    const text = ocrAddressDraft.trim();
    if (!text) {
      setError("전송할 주소가 없습니다.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/ocr-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractedText: text, rawText: ocrRawText, source: "extractor" }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "전송 실패");
      }
      setToast("B폰 메인 앱으로 주소를 보냈습니다. 메인 앱의 받은 주소 카드에서 바로 추가할 수 있습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "전송 실패");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">Extractor</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">구역 추출기</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              스크린샷에서 주소만 뽑아 A폰에서 복사하거나, 같은 계정의 B폰 퀵배달 메이커로 바로 보낼 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/app" className="inline-flex h-10 items-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700">
              메인 앱으로 가기
            </Link>
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-xl bg-cyan-700 px-4 text-sm font-medium text-white"
              onClick={() => void onPickImage()}
            >
              스크린샷 선택/촬영
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold text-slate-800">방법 1. 삼성 클립보드 방식</div>
            <p className="mt-1 text-xs leading-5 text-slate-600">A폰에서 주소를 복사한 뒤, 삼성 계정의 클립보드 동기화로 B폰에서 그대로 붙여넣는 방식입니다.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold text-slate-800">방법 2. 전송함 방식</div>
            <p className="mt-1 text-xs leading-5 text-slate-600">A폰에서 주소를 보내면, B폰 메인 앱 도착지 목록 상단의 받은 주소 카드에서 바로 추가할 수 있습니다.</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
        />

        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-medium text-slate-700">원본 미리보기</div>
              <p className="mt-1 text-[11px] text-slate-500">{previewLabel}</p>
              {imagePreviewUrl ? (
                <div className="relative mt-2 h-72 w-full overflow-hidden rounded-xl bg-white">
                  <Image src={imagePreviewUrl} alt="추출 원본" fill unoptimized className="object-contain" />
                </div>
              ) : (
                <div className="mt-2 flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-400">
                  아직 선택한 이미지가 없습니다.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 p-3">
              <label className="block text-xs text-slate-700">
                하단 크롭 비율 ({cropRatio}%)
                <input type="range" min={30} max={55} value={cropRatio} onChange={(e) => setCropRatio(Number(e.target.value))} className="mt-1 w-full" />
              </label>
              <label className="mt-3 inline-flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={thresholdEnabled} onChange={(e) => setThresholdEnabled(e.target.checked)} />
                threshold(이진화) 사용
              </label>
              <button
                type="button"
                className="mt-3 h-11 w-full rounded-xl bg-slate-900 text-sm font-medium text-white disabled:opacity-50"
                onClick={() => void runOcr()}
                disabled={!file || running}
              >
                {running ? `인식 중... ${ocrProgress}%` : "OCR 시작"}
              </button>
              <p className="mt-2 text-[11px] text-slate-500">로그인 계정: {user?.phone ?? "-"}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 p-3">
              <div className="text-xs font-medium text-slate-700">OCR 진행 상태</div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-cyan-600 transition-all" style={{ width: `${ocrProgress}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-600">{ocrStatusText || "대기"}</p>
              {preprocessedPreviewUrl ? (
                <div className="relative mt-3 h-40 w-full overflow-hidden rounded-xl bg-slate-50">
                  <Image src={preprocessedPreviewUrl} alt="전처리 미리보기" fill unoptimized className="object-contain" />
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 p-3">
              <label className="block text-xs font-medium text-slate-700">추출 주소 (직접 편집 가능)</label>
              <textarea
                className="mt-2 h-28 w-full rounded-xl border border-slate-300 p-3 text-sm"
                value={ocrAddressDraft}
                onChange={(e) => setOcrAddressDraft(e.target.value)}
                placeholder="OCR 결과 주소가 여기에 표시됩니다. 필요하면 직접 수정하세요."
              />
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button type="button" className="h-11 rounded-xl border border-slate-300 bg-white text-sm font-medium" onClick={() => void onCopy()} disabled={!ocrAddressDraft.trim()}>
                  복사
                </button>
                <button type="button" className="h-11 rounded-xl border border-slate-300 bg-white text-sm font-medium" onClick={() => void onShare()} disabled={!ocrAddressDraft.trim()}>
                  공유
                </button>
                <button type="button" className="h-11 rounded-xl bg-cyan-700 text-sm font-medium text-white disabled:opacity-50" onClick={() => void onSendToMainApp()} disabled={!ocrAddressDraft.trim() || sending}>
                  {sending ? "전송 중..." : "B폰으로 보내기"}
                </button>
              </div>
            </div>

            <details className="rounded-2xl border border-slate-200 p-3">
              <summary className="cursor-pointer text-xs font-medium text-slate-700">OCR 원문 보기 (전화번호 마스킹)</summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-slate-600">{ocrRawText || "-"}</pre>
            </details>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        {toast ? <p className="mt-3 text-sm text-emerald-700">{toast}</p> : null}
      </section>
    </main>
  );
}
