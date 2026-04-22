"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pickImageFileFromDevice } from "@/lib/native/camera";
import { addNativeResumeListener } from "@/lib/native/app";
import {
  ExtractorBridge,
  type ExtractorBridgeStatus,
  type ExtractorLaunchableApp,
  type PendingAccessibilityTransfer,
} from "@/lib/native/extractorBridge";
import { exitNativeApp, isNativeApp } from "@/lib/native/runtime";
import { shareText } from "@/lib/native/share";
import type { SessionUser } from "@/types";

type Props = {
  user: SessionUser | null;
};

const EXTRACTOR_APP_LATEST_VERSION = process.env.NEXT_PUBLIC_EXTRACTOR_ANDROID_LATEST_VERSION?.trim() || "1.0.13-extractor";
const EXTRACTOR_AUTO_TRANSFER_STORAGE_KEY = "delivery_map_extractor_auto_transfer_v1";

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
  const [diagnosticCode, setDiagnosticCode] = useState<string | null>(null);
  const [diagnosticHint, setDiagnosticHint] = useState<string | null>(null);
  const [autoTransferEnabled, setAutoTransferEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem(EXTRACTOR_AUTO_TRANSFER_STORAGE_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const [incomingTransferMeta, setIncomingTransferMeta] = useState<PendingAccessibilityTransfer | null>(null);
  const [targetAppsOpen, setTargetAppsOpen] = useState(false);
  const [targetAppsLoading, setTargetAppsLoading] = useState(false);
  const [targetApps, setTargetApps] = useState<ExtractorLaunchableApp[]>([]);
  const [targetAppSearch, setTargetAppSearch] = useState("");
  const [lastReturnPackage, setLastReturnPackage] = useState<string | null>(null);

  const previewLabel = useMemo(() => {
    if (!file) return "스크린샷 선택 또는 촬영";
    return `${file.name} (${Math.round(file.size / 1024)}KB)`;
  }, [file]);

  const filteredTargetApps = useMemo(() => {
    const query = targetAppSearch.trim().toLowerCase();
    if (!query) return targetApps;
    return targetApps.filter((app) => `${app.label} ${app.packageName}`.toLowerCase().includes(query));
  }, [targetAppSearch, targetApps]);

  const setDiagnostic = useCallback((code: string | null, hint?: string | null) => {
    setDiagnosticCode(code);
    setDiagnosticHint(hint ?? null);
  }, []);

  const returnToSourceApp = useCallback(async () => {
    if (!isNativeApp() || !lastReturnPackage) return;
    try {
      await ExtractorBridge.openSourceApp({ packageName: lastReturnPackage });
    } catch {
      setToast("원래 퀵 화면으로 돌아가지 못했습니다. 최근 앱 화면에서 퀵앱을 선택해 주세요.");
    }
  }, [lastReturnPackage]);

  const onPickFile = useCallback(
    (picked: File | null) => {
      setFile(picked);
      setError(null);
      setToast(null);
      setDiagnostic(null);
      setOcrProgress(0);
      setOcrStatusText("");
      setPreprocessedPreviewUrl(null);
      setOcrRawText("");
      setOcrAddressDraft("");
      setIncomingTransferMeta(null);
      lastAutoSentAddressRef.current = null;
      setManualCropRect(null);
      setDragStart(null);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(picked ? URL.createObjectURL(picked) : null);
    },
    [imagePreviewUrl, setDiagnostic],
  );

  const refreshNativeStatus = useCallback(async () => {
    if (!isNativeApp()) return;
    try {
      const status = await ExtractorBridge.getStatus();
      setNativeStatus(status);
      setOverlaySizeDp(status.overlaySizeDp);
      setOverlayOpacity(status.overlayOpacity);
      setOverlayLocked(status.overlayLocked);
      setLastReturnPackage((current) => current ?? status.lastReturnPackage ?? null);
    } catch {
      setNativeStatus(null);
    }
  }, []);

  useEffect(() => {
    void refreshNativeStatus();
  }, [refreshNativeStatus]);

  useEffect(() => {
    try {
      window.localStorage.setItem(EXTRACTOR_AUTO_TRANSFER_STORAGE_KEY, autoTransferEnabled ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [autoTransferEnabled]);

  useEffect(() => {
    if (!isNativeApp()) return;
    const url = new URL(window.location.href);
    const fromCapture = url.searchParams.get("captured") === "1";
    if (!fromCapture) return;

    void (async () => {
      try {
        const result = await ExtractorBridge.consumeLastCapture();
        if (!result.dataUrl) {
          setDiagnostic("CAPTURE_RESULT_EMPTY", "화면 캡처는 끝났지만 이미지가 비어 있습니다. 다시 한 번 캡처해 주세요.");
          return;
        }
        const response = await fetch(result.dataUrl);
        const blob = await response.blob();
        const capturedFile = new File([blob], `extractor-capture-${Date.now()}.png`, {
          type: "image/png",
        });
        onPickFile(capturedFile);
        setToast("방금 캡처한 화면을 불러왔습니다. 원하는 구역을 바로 선택하거나 OCR을 시작하세요.");
        setDiagnostic(null);
      } catch {
        setError("캡처한 화면을 불러오지 못했습니다. 다시 시도해 주세요.");
        setDiagnostic("CAPTURE_CONSUME_FAILED", "캡처 후 추출기 화면으로 돌아왔지만 이미지를 읽지 못했습니다. 다시 시도해 주세요.");
      } finally {
        url.searchParams.delete("captured");
        window.history.replaceState({}, "", url.toString());
        void refreshNativeStatus();
      }
    })();
  }, [onPickFile, refreshNativeStatus, setDiagnostic]);

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
      setDiagnostic(
        "OVERLAY_PERMISSION_PENDING",
        "Android 설정 화면에서 '다른 앱 위에 표시'를 허용한 뒤 다시 돌아와 주세요.",
      );
      setToast("다른 앱 위에 표시 권한 화면을 열었습니다. 허용 후 다시 돌아와 주세요.");
    } catch {
      setError("오버레이 권한 요청을 열지 못했습니다.");
      setDiagnostic("OVERLAY_PERMISSION_OPEN_FAILED", "오버레이 권한 화면을 열지 못했습니다. Android 설정에서 직접 허용해 주세요.");
    } finally {
      setNativeBusy(false);
      setTimeout(() => void refreshNativeStatus(), 1000);
    }
  };

  const onOpenNextPermissionStep = async () => {
    if (!isNativeApp()) return;
    setNativeBusy(true);
    try {
      const status = await ExtractorBridge.getStatus();
      setNativeStatus(status);

      if (!status.overlayPermission) {
        await ExtractorBridge.requestOverlayPermission();
        setDiagnostic(
          "OVERLAY_PERMISSION_PENDING",
          "먼저 '다른 앱 위에 표시'를 허용해 주세요. 허용 후 앱으로 돌아오면 다음 권한을 이어서 안내합니다.",
        );
        setToast("오버레이 권한 화면을 열었습니다.");
        return;
      }

      if (!status.accessibilityEnabled) {
        await ExtractorBridge.openAccessibilitySettings();
        setDiagnostic(
          "ACCESSIBILITY_PERMISSION_PENDING",
          "접근성 목록에서 '구역 추출기'를 켜 주세요. '제한된 설정' 안내가 나오면 앱 정보에서 제한된 설정 허용이 필요할 수 있습니다.",
        );
        setToast("접근성 설정을 열었습니다.");
        return;
      }

      if (!status.notificationsEnabled && status.sdkInt >= 33) {
        await ExtractorBridge.openAppNotificationSettings();
        setDiagnostic("NOTIFICATION_PERMISSION_PENDING", "알림 권한을 허용하면 떠있는 버튼 상태 확인이 더 안정적입니다.");
        setToast("알림 설정을 열었습니다.");
        return;
      }

      setDiagnostic(null);
      setToast("필수 권한이 준비되어 있습니다. 이제 떠있는 버튼 또는 접근성 자동 추출을 사용할 수 있습니다.");
    } catch {
      setError("권한 설정 화면을 열지 못했습니다.");
      setDiagnostic("PERMISSION_WIZARD_FAILED", "기기 설정에서 구역 추출기 앱 권한을 직접 확인해 주세요.");
    } finally {
      setNativeBusy(false);
      setTimeout(() => void refreshNativeStatus(), 1000);
    }
  };

  const loadTargetApps = async () => {
    if (!isNativeApp()) return;
    setTargetAppsLoading(true);
    try {
      const result = await ExtractorBridge.getLaunchableApps();
      setTargetApps(Array.isArray(result.apps) ? result.apps : []);
      setTargetAppsOpen(true);
      setDiagnostic(null);
    } catch {
      setError("설치된 앱 목록을 불러오지 못했습니다.");
      setDiagnostic("TARGET_APP_LIST_FAILED", "Android 설정 또는 앱 권한 상태를 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setTargetAppsLoading(false);
    }
  };

  const toggleTargetApp = async (app: ExtractorLaunchableApp) => {
    setNativeBusy(true);
    try {
      const status = app.selected
        ? await ExtractorBridge.removeAccessibilityTargetPackage({ packageName: app.packageName })
        : await ExtractorBridge.addAccessibilityTargetPackage({ packageName: app.packageName });
      setNativeStatus(status);
      setTargetApps((prev) =>
        prev.map((item) => (item.packageName === app.packageName ? { ...item, selected: !app.selected } : item)),
      );
      setToast(app.selected ? `대상 앱에서 해제했습니다: ${app.label}` : `대상 앱으로 등록했습니다: ${app.label}`);
      setDiagnostic(null);
    } catch {
      setError("대상 앱 설정을 변경하지 못했습니다.");
      setDiagnostic("TARGET_APP_TOGGLE_FAILED", "앱 목록에서 다시 선택해 주세요.");
    } finally {
      setNativeBusy(false);
    }
  };

  const onStartOverlay = async () => {
    setNativeBusy(true);
    try {
      await ExtractorBridge.startOverlayBubble();
      setToast("떠있는 버튼을 시작했습니다. 퀵 프로그램 위에서 '추출'을 누르면 캡처 후 이 화면으로 돌아옵니다.");
      setDiagnostic(null);
    } catch {
      if (!nativeStatus?.overlayPermission) {
        setDiagnostic("OVERLAY_PERMISSION_REQUIRED", "오버레이 권한이 없어서 시작할 수 없습니다. 먼저 권한 허용을 눌러 주세요.");
      } else {
        setDiagnostic("OVERLAY_START_FAILED", "기기에서 떠있는 버튼 서비스를 시작하지 못했습니다. 알림 권한과 오버레이 권한을 다시 확인해 주세요.");
      }
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
      setDiagnostic(null);
    } catch {
      setError("떠있는 버튼을 중지하지 못했습니다.");
      setDiagnostic("OVERLAY_STOP_FAILED", "떠있는 버튼 중지 요청이 실패했습니다. 앱을 다시 열어 상태를 확인해 주세요.");
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
      setDiagnostic(
        "CAPTURE_PERMISSION_PENDING",
        "Android의 화면 캡처 권한 창이 열리면 허용해 주세요. 허용 후 자동으로 추출기로 돌아옵니다.",
      );
    } catch {
      setError("현재 화면 캡처를 시작하지 못했습니다.");
      setDiagnostic("CAPTURE_REQUEST_FAILED", "현재 화면 캡처를 시작하지 못했습니다. 떠있는 버튼 또는 직접 캡처 버튼으로 다시 시도해 주세요.");
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
      setDiagnostic("OVERLAY_CONFIG_SAVE_FAILED", "오버레이 버튼 설정 저장에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setNativeBusy(false);
    }
  };

  const sendToMainApp = useCallback(
    async (
      text: string,
      rawText: string,
      options?: {
        silent?: boolean;
        skipDuplicateCheck?: boolean;
        transferType?: "ocr" | "accessibility" | "clipboard";
        providerHint?: string;
      },
    ) => {
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
          body: JSON.stringify({
            extractedText: normalized,
            normalizedAddress: normalized,
            rawText,
            source: "extractor",
            transferType: options?.transferType ?? "ocr",
            providerHint: options?.providerHint ?? null,
            sourceDevice: isNativeApp() ? "extractor-app" : "extractor-web",
          }),
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

  const applyIncomingTransfer = useCallback(async (transfer: PendingAccessibilityTransfer) => {
    const normalized = transfer.address?.trim();
    if (!normalized) return;

    setFile(null);
    setImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setOcrProgress(100);
    setOcrStatusText("접근성 주소를 불러왔습니다.");
    setOcrRawText(transfer.rawText ?? normalized);
    setOcrAddressDraft(normalized);
    setIncomingTransferMeta(transfer);
    if (transfer.sourcePackage) {
      setLastReturnPackage(transfer.sourcePackage);
    }
    setPreprocessedPreviewUrl(null);
    setDiagnostic(null);

    if (user?.isAllowed && autoTransferEnabled) {
      try {
        await sendToMainApp(normalized, transfer.rawText ?? normalized, {
          silent: true,
          skipDuplicateCheck: true,
          transferType: "accessibility",
          providerHint: transfer.providerHint ?? undefined,
        });
        setToast("길안내 클릭 시점에 추출한 주소를 B폰 메인 앱으로 자동 전송했습니다.");
      } catch (error) {
        setError(error instanceof Error ? error.message : "자동 전송 실패");
        setDiagnostic(
          "ACCESSIBILITY_TRANSFER_FAILED",
          "접근성으로 추출한 주소는 불러왔지만 자동 전송은 실패했습니다. 아래 전송 버튼으로 다시 시도해 주세요.",
        );
      }
    } else {
      setToast("길안내 클릭 시점에 추출한 주소를 불러왔습니다. 확인 후 B폰으로 보내기를 눌러 주세요.");
    }
  }, [autoTransferEnabled, sendToMainApp, setDiagnostic, user?.isAllowed]);

  const consumeNativeAccessibilityTransfer = useCallback(async () => {
    if (!isNativeApp()) return false;
    try {
      const incoming = await ExtractorBridge.consumePendingAccessibilityTransfer();
      if (incoming.address) {
        await applyIncomingTransfer(incoming);
        return true;
      }
    } catch {
      // ignore bridge failures and keep OCR fallback available
    } finally {
      void refreshNativeStatus();
    }
    return false;
  }, [applyIncomingTransfer, refreshNativeStatus]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const incomingAddress = url.searchParams.get("address");
    const incomingRawText = url.searchParams.get("rawText");
    const incomingProviderHint = url.searchParams.get("providerHint");
    const incomingTransferType = url.searchParams.get("transferType");

    if (incomingAddress) {
      void applyIncomingTransfer({
        address: incomingAddress,
        rawText: incomingRawText,
        providerHint: incomingProviderHint,
        transferType: incomingTransferType === "accessibility" ? "accessibility" : "accessibility",
        sourcePackage: null,
        detectedAt: Date.now(),
      });
      url.searchParams.delete("address");
      url.searchParams.delete("rawText");
      url.searchParams.delete("providerHint");
      url.searchParams.delete("transferType");
      window.history.replaceState({}, "", url.toString());
      return;
    }

    if (!isNativeApp()) return;
    void (async () => {
      const consumed = await consumeNativeAccessibilityTransfer();
      if (consumed && url.searchParams.get("incoming") === "accessibility") {
        url.searchParams.delete("incoming");
        url.searchParams.delete("ts");
        window.history.replaceState({}, "", url.toString());
      }
    })();
  }, [applyIncomingTransfer, consumeNativeAccessibilityTransfer]);

  useEffect(() => {
    if (!isNativeApp()) return;
    let cleanup: (() => void) | undefined;
    void addNativeResumeListener(() => {
      void consumeNativeAccessibilityTransfer();
    }).then((remove) => {
      cleanup = remove;
    });
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void consumeNativeAccessibilityTransfer();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cleanup?.();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [consumeNativeAccessibilityTransfer]);

  const runOcr = async () => {
    if (!file) return;
    setRunning(true);
    setError(null);
    setToast(null);
    setDiagnostic(null);
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
      setIncomingTransferMeta(null);
      if (!result.address) {
        setError("주소를 정확히 찾지 못했습니다. 결과를 직접 편집한 뒤 사용하세요.");
        setDiagnostic("OCR_ADDRESS_NOT_FOUND", "OCR 원문은 읽었지만 주소 후보를 하나로 확정하지 못했습니다. 직접 편집 후 보내기를 사용해 주세요.");
      } else if (user?.isAllowed && autoTransferEnabled) {
        try {
          await sendToMainApp(result.address, result.sanitizedText, { silent: true });
          setToast("주소를 추출했고, 같은 계정의 B폰 메인 앱으로 자동 전송했습니다.");
        } catch (autoSendError) {
          setToast("주소는 추출했습니다. 자동 전송은 실패해서 복사/공유 또는 수동 전송이 필요합니다.");
          setError(autoSendError instanceof Error ? autoSendError.message : "자동 전송 실패");
          setDiagnostic("TRANSFER_AUTO_FAILED", "자동 전송에 실패했습니다. 복사/공유 또는 수동 전송을 사용해 주세요.");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "OCR 처리 실패");
      setDiagnostic("OCR_RUN_FAILED", "OCR 처리 중 오류가 발생했습니다. 같은 화면으로 다시 시도하거나 직접 선택 영역을 좁혀 보세요.");
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
      await sendToMainApp(text, ocrRawText, {
        skipDuplicateCheck: true,
        transferType: incomingTransferMeta?.transferType ?? "ocr",
        providerHint: incomingTransferMeta?.providerHint ?? undefined,
      });
      setDiagnostic(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "전송 실패");
      setDiagnostic("TRANSFER_MANUAL_FAILED", "수동 전송에 실패했습니다. 네트워크 상태를 확인하거나 잠시 후 다시 시도해 주세요.");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6">
      {isNativeApp() && lastReturnPackage ? (
        <button
          type="button"
          className="fixed right-4 bottom-5 z-50 flex h-14 items-center gap-2 rounded-full border border-cyan-200 bg-slate-950 px-4 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(15,23,42,0.28)] active:scale-[0.98]"
          onClick={() => void returnToSourceApp()}
          aria-label="원래 퀵 화면으로 돌아가기"
        >
          <span className="grid size-8 place-items-center rounded-full bg-cyan-400 text-base text-slate-950">↩</span>
          <span>퀵화면</span>
        </button>
      ) : null}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">Extractor</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">구역 추출기</h1>
              <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">
                최신 v{EXTRACTOR_APP_LATEST_VERSION}
              </span>
            </div>
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
                <span className={`rounded-full px-3 py-1 ${nativeStatus?.accessibilityEnabled ? "bg-violet-100 text-violet-800" : "bg-white text-slate-700"}`}>
                  접근성 {nativeStatus?.accessibilityEnabled ? "활성" : "미설정"}
                </span>
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-amber-200 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-900">권한 설정 도우미</div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Android는 보안상 모든 권한을 한 번에 자동 허용할 수 없습니다. 대신 필요한 권한 화면을 순서대로 열어드립니다.
                  </p>
                </div>
                <button
                  type="button"
                  className="h-10 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white disabled:opacity-50"
                  onClick={() => void onOpenNextPermissionStep()}
                  disabled={nativeBusy}
                >
                  다음 권한 열기
                </button>
              </div>
              <div className="mt-3 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-3">
                <div className={`rounded-lg border px-3 py-2 ${nativeStatus?.overlayPermission ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50"}`}>
                  1. 오버레이 {nativeStatus?.overlayPermission ? "완료" : "필요"}
                </div>
                <div className={`rounded-lg border px-3 py-2 ${nativeStatus?.accessibilityEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50"}`}>
                  2. 접근성 {nativeStatus?.accessibilityEnabled ? "완료" : "필요"}
                </div>
                <div className={`rounded-lg border px-3 py-2 ${nativeStatus?.notificationsEnabled || (nativeStatus?.sdkInt ?? 0) < 33 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50"}`}>
                  3. 알림 {(nativeStatus?.notificationsEnabled || (nativeStatus?.sdkInt ?? 0) < 33) ? "완료" : "권장"}
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-[11px] leading-5 text-rose-800">
                Play Protect 또는 Android 13+에서 접근성이 막히면, 앱 정보 화면의 우측 상단 메뉴에서
                <b> 제한된 설정 허용</b>을 먼저 켠 뒤 접근성을 다시 허용해야 할 수 있습니다.
                <div className="mt-2">
                  <button
                    type="button"
                    className="rounded-lg border border-rose-200 bg-white px-3 py-2 font-medium text-rose-800"
                    onClick={() => void ExtractorBridge.openAppDetailsSettings()}
                  >
                    앱 정보 설정 열기
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3 text-xs text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-800">접근성 기반 자동 추출</div>
              <p className="mt-1 leading-5 text-slate-600">
                대상 앱에서 길안내를 누른 시점의 주소를 자동으로 읽어 extractor로 넘깁니다. 실패하면 기존 OCR 캡처 방식으로 바로 보완할 수 있습니다.
              </p>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                extractor 앱 복귀가 막히면 웹 추출기 화면으로 fallback 연결을 시도합니다. 전송함 구조는 동일하게 유지됩니다.
              </p>
            </div>
                <button
                  type="button"
                  className="h-10 rounded-lg border border-violet-300 bg-violet-50 px-3 text-xs font-medium text-violet-900"
                  onClick={() => void ExtractorBridge.openAccessibilitySettings()}
                >
                  접근성 설정 열기
                </button>
              </div>
              <label className="mt-3 inline-flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={autoTransferEnabled} onChange={(e) => setAutoTransferEnabled(e.target.checked)} />
                추출 즉시 B폰 메인 앱으로 자동 전송
              </label>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900">대상 앱 선택</div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      퀵 앱 이름이 다양하면 여기에서 실제 사용하는 앱을 직접 선택하세요.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-[11px] font-medium text-slate-800 disabled:opacity-50"
                    onClick={() => void loadTargetApps()}
                    disabled={nativeBusy || targetAppsLoading}
                  >
                    {targetAppsLoading ? "불러오는 중..." : "앱 선택"}
                  </button>
                </div>
                {(nativeStatus?.customAccessibilityTargetPackages?.length ?? 0) > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {nativeStatus?.customAccessibilityTargetPackages?.map((packageName) => (
                      <span key={packageName} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] text-violet-900">
                        {packageName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-500">선택한 대상 앱 없음. 기본 인성/카카오맵/네이버지도 규칙은 자동 적용됩니다.</p>
                )}
                {targetAppsOpen ? (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <input
                        className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-xs"
                        value={targetAppSearch}
                        onChange={(event) => setTargetAppSearch(event.target.value)}
                        placeholder="앱 이름 또는 패키지명 검색"
                      />
                      <button
                        type="button"
                        className="h-10 rounded-lg border border-slate-300 px-3 text-xs"
                        onClick={() => setTargetAppsOpen(false)}
                      >
                        닫기
                      </button>
                    </div>
                    <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                      {filteredTargetApps.slice(0, 80).map((app) => (
                        <button
                          key={app.packageName}
                          type="button"
                          className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left ${
                            app.selected ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-slate-50"
                          }`}
                          onClick={() => void toggleTargetApp(app)}
                          disabled={nativeBusy}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-slate-900">{app.label}</span>
                            <span className="block truncate font-mono text-[10px] text-slate-500">{app.packageName}</span>
                          </span>
                          <span className={`rounded-full px-2 py-1 text-[10px] ${app.selected ? "bg-violet-600 text-white" : "bg-white text-slate-500"}`}>
                            {app.selected ? "선택됨" : "선택"}
                          </span>
                        </button>
                      ))}
                      {filteredTargetApps.length === 0 ? <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500">검색 결과가 없습니다.</div> : null}
                    </div>
                  </div>
                ) : null}
              </div>
              {incomingTransferMeta?.address ? (
                <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] leading-5 text-violet-900">
                  최근 접근성 추출: {incomingTransferMeta.address}
                  {incomingTransferMeta.providerHint ? ` · ${incomingTransferMeta.providerHint}` : ""}
                </div>
              ) : null}
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
                  <input type="range" min={44} max={96} step={4} value={overlaySizeDp} onChange={(e) => setOverlaySizeDp(Number(e.target.value))} className="mt-1 w-full" />
                </label>
                <label className="block text-xs text-slate-700">
                  투명도 ({Math.round(overlayOpacity * 100)}%)
                  <input type="range" min={45} max={100} step={5} value={Math.round(overlayOpacity * 100)} onChange={(e) => setOverlayOpacity(Number(e.target.value) / 100)} className="mt-1 w-full" />
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={overlayLocked} onChange={(e) => setOverlayLocked(e.target.checked)} />
                  위치 잠금 (드래그 방지)
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 disabled:opacity-50" onClick={() => void onSaveOverlaySettings()} disabled={nativeBusy}>
                    설정 저장
                  </button>
                  <div className="flex items-center text-[11px] text-slate-500">
                    길게 누르면 버튼이 바로 꺼지고, 드래그한 위치는 자동으로 기억합니다.
                  </div>
                </div>
              </div>
            </div>

            {nativeStatus ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold text-slate-800">기기 진단</div>
                <div className="mt-2 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Android 버전: API {nativeStatus.sdkInt}</div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">알림 권한: {nativeStatus.notificationsEnabled ? "허용" : "확인 필요"}</div>
                </div>
                {nativeStatus.sdkInt >= 33 && !nativeStatus.notificationsEnabled ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                    Android 13 이상에서는 알림 권한이 꺼져 있으면 떠있는 버튼 상태를 놓치기 쉽습니다.
                    <div className="mt-2">
                      <button type="button" className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-medium" onClick={() => void ExtractorBridge.openAppNotificationSettings()}>
                        알림 설정 열기
                      </button>
                    </div>
                  </div>
                ) : null}
                {nativeStatus.sdkInt >= 34 ? (
                  <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs leading-5 text-cyan-900">
                    Android 14에서는 화면 캡처 권한 허용 후 앱으로 다시 돌아오는 시간이 조금 더 걸릴 수 있습니다. 권한 허용 후 1초 정도 기다려 주세요.
                  </div>
                ) : null}
                {diagnosticCode ? (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800">
                    <div className="font-semibold">진단 코드: {diagnosticCode}</div>
                    {diagnosticHint ? <div className="mt-1">{diagnosticHint}</div> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
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

