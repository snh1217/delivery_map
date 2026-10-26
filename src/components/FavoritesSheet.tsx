"use client";

import { useMemo, useState } from "react";
import type { FavoriteAddressRow } from "@/types";

type Props = {
  favorites: FavoriteAddressRow[];
  loading: boolean;
  error: string | null;
  canAddMore: boolean;
  onClose: () => void;
  onUse: (favorite: FavoriteAddressRow) => void;
  onUpdate: (id: string, patch: { label: string; detail: string; memo: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

type Draft = { label: string; detail: string; memo: string };

export function FavoritesSheet({ favorites, loading, error, canAddMore, onClose, onUse, onUpdate, onDelete }: Props) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ label: "", detail: "", memo: "" });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const keyword = query.replace(/\s+/g, "").toLowerCase();
    if (!keyword) return favorites;
    return favorites.filter((item) =>
      [item.label, item.address, item.detail ?? "", item.memo ?? ""]
        .join(" ")
        .replace(/\s+/g, "")
        .toLowerCase()
        .includes(keyword),
    );
  }, [favorites, query]);

  const startEdit = (item: FavoriteAddressRow) => {
    setActionError(null);
    setEditingId(item.id);
    setDraft({ label: item.label, detail: item.detail ?? "", memo: item.memo ?? "" });
  };

  const saveEdit = async (id: string) => {
    setSavingId(id);
    setActionError(null);
    try {
      await onUpdate(id, draft);
      setEditingId(null);
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : "저장 실패");
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (item: FavoriteAddressRow) => {
    if (!window.confirm(`'${item.label}' 즐겨찾기를 삭제할까요?`)) return;
    setSavingId(item.id);
    setActionError(null);
    try {
      await onDelete(item.id);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : "삭제 실패");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 sm:items-center sm:px-4"
      onClick={onClose}
    >
      <div
        className="app-sheet-in flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-label="즐겨찾기 보관함"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-4 pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="app-section-title flex items-center gap-2">
                즐겨찾기 보관함
                <span className="app-chip bg-amber-50 text-amber-700">{favorites.length}</span>
              </h2>
              <p className="app-caption">자주 가는 주소를 눌러 바로 도착지로 추가하세요.</p>
            </div>
            <button type="button" className="app-btn app-btn-secondary h-9 w-9 px-0" onClick={onClose} aria-label="닫기">
              ✕
            </button>
          </div>
          <input
            className="app-input mt-3 h-11 w-full"
            placeholder="이름, 주소, 메모로 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
          {actionError ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{actionError}</p> : null}
          {!canAddMore ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">도착지가 가득 찼습니다. 기존 도착지를 지운 뒤 추가하세요.</p>
          ) : null}

          {loading && favorites.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">불러오는 중...</p> : null}

          {!loading && favorites.length === 0 ? (
            <div className="py-10 text-center">
              <div className="text-3xl text-amber-400">☆</div>
              <p className="mt-2 text-sm font-semibold text-slate-700">저장된 즐겨찾기가 없습니다</p>
              <p className="mt-1 text-xs text-slate-500">도착지 카드의 ☆ 버튼을 누르면 이곳에 보관됩니다.</p>
            </div>
          ) : null}

          {favorites.length > 0 && filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">검색 결과가 없습니다.</p>
          ) : null}

          {filtered.map((item) =>
            editingId === item.id ? (
              <div key={item.id} className="rounded-2xl border border-cyan-200 bg-cyan-50/40 p-3">
                <div className="text-[11px] text-slate-500">{item.address}</div>
                <div className="mt-2 grid gap-2">
                  <input
                    className="app-input h-10 text-sm"
                    placeholder="이름 (예: 본사, 단골 거래처)"
                    value={draft.label}
                    onChange={(event) => setDraft((prev) => ({ ...prev, label: event.target.value }))}
                  />
                  <input
                    className="app-input h-10 text-sm"
                    placeholder="상세 (예: 7층, 후문)"
                    value={draft.detail}
                    onChange={(event) => setDraft((prev) => ({ ...prev, detail: event.target.value }))}
                  />
                  <input
                    className="app-input h-10 text-sm"
                    placeholder="메모 (예: 경비실에 맡기기)"
                    value={draft.memo}
                    onChange={(event) => setDraft((prev) => ({ ...prev, memo: event.target.value }))}
                  />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" className="app-btn app-btn-secondary h-10" onClick={() => setEditingId(null)}>
                    취소
                  </button>
                  <button
                    type="button"
                    className="app-btn app-btn-brand h-10"
                    disabled={savingId === item.id || !draft.label.trim()}
                    onClick={() => void saveEdit(item.id)}
                  >
                    {savingId === item.id ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            ) : (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-3">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left disabled:opacity-50"
                    disabled={!canAddMore}
                    onClick={() => onUse(item)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-500" aria-hidden="true">★</span>
                      <span className="truncate text-sm font-bold text-slate-900">{item.label}</span>
                      {item.use_count > 0 ? (
                        <span className="app-chip shrink-0 bg-slate-100 text-slate-500">{item.use_count}회</span>
                      ) : null}
                    </div>
                    {item.label !== item.address ? (
                      <div className="mt-0.5 truncate text-xs text-slate-600">{item.address}</div>
                    ) : null}
                    {item.detail || item.memo ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.detail ? <span className="app-chip bg-cyan-50 text-cyan-800">{item.detail}</span> : null}
                        {item.memo ? <span className="app-chip bg-slate-50 font-medium text-slate-500">{item.memo}</span> : null}
                      </div>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="app-btn app-btn-brand h-9 shrink-0 px-3 text-xs"
                    disabled={!canAddMore}
                    onClick={() => onUse(item)}
                  >
                    추가
                  </button>
                </div>
                <div className="mt-2 flex justify-end gap-1 border-t border-slate-100 pt-2">
                  <button type="button" className="app-btn h-8 px-2.5 text-xs text-slate-500 hover:bg-slate-100" onClick={() => startEdit(item)}>
                    편집
                  </button>
                  <button
                    type="button"
                    className="app-btn h-8 px-2.5 text-xs text-rose-500 hover:bg-rose-50"
                    disabled={savingId === item.id}
                    onClick={() => void remove(item)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
