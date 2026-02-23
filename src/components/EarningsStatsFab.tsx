"use client";

type Props = {
  onClick: () => void;
};

export function EarningsStatsFab({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed right-3 z-30 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white/95 text-slate-800 shadow-xl backdrop-blur active:scale-[0.98] lg:bottom-24"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 152px)" }}
      aria-label="운임 통계 열기"
      title="운임 통계"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 20.5h16" />
        <path d="M7 18V10" />
        <path d="M12 18V6" />
        <path d="M17 18v-4" />
      </svg>
    </button>
  );
}
