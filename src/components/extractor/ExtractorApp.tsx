"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pickImageFileFromDevice } from "@/lib/native/camera";
import { ExtractorBridge, type ExtractorBridgeStatus } from "@/lib/native/extractorBridge";
import { exitNativeApp, isNativeApp } from "@/lib/native/runtime";
import { shareText } from "@/lib/native/share";
import type { SessionUser } from "@/types";

type Props = {
  user: SessionUser | null;
};

export function ExtractorApp({ user }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectionSurfaceRef = useRef<HTMLDivElement>(null);
  const lastAutoSentAddressRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [cropRatio, setCropRatio] = useState(42);
  const [manualCropEnabled, setManualCropEnabled] = useState(false);
  const [manualCropRect, setManualCropRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
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
  const [nativeStatus, setNativeStatus] = useState<ExtractorBridgeStatus | null>(null);
  const [nativeBusy, setNativeBusy] = useState(false);
  const [overlaySizeDp, setOverlaySizeDp] = useState(64);
  const [overlayOpacity, setOverlayOpacity] = useState(0.94);
  const [overlayLocked, setOverlayLocked] = useState(false);

  const previewLabel = useMemo(() => {
    if (!file) return "스크린샷 선택 또는 촬영";
    return `${file.name} (${Math.round(file.size / 1024)}KB)`;
  }, [file]);

  const onPickFile = useCallback((picked: File | null) => {
    setFile(picked);
    setError(null);
    setToast(null);
    setOcrProgress(0);
    setOcrStatusText("");
    setPreprocessedPreviewUrl(null);
    setOcrRawText("");
    setOcrAddressDraft("");
    lastAutoSentAddressRef.current = null;
    setManualCropRect(null);
    setDragStart(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(picked ? URL.createObjectURL(picked) : null);
  }, [imagePreviewUrl]);

  const refreshNativeStatus = async () => {
    if (!isNativeApp()) return;
    try {
      const status = await ExtractorBridge.getStatus();
      setNativeStatus(status);
      setOverlaySizeDp(status.overlaySizeDp);
      setOverlayOpacity(status.overlayOpacity);
      setOverlayLocked(status.overlayLocked);
    } catch {
      setNativeStatus(null);
    }
  };

  useEffect(() => {
    void refreshNativeStatus();
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;
    const url = new URL(window.location.href);
    const fromCapture = url.searchParams.get("captured") === "1";
    if (!fromCapture) return;

    void (async () => {
      try {
        const result = await ExtractorBridge.consumeLastCapture();
        if (!result.dataUrl) return;
        const response = await fetch(result.dataUrl);
        const blob = await response.blob();
        const capturedFile = new File([blob], `extractor-capture-${Date.now()}.png`, {
          type: "image/png",
        });
        onPickFile(capturedFile);
        setToast("방금 캡처한 화면을 불러왔습니다. 원하는 구역을 바로 선택하거나 OCR을 시작하세요.");
      } catch {
        setError("캡처한 화면을 불러오지 못했습니다. 다시 시도해 주세요.");
      } finally {
        url.searchParams.delete("captured");
        window.history.replaceState({}, "", url.toString());
        void refreshNativeStatus();
      }
    })();
  }, [onPickFile]);

  const toRelativePoint = (clientX: number, clientY: number) => {
    const el = selectionSurfaceRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    return { x, y };
  };

  const beginSelection = (clientX: number, clientY: number) => {
    if (!manualCropEnabled) return;
    const point = toRelativePoint(clientX, clientY);
    if (!point) return;
    setDragStart(point);
    setManualCropRect({ x: point.x, y: point.y, width: 0.001, height: 0.001 });
  };

  const updateSelection = (clientX: number, clientY: number) => {
    if (!manualCropEnabled || !dragStart) return;
    const point = toRelativePoint(clientX, clientY);
    if (!point) return;
    const x = Math.min(dragStart.x, point.x);
    const y = Math.min(dragStart.y, point.y);
    const width = Math.abs(point.x - dragStart.x);
    const height = Math.abs(point.y - dragStart.y);
    setManualCropRect({ x, y, width, height });
  };

  const endSelection = () => {
    setDragStart(null);
  };

  const onPickImage = async () => {
    const nativeFile = await pickImageFileFromDevice().catch(() => null);
    if (nativeFile) {
      onPickFile(nativeFile);
      return;
    }
    fileInputRef.current?.click();
  };

  const onEnableOverlay = async () => {
    setNativeBusy(true);
    try {
      await ExtractorBridge.requestOverlayPermission();
      setToast("다른 앱 위에 표시 권한 화면을 열었습니다. 허용 후 다시 돌아와 주세요.");
    } catch {
      setError("오버레이 권한 요청을 열지 못했습니다.");
    } finally {
      setNativeBusy(false);
      setTimeout(() => void refreshNativeStatus(), 1000);
    }
  };

  const onStartOverlay = async () => {
    setNativeBusy(true);
    try {
      await ExtractorBridge.startOverlayBubble();
      setToast("떠있는 버튼을 시작했습니다. 퀵 프로그램 위에서 '추출'을 누르면 캡처 후 이 화면으로 돌아옵니다.");
    } catch {
      setError("떠있는 버튼을 시작하지 못했습니다. 먼저 다른 앱 위에 표시 권한을 허용해 주세요.");
    } finally {
      setNativeBusy(false);
      void refreshNativeStatus();
    }
  };

  const onStopOverlay = async () => {
    setNativeBusy(true);
    try {
      await ExtractorBridge.stopOverlayBubble();
      setToast("떠있는 버튼을 중지했습니다.");
    } catch {
      setError("떠있는 버튼을 중지하지 못했습니다.");
    } finally {
      setNativeBusy(false);
      void refreshNativeStatus();
    }
  };

  const onCaptureCurrentScreen = async () => {
    setNativeBusy(true);
    try {
      await ExtractorBridge.captureCurrentScreen();
      setToast("현재 화면 캡처 권한을 요청합니다.");
    } catch {
      setError("현재 화면 캡처를 시작하지 못했습니다.");
    } finally {
      setNativeBusy(false);
    }
  };

  const onSaveOverlaySettings = async () => {
    setNativeBusy(true);
    try {
      const status = await ExtractorBridge.updateOverlayConfig({
        sizeDp: overlaySizeDp,
        opacity: overlayOpacity,
        locked: overlayLocked,
      });
      setNativeStatus(status);
      setToast("오버레이 버튼 설정을 저장했습니다.");
    } catch {
      setError("오버레이 버튼 설정을 저장하지 못했습니다.");
    } finally {
      setNativeBusy(false);
    }
  };

  const sendToMainApp = useCallback(
    async (text: string, rawText: string, options?: { silent?: boolean; skipDuplicateCheck?: boolean }) => {
      const normalized = text.trim();
      if (!normalized) {
        throw new Error("전송할 주소가 없습니다.");
      }
      if (!options?.skipDuplicateCheck && lastAutoSentAddressRef.current === normalized) {
        return false;
      }

      setSending(true);
      setError(null);
      try {
        const response = await fetch("/api/ocr-transfers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extractedText: normalized, rawText, source: "extractor" }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(payload.message ?? "전송 실패");
        }
        lastAutoSentAddressRef.current = normalized;
        if (!options?.silent) {
          setToast("B폰 메인 앱으로 주소를 보냈습니다. 메인 앱의 받은 주소 카드에서 바로 추가할 수 있습니다.");
        }
        return true;
      } finally {
        setSending(false);
      }
    },
    [],
  );

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
          manualCropRect: manualCropEnabled ? manualCropRect : null,
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
      } else if (user?.isAllowed) {
        try {
          await sendToMainApp(result.address, result.sanitizedText, { silent: true });
          setToast("주소를 추출했고, 같은 계정의 B폰 메인 앱으로 자동 전송했습니다.");
        } catch (autoSendError) {
          setToast("주소는 추출했습니다. 자동 전송은 실패해서 복사/공유 또는 수동 전송이 필요합니다.");
          setError(autoSendError instanceof Error ? autoSendError.message : "자동 전송 실패");
        }
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
    try {
      await sendToMainApp(text, ocrRawText, { skipDuplicateCheck: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "전송 실패");
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

        {isNativeApp() ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-amber-900">앱 전용 빠른 추출</div>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  퀵 프로그램 위에서 떠있는 버튼으로 현재 화면을 캡처하고, 이 화면으로 돌아와 원하는 구역만 OCR할 수 있습니다.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full px-3 py-1 ${nativeStatus?.overlayPermission ? "bg-emerald-100 text-emerald-700" : "bg-white text-amber-900"}`}>
                  오버레이 {nativeStatus?.overlayPermission ? "허용" : "미허용"}
                </span>
                <span className={`rounded-full px-3 py-1 ${nativeStatus?.overlayRunning ? "bg-cyan-100 text-cyan-800" : "bg-white text-slate-700"}`}>
                  떠있는 버튼 {nativeStatus?.overlayRunning ? "실행 중" : "중지"}
                </span>
              </div>
            </div>
             <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <button type="button" className="h-11 rounded-xl border border-amber-300 bg-white text-sm font-medium text-amber-900 disabled:opacity-50" onClick={() => void onEnableOverlay()} disabled={nativeBusy}>
                권한 허용
              </button>
              <button type="button" className="h-11 rounded-xl bg-amber-600 text-sm font-medium text-white disabled:opacity-50" onClick={() => void onStartOverlay()} disabled={nativeBusy || !nativeStatus?.overlayPermission}>
                떠있는 버튼 시작
              </button>
              <button type="button" className="h-11 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 disabled:opacity-50" onClick={() => void onStopOverlay()} disabled={nativeBusy || !nativeStatus?.overlayRunning}>
                떠있는 버튼 중지
              </button>
              <button type="button" className="h-11 rounded-xl border border-cyan-300 bg-cyan-50 text-sm font-medium text-cyan-900 disabled:opacity-50" onClick={() => void onCaptureCurrentScreen()} disabled={nativeBusy}>
                지금 화면 캡처
              </button>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                className="h-10 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-medium text-rose-700"
                onClick={() => void exitNativeApp()}
              >
                앱 종료
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-white p-3">
              <div className="text-xs font-semibold text-slate-800">오버레이 버튼 설정</div>
              <div className="mt-3 grid gap-3">
                <label className="block text-xs text-slate-700">
                  버튼 크기 ({overlaySizeDp}dp)
                  <input
                    type="range"
                    min={44}
                    max={96}
                    step={4}
                    value={overlaySizeDp}
                    onChange={(e) => setOverlaySizeDp(Number(e.target.value))}
                    className="mt-1 w-full"
                  />
                </label>
                <label className="block text-xs text-slate-700">
                  투명도 ({Math.round(overlayOpacity * 100)}%)
                  <input
                    type="range"
                    min={45}
                    max={100}
                    step={5}
                    value={Math.round(overlayOpacity * 100)}
                    onChange={(e) => setOverlayOpacity(Number(e.target.value) / 100)}
                    className="mt-1 w-full"
                  />
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={overlayLocked}
                    onChange={(e) => setOverlayLocked(e.target.checked)}
                  />
                  위치 잠금 (드래그 방지)
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 disabled:opacity-50"
                    onClick={() => void onSaveOverlaySettings()}
                    disabled={nativeBusy}
                  >
                    설정 저장
                  </button>
                  <div className="flex items-center text-[11px] text-slate-500">
                    길게 누르면 버튼이 바로 꺼지고, 드래그한 위치는 자동으로 기억합니다.
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
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
                <div
                  ref={selectionSurfaceRef}
                  className="relative mt-2 h-72 w-full overflow-hidden rounded-xl bg-white touch-none"
                  onPointerDown={(e) => beginSelection(e.clientX, e.clientY)}
                  onPointerMove={(e) => updateSelection(e.clientX, e.clientY)}
                  onPointerUp={endSelection}
                  onPointerCancel={endSelection}
                  onPointerLeave={() => {
                    if (dragStart) endSelection();
                  }}
                >
                  <Image src={imagePreviewUrl} alt="추출 원본" fill unoptimized className="object-contain" />
                  {manualCropEnabled ? (
                    <>
                      <div className="pointer-events-none absolute inset-0 bg-slate-950/10" />
                      {manualCropRect ? (
                        <div
                          className="pointer-events-none absolute border-2 border-cyan-400 bg-cyan-300/15"
                          style={{
                            left: `${manualCropRect.x * 100}%`,
                            top: `${manualCropRect.y * 100}%`,
                            width: `${manualCropRect.width * 100}%`,
                            height: `${manualCropRect.height * 100}%`,
                          }}
                        />
                      ) : (
                        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-lg bg-slate-900/70 px-3 py-2 text-center text-xs text-white">
                          원하는 위치 박스를 손가락으로 그려 주세요.
                        </div>
                      )}
                    </>
                  ) : null}
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
                <input
                  type="checkbox"
                  checked={manualCropEnabled}
                  onChange={(e) => {
                    setManualCropEnabled(e.target.checked);
                    if (!e.target.checked) {
                      setManualCropRect(null);
                      setDragStart(null);
                    }
                  }}
                />
                원하는 구역 직접 선택
              </label>
              <label className="mt-3 inline-flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={thresholdEnabled} onChange={(e) => setThresholdEnabled(e.target.checked)} />
                threshold(이진화) 사용
              </label>
              {manualCropEnabled ? (
                <div className="mt-2 flex gap-2">
                  <button type="button" className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs" onClick={() => setManualCropRect(null)}>
                    선택 초기화
                  </button>
                  <div className="flex items-center text-[11px] text-slate-500">선택 영역이 있으면 하단 42% 대신 직접 선택한 박스로 OCR합니다.</div>
                </div>
              ) : null}
              <button type="button" className="mt-3 h-11 w-full rounded-xl bg-slate-900 text-sm font-medium text-white disabled:opacity-50" onClick={() => void runOcr()} disabled={!file || running}>
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
              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                로그인된 계정이면 OCR 성공 시 같은 계정의 B폰 메인 앱으로 자동 전송됩니다. 필요하면 복사/공유 또는 수동 전송도 계속 사용할 수 있습니다.
              </p>
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
