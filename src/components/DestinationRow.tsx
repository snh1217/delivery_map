"use client";

import { useEffect, useRef, useState } from "react";
import { createKakaoMapDirectionLinks } from "@/lib/kakaoDeepLink";
import { createNaverDirectionLinks, detectPlatform } from "@/lib/naverDeepLink";
import { DestinationAttachment } from "@/components/destinations/DestinationAttachment";
import {
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
  type SpeechResultPayload,
} from "@/lib/speech/recognizer";
import type { DestinationRowState, LatLng } from "@/types";

type Props = {
  index: number;
  row: DestinationRowState;
  origin: LatLng;
  autoSearch: boolean;
  highlighted?: boolean;
  onChangeInput: (id: string, value: string) => void;
  onSearch: (id: string) => void;
  onDelete: (id: string) => void;
  onSelectCandidate: (id: string, index: number) => void;
  onNavigate: (id: string) => void;
  onNavigateKakao: (id: string) => void;
  preferredNavigationApp: "naver" | "kakao" | "kakaonavi";
  isAdmin?: boolean;
  onApplyOcrToRow?: (id: string, address: string) => void;
};

const VOICE_SILENCE_TIMEOUT_MS = 900;
const VOICE_MIN_RECORDING_MS = 800;
const LOW_CONFIDENCE_THRESHOLD = 0.45;

function removeVoiceHabitPhrases(value: string) {
  let text = value || "";
  const patterns = [
    /(검색|찾기)(해줘|해주세요|좀|해 줘)?$/gi,
    /(추가|입력|적용)(해줘|해주세요|좀|해 줘)?$/gi,
    /(검색|찾기)(해줘|해주세요|좀|해 줘)?/gi,
    /(추가|입력|적용)(해줘|해주세요|좀|해 줘)?/gi,
    /^(여기|이거|저기)\s*/gi,
    /^(주소|주소는)\s*/gi,
  ];
  for (const pattern of patterns) {
    text = text.replace(pattern, " ");
  }
  return text.replace(/\s+/g, " ").trim();
}

function normalizeVoiceText(text: string) {
  return removeVoiceHabitPhrases(text)
    .replace(/서울시/g, "서울")
    .replace(/경기도/g, "경기")
    .replace(/\s*-\s*/g, "-")
    .replace(/[()[\]{}]/g, (m) => (m === "(" || m === ")" ? m : " "))
    .replace(/\s+/g, " ")
    .trim();
}

function navAppLabel(app: Props["preferredNavigationApp"]) {
  if (app === "kakao") return "카카오";
  if (app === "kakaonavi") return "카카오내비";
  return "네이버";
}

function voiceErrorMessage(code: string) {
  const map: Record<string, string> = {
    "not-allowed": "브라우저에서 마이크 권한을 허용해주세요.",
    "service-not-allowed": "음성 인식 서비스 사용이 허용되지 않았습니다.",
    "no-speech": "음성이 인식되지 않았습니다. 다시 시도해주세요.",
    aborted: "음성 입력이 취소되었습니다.",
    "audio-capture": "마이크 장치를 찾을 수 없습니다.",
    network: "네트워크 문제로 음성 인식에 실패했습니다.",
    nomatch: "인식 결과를 찾지 못했습니다. 다시 시도해주세요.",
    unsupported: "이 브라우저는 음성 입력을 지원하지 않습니다. Chrome/Edge 권장",
  };
  return map[code] ?? `음성 입력 오류: ${code}`;
}

