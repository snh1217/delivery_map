"use client";

type Props = {
  onClick: () => void;
};

export function EarningsFab({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed right-3 z-30 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white/95 text-slate-800 shadow-xl backdrop-blur active:scale-[0.98] lg:bottom-6"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 88px)" }}
      aria-label="운임 계산기 열기"
      title="운임 계산기"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
        <path d="M8 6.5h8" />
        <path d="M8 11h2m4 0h2M8 14.5h2m4 0h2M8 18h2m4 0h2" />
      </svg>
    </button>
  );
}

