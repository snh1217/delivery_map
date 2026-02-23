"use client";

declare global {
  interface Window {
    Kakao?: {
      init: (key: string) => void;
      isInitialized?: () => boolean;
      Navi?: {
        start: (params: Record<string, unknown>) => void;
      };
    };
  }
}

let kakaoSdkPromise: Promise<typeof window.Kakao> | null = null;

function getKakaoJsKey() {
  return (
    process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY ||
    process.env.NEXT_PUBLIC_KAKAO_JS_KEY ||
    ""
  ).trim();
}

export function getKakaoSdkKeyInfo() {
  const key = getKakaoJsKey();
  const sourceVar = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY
    ? "NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY"
    : process.env.NEXT_PUBLIC_KAKAO_JS_KEY
      ? "NEXT_PUBLIC_KAKAO_JS_KEY"
      : null;

  return {
    key,
    sourceVar,
    exists: Boolean(key),
  };
}

export async function loadKakaoSdk() {
  if (typeof window === "undefined") {
    throw new Error("브라우저 환경에서만 카카오 SDK를 사용할 수 있습니다.");
  }

  const { key } = getKakaoSdkKeyInfo();
  if (!key) {
    throw new Error("카카오 JavaScript 키가 설정되지 않았습니다.");
  }

  if (window.Kakao) {
    if (!window.Kakao.isInitialized?.()) {
      window.Kakao.init(key);
    }
    return window.Kakao;
  }

  if (!kakaoSdkPromise) {
    kakaoSdkPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-kakao-sdk="true"]');
      if (existing && window.Kakao) {
        if (!window.Kakao.isInitialized?.()) {
          window.Kakao.init(key);
        }
        resolve(window.Kakao);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://developers.kakao.com/sdk/js/kakao.min.js";
      script.async = true;
      script.defer = true;
      script.dataset.kakaoSdk = "true";

      script.onload = () => {
        if (!window.Kakao) {
          reject(new Error("카카오 SDK 로드 후 window.Kakao를 찾을 수 없습니다."));
          return;
        }
        if (!window.Kakao.isInitialized?.()) {
          window.Kakao.init(key);
        }
        resolve(window.Kakao);
      };

      script.onerror = () => {
        reject(new Error("카카오 JavaScript SDK 로드에 실패했습니다."));
      };

      document.head.appendChild(script);
    });
  }

  return kakaoSdkPromise;
}