export function DestinationRow({
  index,
  row,
  origin,
  autoSearch,
  highlighted = false,
  onChangeInput,
  onSearch,
  onDelete,
  onSelectCandidate,
  onNavigate,
  onNavigateKakao,
  preferredNavigationApp,
  isAdmin = false,
  onApplyOcrToRow,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onSearchRef = useRef(onSearch);
  const recognizerRef = useRef<ReturnType<typeof createSpeechRecognizer> | null>(null);
  const autoSearchTimerRef = useRef<number | null>(null);
  const skipNextAutoSearchRef = useRef(false);
  const finalVoiceTextRef = useRef("");
  const finalConfidenceRef = useRef<number | undefined>(undefined);

  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voicePreviewText, setVoicePreviewText] = useState<string | null>(null);
  const [voiceInterimText, setVoiceInterimText] = useState<string>("");
  const [voiceLowConfidence, setVoiceLowConfidence] = useState(false);

  const canNavigate = Boolean(row.coord);
  const speechSupported = isSpeechRecognitionSupported();
  const naverLinks = row.coord ? createNaverDirectionLinks(origin, row.coord, row.label ?? row.input) : null;
  const kakaoLinks = row.coord ? createKakaoMapDirectionLinks(origin, row.coord, row.label ?? row.input) : null;

  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    if (!highlighted) return;
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

  const clearPendingVoiceAutoSearch = () => {
    if (autoSearchTimerRef.current !== null) {
      window.clearTimeout(autoSearchTimerRef.current);
      autoSearchTimerRef.current = null;
    }
  };

  const scheduleVoiceAutoSearch = (text: string, options?: { skipIfLowConfidence?: boolean }) => {
    clearPendingVoiceAutoSearch();
    setVoicePreviewText(text);

    const lowConfidence = options?.skipIfLowConfidence && voiceLowConfidence;
    if (lowConfidence) {
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

  useEffect(() => {
    return () => {
      clearPendingVoiceAutoSearch();
      try {
        recognizerRef.current?.abort();
      } catch {
        // no-op
      }
      recognizerRef.current = null;
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

  const beginVoiceInput = () => {
    if (!speechSupported) {
      setVoiceError(voiceErrorMessage("unsupported"));
      return;
    }
    if (isListening) return;

    setVoiceError(null);
    setVoicePreviewText(null);
    setVoiceInterimText("");
    setVoiceLowConfidence(false);
    clearPendingVoiceAutoSearch();

    // 새 음성 입력 시작 시 기존 입력값/좌표 상태를 초기화
    onChangeInput(row.id, "");
    finalVoiceTextRef.current = "";
    finalConfidenceRef.current = undefined;

    try {
      navigator.vibrate?.(15);
    } catch {
      // ignore
    }

    const recognizer = createSpeechRecognizer({
      lang: "ko-KR",
      silenceTimeoutMs: VOICE_SILENCE_TIMEOUT_MS,
      minRecordingMs: VOICE_MIN_RECORDING_MS,
      onListeningChange: (listening) => setIsListening(listening),
      onResult: handleSpeechResult,
      onError: (code) => {
        setVoiceError(voiceErrorMessage(code));
      },
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
          setVoiceError("음성 인식 신뢰도가 낮습니다. 내용을 확인한 뒤 검색/적용을 눌러주세요.");
          return;
        }

        scheduleVoiceAutoSearch(finalText);
      },
    });

    recognizerRef.current = recognizer;

    try {
      recognizer.start();
    } catch (error) {
      recognizerRef.current = null;
      const code = error instanceof Error ? error.message : "unknown";
      setVoiceError(voiceErrorMessage(code));
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

  return (
    <div
      ref={rootRef}
      className={`rounded-xl border p-3 transition ${
        highlighted ? "border-cyan-400 bg-cyan-50/50 shadow-sm" : "border-slate-200"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-700">도착지 {index + 1}</div>
        <div className="flex items-center gap-1">
          {highlighted ? (
            <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] text-cyan-800">추천 선택</span>
          ) : null}
          {row.status === "resolved" ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">좌표 확인됨</span>
          ) : null}
        </div>
      </div>

      <p className="mb-2 text-xs text-slate-500">
        예시: `강서구 마곡동`, `서울 강서구 마곡동 123-4` (입력 후 검색/적용)
      </p>

      <div className="grid gap-2">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            className="h-12 rounded-lg border border-slate-300 px-3 text-sm"
            placeholder="주소 또는 구/동 입력"
            value={row.input}
            onChange={(e) => {
              clearPendingVoiceAutoSearch();
              setVoicePreviewText(null);
              setVoiceError(null);
              onChangeInput(row.id, e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && row.input.trim() && row.status !== "loading") {
                e.preventDefault();
                runSearchNow();
              }
            }}
          />

          <button
            type="button"
            className={`relative h-12 rounded-lg px-3 text-xs font-medium ${
              isListening
                ? "border border-rose-300 bg-rose-50 text-rose-700"
                : "border border-slate-300 bg-white text-slate-700"
            } disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={toggleVoiceInput}
            disabled={!speechSupported && !isListening}
            title={speechSupported ? "한 번 탭하여 음성 입력 시작/중지" : "브라우저에서 음성 입력 미지원"}
          >
            <span className="inline-flex items-center gap-1">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isListening ? "animate-pulse bg-rose-500" : "bg-slate-400"
                }`}
              />
              {isListening ? "듣는 중…" : "음성입력"}
            </span>
          </button>
        </div>

        {isListening ? (
          <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-900">
            <div className="font-medium">듣는 중… 주소를 말해주세요.</div>
            <div className="mt-1 text-cyan-700">
              {voiceInterimText ? `인식 중: ${voiceInterimText}` : "말이 끝나면 침묵 감지 후 자동 종료됩니다."}
            </div>
          </div>
        ) : null}

        {voicePreviewText ? (
          <p className="text-xs text-emerald-700">
            음성 인식 결과 미리보기: <span className="font-medium">{voicePreviewText}</span>
            {!voiceLowConfidence ? " (0.5초 후 자동 검색)" : " (확인 후 검색/적용 권장)"}
          </p>
        ) : null}

        {voiceError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
            <p className="text-xs text-rose-700">{voiceError}</p>
            <button
              type="button"
              className="mt-2 h-8 rounded-lg border border-rose-300 bg-white px-2 text-xs text-rose-700"
              onClick={beginVoiceInput}
              disabled={isListening || !speechSupported}
            >
              다시 시도
            </button>
          </div>
        ) : null}

        {!speechSupported ? (
          <p className="text-xs text-slate-500">브라우저에서 마이크 권한이 필요합니다. 모바일 Chrome/Edge 권장</p>
        ) : (
          <p className="text-xs text-slate-500">
            음성 입력: 탭하여 시작 → 말하기 → 침묵 감지 자동 종료 → 자동 검색/적용 (지원 브라우저 한정)
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button
            type="button"
            className="h-12 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white"
            disabled={!row.input.trim() || row.status === "loading"}
            onClick={runSearchNow}
          >
            {row.status === "loading" ? "검색 중..." : "검색/적용"}
          </button>
          <button
            type="button"
            className="h-12 rounded-lg border border-rose-300 px-3 text-sm font-medium text-rose-600"
            onClick={() => onDelete(row.id)}
          >
            삭제
          </button>
          {canNavigate ? (
            <button
              type="button"
              className="hidden h-12 rounded-lg border border-slate-300 px-3 text-sm sm:block"
              onClick={() => onNavigate(row.id)}
            >
              길찾기
            </button>
          ) : null}
        </div>
      </div>

      {row.geocodeItems.length > 1 ? (
        <div className="mt-2">
          <label className="mb-1 block text-xs text-slate-600">검색 후보 (Top 5)</label>
          <select
            className="h-10 w-full rounded-lg border border-slate-300 px-2 text-sm"
            value={row.selectedIndex}
            onChange={(e) => onSelectCandidate(row.id, Number(e.target.value))}
          >
            {row.geocodeItems.map((item, itemIndex) => (
              <option key={`${row.id}-${itemIndex}`} value={itemIndex}>
                {item.title} | {item.address}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {row.label ? <p className="mt-1 text-xs text-slate-600">선택 주소: {row.label}</p> : null}
      {row.coord ? (
        <p className="mt-1 text-xs text-slate-500">
          좌표: {row.coord.lat.toFixed(5)}, {row.coord.lon.toFixed(5)}
        </p>
      ) : null}
      {row.error ? <p className="mt-1 text-xs text-rose-600">{row.error}</p> : null}

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

      {canNavigate ? (
        <>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="h-11 rounded-lg bg-cyan-700 px-3 text-sm font-medium text-white"
              onClick={() => onNavigate(row.id)}
            >
              기본 앱 길찾기 ({navAppLabel(preferredNavigationApp)})
            </button>
            {naverLinks ? (
              <a
                className="flex h-11 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm"
                href={detectPlatform() === "desktop" ? naverLinks.desktopWeb : naverLinks.mobileWeb}
                target="_blank"
                rel="noreferrer"
              >
                네이버 웹 열기
              </a>
            ) : null}
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="h-11 rounded-lg border border-amber-300 bg-amber-50 px-3 text-sm font-medium text-amber-800"
              onClick={() => onNavigateKakao(row.id)}
            >
              카카오맵 길찾기
            </button>
            {kakaoLinks ? (
              <a
                className="flex h-11 items-center justify-center rounded-lg border border-amber-300 bg-white px-3 text-sm text-amber-800"
                href={kakaoLinks.mobileWeb}
                target="_blank"
                rel="noreferrer"
              >
                카카오맵 웹 열기
              </a>
            ) : null}
          </div>

          <p className="mt-2 text-[11px] text-slate-500">
            좌표가 확정되면 기본 앱({navAppLabel(preferredNavigationApp)}) 또는 네이버/카카오맵 길찾기를 사용할 수 있습니다.
          </p>
        </>
      ) : null}
    </div>
  );
}
