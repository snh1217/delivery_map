"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { parseAddressInput } from "@/lib/addressInput";
import { createKakaoMapDirectionLinks } from "@/lib/kakaoDeepLink";
import { createNaverDirectionLinks, detectPlatform } from "@/lib/naverDeepLink";
import { getMicrophonePermissionState, requestMicrophonePermission } from "@/lib/native/permissions";
import { isNativeApp } from "@/lib/native/runtime";
import {
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
  supportsMicrophoneCapture,
  type SpeechResultPayload,
} from "@/lib/speech/recognizer";
import type { DestinationRowState, LatLng } from "@/types";

const DestinationAttachment = dynamic(
  () => import("@/components/destinations/DestinationAttachment").then((m) => m.DestinationAttachment),
  { ssr: false },
);

type Props = {
  index: number;
  row: DestinationRowState;
  origin: LatLng;
  autoSearch: boolean;
  highlighted?: boolean;
  shouldAutofocus?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveRow: (id: string, direction: "up" | "down") => void;
  onChangeInput: (id: string, value: string, detail?: string) => void;
  onSearch: (id: string) => void;
  onDelete: (id: string) => void;
  onSelectCandidate: (id: string, index: number) => void;
  onNavigate: (id: string) => void;
  onNavigateKakao: (id: string) => void;
  preferredNavigationApp: "naver" | "kakao" | "kakaonavi";
  isAdmin?: boolean;
  canUseAttachment?: boolean;
  onApplyOcrToRow?: (id: string, address: string) => void | Promise<void>;
  onChangeCallTime: (id: string, value: string) => void;
  onUseCurrentCallTime: (id: string) => void;
  onComputeCallEstimate: (id: string) => void;
  onChangeCallOriginInput: (id: string, value: string) => void;
  onUseCurrentLocationForCall: (id: string) => void;
  onResolveCallOrigin: (id: string) => void;
};

const VOICE_SILENCE_TIMEOUT_MS = 900;
const VOICE_MIN_RECORDING_MS = 800;
const LOW_CONFIDENCE_THRESHOLD = 0.45;

function removeVoiceHabitPhrases(value: string) {
  let text = value || "";
  const patterns = [
    /(검색|찾기)(해줘요|해줘|좀|요)?$/giu,
    /(추가|입력|적용)(해줘요|해줘|좀|요)?$/giu,
    /(검색|찾기)(해줘요|해줘|좀|요)?/giu,
    /(추가|입력|적용)(해줘요|해줘|좀|요)?/giu,
    /^(여기|이거|저기)\s*/giu,
    /^(주소는|주소)\s*/giu,
  ];

  for (const pattern of patterns) {
    text = text.replace(pattern, " ");
  }

  return text.replace(/\s+/g, " ").trim();
}

