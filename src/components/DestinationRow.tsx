"use client";

import { useEffect, useRef, useState } from "react";
import { createKakaoMapDirectionLinks } from "@/lib/kakaoDeepLink";
import { createNaverDirectionLinks, detectPlatform } from "@/lib/naverDeepLink";
import type { DestinationRowState, LatLng } from "@/types";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
    length: number;
  }>;
};

type WindowWithSpeech = Window & {
  webkitSpeechRecognition?: SpeechRecognitionCtor;
  SpeechRecognition?: SpeechRecognitionCtor;
};

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
  preferredNavigationApp: "naver" | "kakao";
};

function normalizeTranscript(base: string, transcript: string) {
  const merged = [base.trim(), transcript.trim()].filter(Boolean).join(" ");
  return merged.replace(/\s+/g, " ").trim();
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") {
    return null;
  }
  const w = window as WindowWithSpeech;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
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
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceBaseInputRef = useRef("");
  const voiceHasResultRef = useRef(false);
  const voiceLastMergedInputRef = useRef("");
  const skipNextAutoSearchRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  useEffect(() => {
    if (!autoSearch || !row.input.trim()) {
      return;
    }

    if (skipNextAutoSearchRef.current) {
      skipNextAutoSearchRef.current = false;
      return;
    }

    const timer = window.setTimeout(() => onSearch(row.id), 600);
    return () => window.clearTimeout(timer);
  }, [autoSearch, onSearch, row.id, row.input]);

  useEffect(() => {
    if (!highlighted) {
      return;
    }
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // no-op
      }
      recognitionRef.current = null;
    };
  }, []);

  const canNavigate = Boolean(row.coord);
  const naverLinks = row.coord ? createNaverDirectionLinks(origin, row.coord, row.label ?? row.input) : null;
  const kakaoLinks = row.coord ? createKakaoMapDirectionLinks(origin, row.coord, row.label ?? row.input) : null;
  const speechSupported = Boolean(getSpeechRecognitionCtor());

  const startVoiceInput = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setVoiceError("이 브라우저는 음성 입력을 지원하지 않습니다. (Chrome/Edge 권장)");
      return;
    }

    setVoiceError(null);
    voiceBaseInputRef.current = row.input ?? "";
    voiceHasResultRef.current = false;
    voiceLastMergedInputRef.current = row.input ?? "";

    const recognition = new Ctor();
    recognition.lang = "ko-KR";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let transcript = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const part = result?.[0]?.transcript ?? "";
        transcript += ` ${part}`;
      }

      const normalized = normalizeTranscript(voiceBaseInputRef.current, transcript);
      voiceHasResultRef.current = normalized.trim().length > 0;
      voiceLastMergedInputRef.current = normalized;
      onChangeInput(row.id, normalized);
    };

    recognition.onerror = (event) => {
      const code = event.error ?? "unknown";
      const messageMap: Record<string, string> = {
        "not-allowed": "마이크 권한이 거부되었습니다. 브라우저 권한을 허용해주세요.",
        "service-not-allowed": "음성 인식 서비스 사용이 허용되지 않았습니다.",
        "no-speech": "음성이 인식되지 않았습니다. 다시 시도해주세요.",
        aborted: "음성 입력이 취소되었습니다.",
        "audio-capture": "마이크를 찾을 수 없습니다.",
      };
      setVoiceError(messageMap[code] ?? `음성 입력 오류: ${code}`);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;

      if (voiceHasResultRef.current && voiceLastMergedInputRef.current.trim()) {
        skipNextAutoSearchRef.current = true;
        window.setTimeout(() => {
          onSearch(row.id);
        }, 180);
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const stopVoiceInput = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // no-op
    }
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
            onChange={(e) => onChangeInput(row.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && row.input.trim() && row.status !== "loading") {
                e.preventDefault();
                onSearch(row.id);
              }
            }}
          />
          <button
            type="button"
            className={`h-12 rounded-lg px-3 text-xs font-medium ${
              isListening
                ? "border border-rose-300 bg-rose-50 text-rose-700"
                : "border border-slate-300 bg-white text-slate-700"
            } disabled:opacity-50`}
            onClick={isListening ? stopVoiceInput : startVoiceInput}
            disabled={!speechSupported && !isListening}
            title={speechSupported ? "음성으로 주소 입력" : "이 브라우저는 음성 입력 미지원"}
          >
            {isListening ? "음성중지" : "음성입력"}
          </button>
        </div>

        {isListening ? (
          <p className="text-xs text-cyan-700">음성 입력 중... 말한 내용이 주소 입력칸에 바로 반영됩니다.</p>
        ) : null}
        {voiceError ? <p className="text-xs text-rose-600">{voiceError}</p> : null}
        {!speechSupported ? (
          <p className="text-xs text-slate-500">음성 입력은 Chrome/Edge(안드로이드 포함)에서 더 안정적으로 동작합니다.</p>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button
            type="button"
            className="h-12 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white"
            disabled={!row.input.trim() || row.status === "loading"}
            onClick={() => onSearch(row.id)}
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

      {canNavigate ? (
        <>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="h-11 rounded-lg bg-cyan-700 px-3 text-sm font-medium text-white"
              onClick={() => onNavigate(row.id)}
            >
              기본 앱 길찾기 ({preferredNavigationApp === "naver" ? "네이버" : "카카오"})
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

          <p className="mt-2 text-[11px] text-slate-500">좌표가 확정되면 네이버/카카오 길찾기를 바로 사용할 수 있습니다.</p>
        </>
      ) : null}
    </div>
  );
}
