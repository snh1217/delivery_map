"use client";

import { isNativeApp } from "@/lib/native/runtime";

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string; confidence?: number };
    length: number;
  }>;
};

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

type WindowWithSpeech = Window & {
  webkitSpeechRecognition?: SpeechRecognitionCtor;
  SpeechRecognition?: SpeechRecognitionCtor;
};

export type SpeechResultPayload = {
  finalText: string;
  interimText: string;
  displayText: string;
  confidence?: number;
};

export type SpeechRecognizerOptions = {
  lang?: string;
  silenceTimeoutMs?: number;
  minRecordingMs?: number;
  onListeningChange?: (listening: boolean) => void;
  onResult?: (payload: SpeechResultPayload) => void;
  onError?: (code: string) => void;
  onEnd?: (payload: SpeechResultPayload) => void;
};

export function isSpeechRecognitionSupported() {
  if (typeof window === "undefined") return false;
  const w = window as WindowWithSpeech;
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

export function supportsMicrophoneCapture() {
  if (typeof navigator === "undefined") return false;
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as WindowWithSpeech;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function joinParts(...values: string[]) {
  return values
    .map((v) => v.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createSpeechRecognizer(options: SpeechRecognizerOptions = {}) {
  let recognition: SpeechRecognitionLike | null = null;
  let listening = false;
  let finalText = "";
  let interimText = "";
  let bestConfidence: number | undefined;
  let silenceTimer: number | null = null;
  let startedAt = 0;
  let lastResultAt = 0;
  let hasReceivedResult = false;

  const silenceTimeoutMs = options.silenceTimeoutMs ?? 900;
  const minRecordingMs = options.minRecordingMs ?? 800;

  const clearTimer = () => {
    if (silenceTimer !== null) {
      window.clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  };

  const payload = (): SpeechResultPayload => ({
    finalText,
    interimText,
    displayText: joinParts(finalText, interimText),
    confidence: bestConfidence,
  });

  const stopInternal = () => {
    if (isNativeApp()) {
      void (async () => {
        try {
          const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
          await SpeechRecognition.stop();
        } catch {
          // ignore stop race
        }
      })();
      return;
    }

    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // ignore stop race
    }
  };

  const scheduleSilenceStop = () => {
    if (!listening) return;
    if (!hasReceivedResult) return;
    clearTimer();
    const now = Date.now();
    const elapsed = now - startedAt;
    const waitMs = Math.max(silenceTimeoutMs, minRecordingMs - elapsed);
    silenceTimer = window.setTimeout(() => {
      const sinceLast = Date.now() - lastResultAt;
      if (!listening) return;
      if (sinceLast >= silenceTimeoutMs && Date.now() - startedAt >= minRecordingMs) {
        stopInternal();
        return;
      }
      scheduleSilenceStop();
    }, Math.max(100, waitMs));
  };

  const start = async () => {
    if (isNativeApp()) {
      clearTimer();
      finalText = "";
      interimText = "";
      bestConfidence = undefined;
      hasReceivedResult = false;
      startedAt = Date.now();
      lastResultAt = startedAt;

      const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
      const availability = await SpeechRecognition.available();
      if (!availability.available) {
        throw new Error("unsupported");
      }

      await SpeechRecognition.removeAllListeners().catch(() => {});

      await SpeechRecognition.addListener("partialResults", ({ matches }) => {
        const transcript = joinParts(...(Array.isArray(matches) ? matches : []));
        if (!transcript) return;
        finalText = transcript;
        interimText = "";
        bestConfidence = 0.75;
        hasReceivedResult = true;
        lastResultAt = Date.now();
        options.onResult?.(payload());
        scheduleSilenceStop();
      });

      await SpeechRecognition.addListener("listeningState", ({ status }) => {
        const nextListening = status === "started";
        listening = nextListening;
        options.onListeningChange?.(nextListening);
        if (!nextListening) {
          clearTimer();
          options.onEnd?.(payload());
          void SpeechRecognition.removeAllListeners().catch(() => {});
        }
      });

      listening = true;
      options.onListeningChange?.(true);

      try {
        await SpeechRecognition.start({
          language: options.lang ?? "ko-KR",
          maxResults: 1,
          partialResults: true,
          popup: false,
          prompt: "주소를 말해 주세요",
        });
      } catch (error) {
        listening = false;
        options.onListeningChange?.(false);
        const message = error instanceof Error ? error.message : "unknown";
        options.onError?.(message);
        throw error;
      }

      return;
    }

    const Ctor = getCtor();
    if (!Ctor) {
      throw new Error("unsupported");
    }

    clearTimer();
    finalText = "";
    interimText = "";
    bestConfidence = undefined;
    hasReceivedResult = false;
    startedAt = Date.now();
    lastResultAt = startedAt;

    recognition = new Ctor();
    recognition.lang = options.lang ?? "ko-KR";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let finalAcc = "";
      let interimAcc = "";
      let confidenceCandidate: number | undefined;

      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const alt = result?.[0];
        const transcript = alt?.transcript ?? "";
        if (typeof alt?.confidence === "number") {
          confidenceCandidate = Math.max(confidenceCandidate ?? 0, alt.confidence);
        }
        if (result?.isFinal) {
          finalAcc += ` ${transcript}`;
        } else {
          interimAcc += ` ${transcript}`;
        }
      }

      finalText = joinParts(finalAcc);
      interimText = joinParts(interimAcc);
      if (typeof confidenceCandidate === "number") {
        bestConfidence = confidenceCandidate;
      }
      hasReceivedResult = true;
      lastResultAt = Date.now();
      options.onResult?.(payload());
      scheduleSilenceStop();
    };

    recognition.onerror = (event) => {
      options.onError?.(event.error ?? "unknown");
    };

    recognition.onend = () => {
      clearTimer();
      listening = false;
      options.onListeningChange?.(false);
      options.onEnd?.(payload());
      recognition = null;
    };

    listening = true;
    options.onListeningChange?.(true);
    recognition.start();
  };

  return {
    start,
    stop: stopInternal,
    abort: () => {
      clearTimer();
      if (isNativeApp()) {
        void (async () => {
          try {
            const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
            await SpeechRecognition.stop();
            await SpeechRecognition.removeAllListeners();
          } catch {
            // ignore
          }
        })();
        return;
      }
      if (!recognition) return;
      try {
        recognition.abort();
      } catch {
        // ignore
      }
    },
    isListening: () => listening,
  };
}