function normalizeVoiceText(text: string) {
  return removeVoiceHabitPhrases(text)
    .replace(/서울시/giu, "서울")
    .replace(/경기도/giu, "경기")
    .replace(/\s*-\s*/g, "-")
    .replace(/[\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getNavigationAppLabel(app: Props["preferredNavigationApp"]) {
  if (app === "kakao") return "카카오";
  if (app === "kakaonavi") return "카카오내비";
  return "네이버";
}

function getVoiceErrorMessage(code: string) {
  const messages: Record<string, string> = {
    "not-allowed": isNativeApp()
      ? "앱에서 마이크 권한을 허용해 주세요. 권한 창이 보이지 않으면 기기 설정에서 허용 후 다시 시도해 주세요."
      : "브라우저에서 마이크 권한을 허용해 주세요.",
    "service-not-allowed": "음성 인식 서비스를 사용할 수 없습니다.",
    "no-speech": "음성이 인식되지 않았습니다. 다시 시도해 주세요.",
    aborted: "음성 입력이 취소되었습니다.",
    "audio-capture": "마이크를 찾을 수 없습니다.",
    network: "네트워크 문제로 음성 인식에 실패했습니다.",
    nomatch: "인식 결과가 불확실합니다. 다시 시도해 주세요.",
    unsupported: "이 브라우저는 음성 입력을 지원하지 않습니다. 모바일 Chrome/Edge를 권장합니다.",
  };

  return messages[code] ?? `음성 입력 오류: ${code}`;
}

function formatDuration(minutes: number | null | undefined) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) {
    return "-";
  }
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded}분`;
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return `${hours}시간 ${mins}분`;
}

export function DestinationRow({
  index,
  row,
  origin,
  autoSearch,
  highlighted = false,
  shouldAutofocus = false,
  canMoveUp,
  canMoveDown,
  onMoveRow,
  onChangeInput,
  onSearch,
  onDelete,
  onSelectCandidate,
  onNavigate,
  onNavigateKakao,
  preferredNavigationApp,
  isAdmin = false,
  canUseAttachment = false,
  onApplyOcrToRow,
  onChangeCallTime,
  onUseCurrentCallTime,
  onComputeCallEstimate,
  onChangeCallOriginInput,
  onUseCurrentLocationForCall,
  onResolveCallOrigin,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onSearchRef = useRef(onSearch);
  const recognizerRef = useRef<ReturnType<typeof createSpeechRecognizer> | null>(null);
  const autoSearchTimerRef = useRef<number | null>(null);
  const skipNextAutoSearchRef = useRef(false);
  const finalVoiceTextRef = useRef("");
  const finalConfidenceRef = useRef<number | undefined>(undefined);

  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voicePreviewText, setVoicePreviewText] = useState<string | null>(null);
  const [voiceInterimText, setVoiceInterimText] = useState("");
  const [voiceLowConfidence, setVoiceLowConfidence] = useState(false);
  const [micPermissionState, setMicPermissionState] = useState<"granted" | "prompt" | "denied" | "unsupported" | "unknown">("unknown");
  const [callPanelOpen, setCallPanelOpen] = useState(false);

  const canNavigate = Boolean(row.coord);
  const speechSupported = isSpeechRecognitionSupported();
  const canCaptureAudio = supportsMicrophoneCapture();
  const canUseVoiceInput = speechSupported && canCaptureAudio;
  const naverLinks = row.coord ? createNaverDirectionLinks(origin, row.coord, row.label ?? row.input) : null;
  const kakaoLinks = row.coord ? createKakaoMapDirectionLinks(origin, row.coord, row.label ?? row.input) : null;

  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    if (!highlighted) return;
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

  useEffect(() => {
    if (!shouldAutofocus) return;
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [shouldAutofocus]);

  useEffect(() => {
    return () => {
      if (autoSearchTimerRef.current !== null) {
        window.clearTimeout(autoSearchTimerRef.current);
      }
      try {
        recognizerRef.current?.abort();
      } catch {
        // no-op
      }
      recognizerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void getMicrophonePermissionState().then((state) => {
      if (mounted) {
        setMicPermissionState(state);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!autoSearch || !row.input.trim() || isListening) return;
    if (skipNextAutoSearchRef.current) {
      skipNextAutoSearchRef.current = false;
      return;
    }

    const timer = window.setTimeout(() => onSearchRef.current(row.id), 600);
    return () => window.clearTimeout(timer);
  }, [autoSearch, isListening, row.id, row.input]);

  const clearPendingVoiceAutoSearch = () => {
    if (autoSearchTimerRef.current !== null) {
      window.clearTimeout(autoSearchTimerRef.current);
      autoSearchTimerRef.current = null;
    }
  };

  const scheduleVoiceAutoSearch = (text: string, options?: { skipIfLowConfidence?: boolean }) => {
    clearPendingVoiceAutoSearch();
    setVoicePreviewText(text);

    if (options?.skipIfLowConfidence && voiceLowConfidence) {
      return;
    }

    skipNextAutoSearchRef.current = true;
    autoSearchTimerRef.current = window.setTimeout(() => {
      autoSearchTimerRef.current = null;
      setVoicePreviewText(null);
      onSearchRef.current(row.id);
    }, 500);
  };

  const stopVoiceRecognition = () => {
    try {
      recognizerRef.current?.stop();
    } catch {
      // no-op
    }
  };

  const handleSpeechResult = (payload: SpeechResultPayload) => {
    const finalNormalized = normalizeVoiceText(payload.finalText);
    const interimNormalized = normalizeVoiceText(payload.interimText);
    finalVoiceTextRef.current = finalNormalized;
    finalConfidenceRef.current = payload.confidence;

    setVoiceInterimText(interimNormalized);
    if (finalNormalized) {
      onChangeInput(row.id, finalNormalized);
    }
  };

  const beginVoiceInput = async () => {
    if (!canUseVoiceInput) {
      setVoiceError(getVoiceErrorMessage("unsupported"));
      return;
    }
    if (isListening) return;

    clearPendingVoiceAutoSearch();
    setVoiceError(null);
    setVoicePreviewText(null);
    setVoiceInterimText("");
    setVoiceLowConfidence(false);
    onChangeInput(row.id, "");
    finalVoiceTextRef.current = "";
    finalConfidenceRef.current = undefined;

    const permission = await requestMicrophonePermission();
    setMicPermissionState(permission.state);
    if (!permission.granted) {
      setVoiceError(getVoiceErrorMessage(permission.state === "denied" ? "not-allowed" : permission.state));
      return;
    }

    try {
      navigator.vibrate?.(15);
    } catch {
      // ignore
    }

    const recognizer = createSpeechRecognizer({
      lang: "ko-KR",
      silenceTimeoutMs: VOICE_SILENCE_TIMEOUT_MS,
      minRecordingMs: VOICE_MIN_RECORDING_MS,
      onListeningChange: (next) => setIsListening(next),
      onResult: handleSpeechResult,
      onError: (code) => setVoiceError(getVoiceErrorMessage(code)),
      onEnd: (payload) => {
        setVoiceInterimText("");
        recognizerRef.current = null;
        try {
          navigator.vibrate?.(10);
        } catch {
          // ignore
        }

        const finalText = normalizeVoiceText(finalVoiceTextRef.current || payload.finalText || "");
        if (!finalText) {
          return;
        }

        onChangeInput(row.id, finalText);
        const confidence = finalConfidenceRef.current;
        const isLowConfidence = typeof confidence === "number" && confidence < LOW_CONFIDENCE_THRESHOLD;
        setVoiceLowConfidence(isLowConfidence);

        if (isLowConfidence) {
          setVoicePreviewText(finalText);
          setVoiceError("음성 인식 정확도가 낮습니다. 내용을 확인한 뒤 검색/적용을 눌러 주세요.");
          return;
        }

        scheduleVoiceAutoSearch(finalText);
      },
    });

    recognizerRef.current = recognizer;

    try {
      await recognizer.start();
    } catch (error) {
      recognizerRef.current = null;
      const code = error instanceof Error ? error.message : "unknown";
      setVoiceError(getVoiceErrorMessage(code));
    }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      stopVoiceRecognition();
      return;
    }
    void beginVoiceInput();
  };

  const runSearchNow = () => {
    clearPendingVoiceAutoSearch();
    setVoicePreviewText(null);
    onSearchRef.current(row.id);
  };

  const callSummaryText = row.callEstimate
    ? `마감 ${row.callEstimate.deadlineLabel} · 총 ${formatDuration(row.callEstimate.totalRequiredMin)}`
    : row.callEstimateLoading
      ? "실시간 길찾기 시간을 계산하는 중입니다."
      : row.callOriginLabel
        ? `출발지 ${row.callOriginLabel}`
        : row.coord
          ? "필요할 때만 펼쳐서 마감 시간을 계산하세요."
          : "좌표가 확정되면 이 도착지의 마감 시간을 계산할 수 있습니다.";

  return (
    <div
      ref={rootRef}
      className={`app-card overflow-hidden transition ${
        highlighted ? "ring-2 ring-cyan-500/60" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold ${
              row.status === "resolved" ? "bg-cyan-700 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {index + 1}
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-slate-800">도착지 {index + 1}</div>
            <div className="flex flex-wrap items-center gap-1">
              {row.status === "resolved" ? (
                <span className="app-chip bg-emerald-50 text-emerald-700">● 좌표 확인</span>
              ) : row.status === "loading" ? (
                <span className="app-chip bg-slate-100 text-slate-600">검색 중</span>
              ) : row.status === "error" ? (
                <span className="app-chip bg-rose-50 text-rose-600">검색 실패</span>
              ) : (
                <span className="app-chip bg-slate-50 text-slate-400">{row.input.trim() ? "검색 전" : "미입력"}</span>
              )}
              {highlighted ? <span className="app-chip bg-cyan-50 text-cyan-800">추천 선택</span> : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="app-btn app-btn-secondary h-8 w-8 px-0 text-xs"
            onClick={() => onMoveRow(row.id, "up")}
            disabled={!canMoveUp}
            aria-label={`도착지 ${index + 1} 위로 이동`}
          >
            ↑
          </button>
          <button
            type="button"
            className="app-btn app-btn-secondary h-8 w-8 px-0 text-xs"
            onClick={() => onMoveRow(row.id, "down")}
            disabled={!canMoveDown}
            aria-label={`도착지 ${index + 1} 아래로 이동`}
          >
            ↓
          </button>
          <button
            type="button"
            className="app-btn h-8 w-8 px-0 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            onClick={() => onDelete(row.id)}
            aria-label={`도착지 ${index + 1} 삭제`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid gap-2.5 p-3.5">
        <div className="relative">
          <input
            ref={inputRef}
            className="app-input h-12 w-full pr-12"
            placeholder="주소 붙여넣기 또는 구/동 입력"
            value={row.input}
            onChange={(event) => {
              clearPendingVoiceAutoSearch();
              setVoicePreviewText(null);
              setVoiceError(null);
              onChangeInput(row.id, event.target.value);
            }}
            onPaste={(event) => {
              const parsed = parseAddressInput(event.clipboardData.getData("text"));
              if (!parsed.changed) return;
              event.preventDefault();
              clearPendingVoiceAutoSearch();
              setVoicePreviewText(null);
              setVoiceError(null);
              onChangeInput(row.id, parsed.query, parsed.detail ?? "");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && row.input.trim() && row.status !== "loading") {
                event.preventDefault();
                runSearchNow();
              }
            }}
          />
          <button
            type="button"
            className={`absolute right-1.5 top-1.5 inline-flex h-9 w-9 items-center justify-center rounded-lg transition ${
              isListening ? "bg-rose-500 text-white" : "text-slate-500 hover:bg-slate-100"
            } disabled:cursor-not-allowed disabled:opacity-40`}
            onClick={toggleVoiceInput}
            disabled={!canUseVoiceInput && !isListening}
            aria-label={isListening ? "음성 입력 중지" : "음성 입력 시작"}
            title={canUseVoiceInput ? "한 번 탭해 음성 입력 시작/중지" : "이 환경에서는 음성 입력을 사용할 수 없습니다."}
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-[18px] w-[18px] ${isListening ? "animate-pulse" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
        </div>

        {row.inputDetail ? (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500">상세</span>
            <span className="min-w-0 flex-1 truncate text-slate-800">{row.inputDetail}</span>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-600"
              onClick={() => onChangeInput(row.id, row.input, "")}
              aria-label="상세 주소 지우기"
            >
              ✕
            </button>
          </div>
        ) : null}

        {isListening ? (
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-900">
            <div className="font-semibold">듣는 중입니다. 주소를 말해 주세요.</div>
            <div className="mt-0.5 text-cyan-700">
              {voiceInterimText ? `인식 중: ${voiceInterimText}` : "말이 끝나면 자동으로 종료됩니다."}
            </div>
          </div>
        ) : null}

        {voicePreviewText ? (
          <p className="text-xs text-emerald-700">
            음성 인식: <span className="font-semibold">{voicePreviewText}</span>
            {!voiceLowConfidence ? " · 잠시 후 자동 검색" : " · 확인 후 검색을 눌러 주세요"}
          </p>
        ) : null}

        {voiceError ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
            <p className="text-xs text-rose-700">{voiceError}</p>
            <button
              type="button"
              className="app-btn app-btn-danger h-8 shrink-0 px-2.5 text-xs"
              onClick={() => void beginVoiceInput()}
              disabled={isListening || !canUseVoiceInput}
            >
              {micPermissionState === "denied" ? "권한 요청" : "다시 시도"}
            </button>
          </div>
        ) : null}

        <div className={`grid gap-2 ${canNavigate ? "grid-cols-2" : "grid-cols-1"}`}>
          <button
            type="button"
            className={`app-btn h-12 ${canNavigate ? "app-btn-secondary" : "app-btn-primary"}`}
            disabled={!row.input.trim() || row.status === "loading"}
            onClick={runSearchNow}
          >
            {row.status === "loading" ? "검색 중..." : canNavigate ? "다시 검색" : "검색 / 적용"}
          </button>
          {canNavigate ? (
            <button type="button" className="app-btn app-btn-brand h-12" onClick={() => onNavigate(row.id)}>
              길찾기 · {getNavigationAppLabel(preferredNavigationApp)}
            </button>
          ) : null}
        </div>

        {row.geocodeItems.length > 1 ? (
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">검색 후보 {row.geocodeItems.length}건</label>
            <select
              className="app-input h-10 w-full px-2 text-sm"
              value={row.selectedIndex}
              onChange={(event) => onSelectCandidate(row.id, Number(event.target.value))}
            >
              {row.geocodeItems.map((item, itemIndex) => (
                <option key={`${row.id}-${itemIndex}`} value={itemIndex}>
                  {item.title} | {item.address}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {row.label ? (
          <div className="flex items-start gap-2 rounded-xl bg-cyan-50/60 px-3 py-2">
            <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" fill="currentColor" aria-hidden="true">
              <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
            </svg>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-slate-800">{row.label}</div>
              {row.coord ? (
                <div className="text-[11px] text-slate-500">
                  {row.coord.lat.toFixed(5)}, {row.coord.lon.toFixed(5)}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        {row.error ? <p className="text-xs font-medium text-rose-600">{row.error}</p> : null}

        {!canUseVoiceInput && !row.input ? (
          <p className="app-caption">
            {isNativeApp()
              ? "음성 입력을 쓰려면 앱 마이크 권한이 필요합니다."
              : "음성 입력은 모바일 Chrome/Edge에서 지원됩니다."}
          </p>
        ) : null}

      {canUseAttachment ? (
        <DestinationAttachment
          isAdmin={isAdmin}
          onApplyAddress={(address) => {
            setVoiceError(null);
            clearPendingVoiceAutoSearch();
            setVoicePreviewText(null);
            if (onApplyOcrToRow) {
              onApplyOcrToRow(row.id, address);
              return;
            }
            onChangeInput(row.id, address);
            window.setTimeout(() => onSearch(row.id), 0);
          }}
        />
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <button
          type="button"
          className="flex w-full items-start justify-between gap-3 text-left"
          onClick={() => setCallPanelOpen((prev) => !prev)}
          aria-expanded={callPanelOpen}
        >
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-700">콜 시간 계산</div>
            <p className="mt-0.5 text-[11px] leading-5 text-slate-500">{callSummaryText}</p>
          </div>
          <span className={`mt-0.5 shrink-0 text-slate-400 transition ${callPanelOpen ? "rotate-180" : ""}`} aria-hidden="true">
            ▾
          </span>
        </button>

        {callPanelOpen ? (
          <div className="mt-3 space-y-2">
            <div className="rounded-full bg-white px-2 py-1 text-[11px] text-slate-500">
              출발지: {row.callOriginLabel ?? "미설정"}
            </div>

            <div className="grid gap-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <input
                  type="text"
                  className="app-input h-10 text-sm"
                  placeholder="출발지 주소 입력"
                  value={row.callOriginInput}
                  onChange={(event) => onChangeCallOriginInput(row.id, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onResolveCallOrigin(row.id);
                    }
                  }}
                />
                <div className="grid grid-cols-2 gap-2 sm:contents">
                  <button
                    type="button"
                    className="app-btn app-btn-secondary h-10 text-xs"
                    onClick={() => onUseCurrentLocationForCall(row.id)}
                  >
                    현재 위치
                  </button>
                  <button
                    type="button"
                    className="app-btn app-btn-secondary h-10 text-xs"
                    onClick={() => onResolveCallOrigin(row.id)}
                    disabled={row.callOriginStatus === "loading"}
                  >
                    {row.callOriginStatus === "loading" ? "적용 중" : "출발지 적용"}
                  </button>
                </div>
              </div>

              {row.callOriginError ? <p className="text-xs text-rose-600">{row.callOriginError}</p> : null}
              {row.callOriginCoord ? (
                <p className="text-[11px] text-slate-500">
                  출발지 좌표: {row.callOriginCoord.lat.toFixed(5)}, {row.callOriginCoord.lon.toFixed(5)}
                </p>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <input
                  type="time"
                  className="app-input h-10 text-sm"
                  value={row.callTime}
                  onChange={(event) => onChangeCallTime(row.id, event.target.value)}
                />
                <div className="grid grid-cols-2 gap-2 sm:contents">
                  <button
                    type="button"
                    className="app-btn app-btn-secondary h-10 text-xs"
                    onClick={() => onUseCurrentCallTime(row.id)}
                  >
                    지금
                  </button>
                  <button
                    type="button"
                    className="app-btn app-btn-brand h-10 text-xs"
                    onClick={() => onComputeCallEstimate(row.id)}
                    disabled={!row.coord || !row.callOriginCoord || row.callEstimateLoading}
                  >
                    {row.callEstimateLoading ? "계산 중" : "시간 계산"}
                  </button>
                </div>
              </div>
            </div>

            {!row.coord ? (
              <p className="text-[11px] text-slate-500">좌표가 확정되면 이 도착지의 마감 시간을 바로 계산할 수 있습니다.</p>
            ) : !row.callOriginCoord ? (
              <p className="text-[11px] text-slate-500">출발지를 입력하고 적용하면 이 도착지의 마감 시간을 계산할 수 있습니다.</p>
            ) : null}
            {row.callEstimateError ? <p className="text-xs text-rose-600">{row.callEstimateError}</p> : null}

            {row.callEstimate ? (
              <div className="space-y-2">
                <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-900">
                  이 콜은 <span className="font-semibold">{row.callEstimate.deadlineLabel}</span>까지 들어가면 됩니다.
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    실제 내비시간
                    <div className="mt-1 text-sm font-semibold text-slate-800">
                      {formatDuration(row.callEstimate.longestLegMin)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    150% 반영
                    <div className="mt-1 text-sm font-semibold text-slate-800">
                      {formatDuration(row.callEstimate.adjustedDriveMin)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    픽업 시간
                    <div className="mt-1 text-sm font-semibold text-slate-800">
                      {formatDuration(row.callEstimate.pickupMin)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    총 필요 시간
                    <div className="mt-1 text-sm font-semibold text-slate-800">
                      {formatDuration(row.callEstimate.totalRequiredMin)}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                  기준 구간
                  <div className="mt-1 font-medium text-slate-800">{row.callEstimate.referenceLeg}</div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {canNavigate ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="app-btn h-10 border border-amber-200 bg-amber-50 text-xs text-amber-800 hover:bg-amber-100"
            onClick={() => onNavigateKakao(row.id)}
          >
            카카오맵 길찾기
          </button>
          {naverLinks ? (
            <a
              className="app-btn app-btn-secondary h-10 text-xs"
              href={detectPlatform() === "desktop" ? naverLinks.desktopWeb : naverLinks.mobileWeb}
              target="_blank"
              rel="noreferrer"
            >
              네이버 웹
            </a>
          ) : null}
          {kakaoLinks ? (
            <a
              className="app-btn app-btn-secondary col-span-2 h-9 text-[11px] font-medium text-slate-500"
              href={kakaoLinks.mobileWeb}
              target="_blank"
              rel="noreferrer"
            >
              카카오맵 웹에서 열기
            </a>
          ) : null}
        </div>
      ) : null}
      </div>
    </div>
  );
}
